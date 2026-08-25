import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateReadableCode } from "@/lib/utils/generate-code";
import { daftarMandiriSchema } from "@/lib/validations/registrasi";

/**
 * Tiket 3.3 (Bagian 3.1 brief, Jalur B): registrasi siswa mandiri. Beda
 * dari Jalur A - akun dibuat dengan email_confirm:false lalu di-resend
 * supaya Supabase mengirim email verifikasi sungguhan (Jalur A memakai
 * email_confirm:true langsung karena sekolah sudah memvouch identitasnya).
 * Pembayaran menyusul di Fase 6 - untuk sekarang status Student tetap
 * "pending" sampai admin pusat aktivasi manual (lihat
 * /api/admin-pusat/siswa-mandiri).
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
    const pendingSchool = await prisma.school.create({
      data: {
        nama: data.asalSekolahManual!.trim(),
        jenjang: data.jenjang,
        kodeSekolah: generateReadableCode(8),
        status: "pending_verifikasi",
        kuotaSiswa: 0,
      },
    });
    schoolId = pendingSchool.id;
  }

  const supabaseAdmin = createAdminClient();
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: false,
    app_metadata: { role: "siswa" },
    user_metadata: { nama: data.nama },
  });
  if (authError || !authData.user) {
    return NextResponse.json(
      { error: `Gagal membuat akun: ${authError?.message ?? "unknown error"}` },
      { status: 502 },
    );
  }

  // Akun Supabase & baris User/Student kita hidup di dua sistem terpisah -
  // tidak bisa satu transaksi ACID. Kalau ADA SAJA yang gagal setelah akun
  // Supabase dibuat (kirim email atau simpan ke DB kita), akun Supabase itu
  // WAJIB dihapus lagi supaya emailnya bisa dipakai coba daftar ulang -
  // kalau dibiarkan, jadi akun "mati": tidak bisa login (baris User kita
  // tidak ada) dan tidak bisa didaftarkan ulang (Supabase sudah menganggap
  // emailnya terpakai).
  try {
    const { error: resendError } = await supabaseAdmin.auth.resend({
      type: "signup",
      email: data.email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/confirm?next=/siswa/dashboard`,
      },
    });
    if (resendError) {
      throw new Error(`Gagal mengirim email verifikasi: ${resendError.message}`);
    }

    await prisma.$transaction([
      prisma.user.create({
        data: { id: authData.user.id, email: data.email, role: "siswa", status: "aktif" },
      }),
      prisma.student.create({
        data: {
          userId: authData.user.id,
          schoolId,
          jenjang: data.jenjang,
          tingkat: data.tingkat,
          nama: data.nama,
          jalur: "B",
          claimStatus: "sudah_klaim",
          status: "pending",
        },
      }),
    ]);
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {});
    const message = err instanceof Error ? err.message : "Terjadi kesalahan tak terduga.";
    return NextResponse.json(
      { error: `Gagal membuat akun: ${message}. Coba daftar lagi.` },
      { status: 502 },
    );
  }

  await logAudit({
    userId: authData.user.id,
    aksi: "create",
    entitas: "students",
    entitasId: authData.user.id,
    after: { jalur: "B", email: data.email, schoolId },
    ip,
  });

  return NextResponse.json({ ok: true });
}
