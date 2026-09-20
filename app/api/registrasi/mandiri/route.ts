import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateReadableCode } from "@/lib/utils/generate-code";
import { generateUniqueStudentReferralCode } from "@/lib/students/create";
import { daftarMandiriSchema } from "@/lib/validations/registrasi";
import { sendViaResendApi } from "@/lib/email/resend";

/**
 * Tiket 3.3 (Bagian 3.1 brief, Jalur B): registrasi siswa mandiri. Beda
 * dari Jalur A - akun dibuat belum terkonfirmasi, siswa wajib klik link
 * konfirmasi dulu (Jalur A memakai email_confirm:true langsung karena
 * sekolah sudah memvouch identitasnya). Pembayaran menyusul di Fase 6 -
 * untuk sekarang status Student langsung "active" (lihat komentar di bawah).
 *
 * Email konfirmasi dikirim manual lewat Resend API (lib/email/resend.ts),
 * BUKAN lewat Supabase auth.resend(). Ditemukan lewat investigasi manual
 * (25 Agustus 2026): integrasi SMTP custom Supabase->Resend gagal
 * konsisten di production project ini (request tidak pernah sampai ke
 * Resend sama sekali - dicek dari log Resend yang tidak pernah bertambah
 * meski domain/API key/username/redirect URL semua sudah benar dan
 * terverifikasi satu-satu), padahal panggilan HTTP langsung ke Resend
 * selalu berhasil. auth.admin.generateLink dipakai supaya token
 * konfirmasinya tetap token resmi Supabase (aman, sama seperti sebelumnya)
 * - cuma bagian "siapa yang kirim email"-nya yang dipindah ke kita.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request) ?? "unknown";
  if (!checkRateLimit(`registrasi-mandiri:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan, coba lagi sebentar lagi." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = daftarMandiriSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    return NextResponse.json({ error: "Email ini sudah dipakai akun lain." }, { status: 409 });
  }

  let schoolId: string;
  if (data.asalSekolahId && data.asalSekolahId.length > 0) {
    const school = await prisma.school.findUnique({ where: { id: data.asalSekolahId } });
    if (!school) {
      return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
    }
    schoolId = school.id;
  } else {
    // Sekolah yang diketik manual langsung dipakai TANPA verifikasi admin
    // pusat (permintaan user). Supaya tidak menumpuk duplikat, nama yang sama
    // (tanpa peduli huruf besar/kecil & spasi ganda) di jenjang yang sama
    // memakai baris sekolah yang sudah ada.
    const namaManual = data.asalSekolahManual!.replace(/\s+/g, " ").trim();
    const existingSchool = await prisma.school.findFirst({
      where: { nama: { equals: namaManual, mode: "insensitive" }, jenjang: data.jenjang },
      select: { id: true },
    });
    if (existingSchool) {
      schoolId = existingSchool.id;
    } else {
      const newSchool = await prisma.school.create({
        data: {
          nama: namaManual,
          jenjang: data.jenjang,
          kodeSekolah: generateReadableCode(8),
          status: "aktif",
        },
      });
      schoolId = newSchool.id;
    }
  }

  // Kode referral opsional - kalau tidak ditemukan/salah ketik, daftar tetap
  // lanjut tanpa referral (bukan alasan untuk memblokir pendaftaran).
  let referredByStudentId: string | null = null;
  if (data.kodeReferral && data.kodeReferral.trim().length > 0) {
    const referrer = await prisma.student.findUnique({
      where: { referralCode: data.kodeReferral.trim().toUpperCase() },
      select: { id: true },
    });
    referredByStudentId = referrer?.id ?? null;
  }
  const newReferralCode = await generateUniqueStudentReferralCode();

  const supabaseAdmin = createAdminClient();

  // generateLink (bukan createUser) sekaligus membuat akun & memberi kita
  // token konfirmasinya langsung, tanpa Supabase perlu kirim email sendiri.
  // Bedanya dari createUser: generateLink TIDAK bisa terima app_metadata
  // langsung, jadi role "siswa" di-set terpisah lewat updateUserById tepat
  // di bawah ini.
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "signup",
    email: data.email,
    password: data.password,
    options: { data: { nama: data.nama } },
  });
  if (linkError || !linkData.user || !linkData.properties) {
    return NextResponse.json(
      { error: `Gagal membuat akun: ${linkError?.message ?? "unknown error"}` },
      { status: 502 },
    );
  }
  const authUser = linkData.user;

  // Akun Supabase & baris User/Student kita hidup di dua sistem terpisah -
  // tidak bisa satu transaksi ACID. Kalau ADA SAJA yang gagal setelah akun
  // Supabase dibuat (set role, kirim email, atau simpan ke DB kita), akun
  // Supabase itu WAJIB dihapus lagi supaya emailnya bisa dipakai coba
  // daftar ulang - kalau dibiarkan, jadi akun "mati": tidak bisa login
  // (baris User kita tidak ada) dan tidak bisa didaftarkan ulang (Supabase
  // sudah menganggap emailnya terpakai).
  try {
    const { error: roleError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      app_metadata: { role: "siswa" },
    });
    if (roleError) {
      throw new Error(`Gagal menyiapkan akun: ${roleError.message}`);
    }

    const confirmUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/confirm`);
    confirmUrl.searchParams.set("token_hash", linkData.properties.hashed_token);
    confirmUrl.searchParams.set("type", "signup");
    confirmUrl.searchParams.set("next", "/siswa/dashboard");

    const emailResult = await sendViaResendApi({
      to: data.email,
      subject: "Konfirmasi akun AyoTKA kamu",
      html: [
        `<p>Halo ${data.nama},</p>`,
        `<p>Terima kasih sudah mendaftar di AyoTKA. Klik tombol di bawah untuk mengonfirmasi akunmu:</p>`,
        `<p><a href="${confirmUrl.toString()}" style="display:inline-block;padding:10px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">Konfirmasi Akun</a></p>`,
        `<p>Atau salin tautan ini ke browser: ${confirmUrl.toString()}</p>`,
        `<p>Kalau kamu tidak merasa mendaftar di AyoTKA, abaikan saja email ini.</p>`,
      ].join(""),
    });
    if (!emailResult.ok) {
      throw new Error(`Gagal mengirim email verifikasi: ${emailResult.error}`);
    }

    await prisma.$transaction([
      prisma.user.create({
        data: { id: authUser.id, email: data.email, role: "siswa", status: "aktif" },
      }),
      prisma.student.create({
        data: {
          userId: authUser.id,
          schoolId,
          jenjang: data.jenjang,
          tingkat: data.tingkat,
          nama: data.nama,
          jalur: "B",
          claimStatus: "sudah_klaim",
          // Langsung aktif: akses try out diatur entitlement/langganan, bukan
          // persetujuan admin (status "pending" tidak menahan apa pun di login).
          status: "active",
          referralCode: newReferralCode,
          referredByStudentId,
        },
      }),
    ]);
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.id).catch(() => {});
    // Detail teknis (mis. respons mentah Resend) hanya ke log server, bukan ke layar siswa.
    console.error("[registrasi-mandiri] gagal membuat akun:", err);
    const message = err instanceof Error ? err.message : "";
    const emailGagal = message.startsWith("Gagal mengirim email verifikasi");
    return NextResponse.json(
      {
        error: emailGagal
          ? "Akun belum bisa dibuat karena email verifikasi gagal terkirim. Pastikan alamat emailmu benar, lalu coba lagi. Kalau masih gagal, hubungi admin AyoTKA."
          : "Akun belum bisa dibuat karena terjadi gangguan. Silakan coba daftar lagi sebentar lagi.",
      },
      { status: 502 },
    );
  }

  await logAudit({
    userId: authUser.id,
    aksi: "create",
    entitas: "students",
    entitasId: authUser.id,
    after: { jalur: "B", email: data.email, schoolId },
    ip,
  });

  return NextResponse.json({ ok: true });
}
