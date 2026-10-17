import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifikasiPasswordSaatIni } from "@/lib/auth/verifikasi-password";
import { buatEmailEmailDiubahKeBaru, buatEmailEmailDiubahKeLama, kirimPemberitahuanAkun } from "@/lib/email/profil";
import { bisaUbahEmail } from "@/lib/siswa/profil";
import { gantiEmailSchema } from "@/lib/validations/profil";
import { asalPublik } from "@/lib/utils/asal-publik";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const BATAS_PERCOBAAN = 5;
const JENDELA_MS = 15 * 60_000;

/**
 * Siswa mengganti email loginnya sendiri. Aturan:
 * - akun yang masuk dengan NISN (email sintetis) tidak boleh: login NISN bergantung pada email itu;
 * - wajib password SAAT INI (diperiksa sebelum apa pun tentang email baru diungkapkan);
 * - email baru harus belum dipakai akun lain (tanpa peduli huruf besar/kecil);
 * - layanan login diubah dulu, baru tabel users kita; bila tabel kita gagal (mis. balapan email yang sama), email di
 *   layanan login dikembalikan supaya keduanya tidak pernah berbeda;
 * - email lama dan email baru sama-sama diberi pemberitahuan (gagal kirim tidak membatalkan perubahan).
 * Perubahan langsung berlaku tanpa tautan verifikasi karena pemilik akun sudah membuktikan password-nya; sesi yang
 * sedang berjalan tetap sah, dan login berikutnya memakai email baru.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return json({ error: "Tidak diizinkan." }, 403);
  }

  if (!bisaUbahEmail(user.email)) {
    return json(
      { error: "Akunmu masuk dengan NISN, jadi email loginnya tidak bisa diganti. Hubungi admin sekolah bila perlu bantuan." },
      403,
    );
  }

  if (!checkRateLimit(`profil-email:${user.id}`, BATAS_PERCOBAAN, JENDELA_MS)) {
    return json({ error: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit." }, 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = gantiEmailSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, 400);
  }
  const { emailBaru, password } = parsed.data;
  const emailLama = user.email;

  if (emailBaru === emailLama.trim().toLowerCase()) {
    return json({ error: "Email baru sama dengan email saat ini." }, 400);
  }

  const verifikasi = await verifikasiPasswordSaatIni(emailLama, password);
  if (verifikasi === "salah") return json({ error: "Password saat ini salah." }, 400);
  if (verifikasi === "dibatasi") return json({ error: "Sistem sedang ramai. Tunggu beberapa saat lalu coba lagi." }, 429);
  if (verifikasi === "layanan") {
    return json({ error: "Layanan masuk sedang gangguan, email belum bisa diubah. Coba lagi beberapa saat lagi." }, 503);
  }

  const dipakai = await prisma.user.findFirst({
    where: { email: { equals: emailBaru, mode: "insensitive" }, NOT: { id: user.id } },
    select: { id: true },
  });
  if (dipakai) return json({ error: "Email ini sudah dipakai akun lain." }, 409);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, { email: emailBaru, email_confirm: true });
  if (error) {
    // Layanan login menolak karena alamat sudah terdaftar di sana (akun yang tidak ada di tabel kita): sama dengan "dipakai".
    if (/already|exists|registered/i.test(`${error.code ?? ""} ${error.message}`)) {
      return json({ error: "Email ini sudah dipakai akun lain." }, 409);
    }
    console.error("[profil-email] gagal mengubah email di layanan login:", error.message);
    return json({ error: "Email belum bisa diubah karena terjadi gangguan. Silakan coba lagi." }, 502);
  }

  try {
    await prisma.user.update({ where: { id: user.id }, data: { email: emailBaru } });
  } catch (err) {
    // Kembalikan email di layanan login agar akun tidak terbelah dua (login dengan email yang tidak ada di tabel kita).
    const { error: galatKembali } = await admin.auth.admin.updateUserById(user.id, { email: emailLama, email_confirm: true });
    if (galatKembali) console.error("[profil-email] GAGAL mengembalikan email di layanan login:", galatKembali.message);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return json({ error: "Email ini sudah dipakai akun lain." }, 409);
    }
    console.error("[profil-email] gagal menyimpan email baru:", err);
    return json({ error: "Email belum bisa diubah karena terjadi gangguan. Silakan coba lagi." }, 502);
  }

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "users",
    entitasId: user.id,
    before: { email: emailLama },
    after: { email: emailBaru, aksi: "ganti_email_mandiri" },
    ip: getClientIp(request),
  });

  const siswa = await prisma.student.findFirst({ where: { userId: user.id }, select: { nama: true } });
  const nama = siswa?.nama ?? "";
  const asal = asalPublik(request);
  const waktu = new Date();
  const [keLama, keBaru] = await Promise.all([
    kirimPemberitahuanAkun(emailLama, buatEmailEmailDiubahKeLama({ nama, emailLama, emailBaru, waktu, asal })),
    kirimPemberitahuanAkun(emailBaru, buatEmailEmailDiubahKeBaru({ nama, emailBaru, waktu, asal })),
  ]);

  return json({ ok: true, email: emailBaru, pemberitahuan: { lama: keLama.ok, baru: keBaru.ok } });
}
