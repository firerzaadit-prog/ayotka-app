import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateReadableCode } from "@/lib/utils/generate-code";
import { generateUniqueStudentReferralCode } from "@/lib/students/create";
import { resolveKodeReferral } from "@/lib/registrasi/referral";
import { activateVoucher, VoucherSudahDipakaiError } from "@/lib/billing/vouchers";
import { daftarMandiriSchema } from "@/lib/validations/registrasi";
import { kirimEmailKonfirmasi, pesanEmailBelumTerkirim } from "@/lib/email/konfirmasi";

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

  // Email sudah dinormalisasi huruf kecil oleh skema, tapi pencarian tetap
  // tidak peka huruf besar/kecil supaya baris lama yang tersimpan dengan
  // huruf kapital ("Budi@..") juga dianggap terpakai.
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: data.email, mode: "insensitive" } },
    select: { id: true },
  });
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

  // Kolom kode opsional: kode referral teman ATAU kode voucher dari mitra (satu kode per voucher).
  // Kode yang tidak dikenali/salah ketik tidak memblokir pendaftaran (halaman pendaftaran sudah
  // memperingatkan lewat /api/registrasi/cek-referral). Sebaliknya kode voucher yang DIKENALI tapi
  // sudah tidak bisa dipakai ditolak dengan jelas: siswa mengira akan gratis, jangan didaftarkan
  // diam-diam tanpa akses.
  let referredByStudentId: string | null = null;
  let voucherUntukDiaktifkan: Extract<NonNullable<Awaited<ReturnType<typeof resolveKodeReferral>>>, { tipe: "voucher" }> | null = null;
  if (data.kodeReferral && data.kodeReferral.trim().length > 0) {
    const hasil = await resolveKodeReferral(data.kodeReferral);
    if (hasil?.tipe === "siswa") referredByStudentId = hasil.studentId;
    if (hasil?.tipe === "voucher") {
      if (hasil.status !== "unused") {
        return NextResponse.json(
          {
            error:
              hasil.status === "used"
                ? "Kode voucher ini sudah dipakai. Minta kode lain ke mitramu, atau kosongkan kolom kode untuk mendaftar tanpa voucher."
                : "Kode voucher ini sudah tidak berlaku. Minta kode baru ke mitramu, atau kosongkan kolom kode untuk mendaftar tanpa voucher.",
          },
          { status: 409 },
        );
      }
      voucherUntukDiaktifkan = hasil;
    }
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

  // generateLink "signup" untuk email yang sudah terdaftar tapi belum
  // dikonfirmasi mengembalikan akun LAMA itu, bukan akun baru. Akun itu milik
  // pendaftar sebelumnya - jangan diubah role-nya, apalagi dihapus di catch
  // bawah (dulu begitu: akun pertama jadi mati, tidak bisa login/daftar ulang).
  const akunLama = await prisma.user.findUnique({ where: { id: authUser.id }, select: { id: true } });
  if (akunLama) {
    return NextResponse.json({ error: "Email ini sudah dipakai akun lain." }, { status: 409 });
  }

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

    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: { id: authUser.id, email: data.email, role: "siswa", status: "aktif" },
      });
      const siswa = await tx.student.create({
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
      });
      // Voucher mitra diaktifkan di transaksi yang sama dengan pembuatan siswa: kalau voucher
      // keburu dipakai orang lain, akun ikut batal (tidak ada akun yang mengira dapat akses gratis).
      if (voucherUntukDiaktifkan) {
        await activateVoucher(tx, {
          voucherId: voucherUntukDiaktifkan.voucherId,
          planId: voucherUntukDiaktifkan.planId,
          partnerId: voucherUntukDiaktifkan.partnerId,
          durasiHari: voucherUntukDiaktifkan.durasiHari,
          studentId: siswa.id,
        });
      }
    });
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.id).catch(() => {});
    // Detail teknis (mis. respons mentah Resend) hanya ke log server, bukan ke layar siswa.
    console.error("[registrasi-mandiri] gagal membuat akun:", err);
    if (err instanceof VoucherSudahDipakaiError) {
      return NextResponse.json(
        { error: "Kode voucher ini baru saja dipakai orang lain. Minta kode lain ke mitramu, lalu coba daftar lagi." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Akun belum bisa dibuat karena terjadi gangguan. Silakan coba daftar lagi sebentar lagi." },
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

  // Email dikirim SETELAH akun benar-benar tersimpan, di luar try/catch di
  // atas: kegagalan email (kuota Resend habis, gangguan sesaat) TIDAK boleh
  // menghapus akun yang sudah jadi - dulu itu bikin pendaftar dituduh salah
  // ketik email lalu kehilangan akunnya. Sekarang akun tetap ada dan siswa
  // diberi tombol "Kirim ulang email konfirmasi" (lihat
  // app/api/auth/kirim-ulang-konfirmasi).
  const emailResult = await kirimEmailKonfirmasi({
    email: data.email,
    nama: data.nama,
    tokenHash: linkData.properties.hashed_token,
    type: "signup",
    peran: "siswa",
  });
  if (!emailResult.ok) {
    console.error("[registrasi-mandiri] akun dibuat tapi email konfirmasi gagal:", emailResult.error);
    return NextResponse.json({
      ok: true,
      emailTerkirim: false,
      pesan: pesanEmailBelumTerkirim(emailResult.kuotaHabis),
    });
  }

  return NextResponse.json({ ok: true, emailTerkirim: true });
}
