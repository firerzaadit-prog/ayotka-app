import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { getKeanggotaanSiswa } from "@/lib/billing/keanggotaan";
import { adalahEmailSintetis } from "@/lib/billing/pembayaran-affiliate";
import { bisaUbahEmail } from "@/lib/siswa/profil";
import { ringkasEmailKontak } from "@/lib/siswa/email-kontak";
import { normalisasiNomorWa, profilUpdateSchema } from "@/lib/validations/profil";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Data diri siswa untuk halaman Profil: yang boleh diubah sendiri (nama, nomor WhatsApp, email bila bukan akun NISN,
 * password) dan yang hanya dibaca (NISN, jenjang, sekolah). Akun yang masuk dengan NISN
 * memakai email sintetis `{nisn}@nisn.ayotka.id` sebagai identitas login, jadi emailnya tidak bisa diganti (login NISN
 * akan putus) dan tidak ditampilkan sebagai email sungguhan.
 */
export async function GET() {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return json({ error: "Tidak diizinkan." }, 403);
  }

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    include: { school: { select: { nama: true } } },
  });
  if (!student) return json({ error: "Profil siswa tidak ditemukan." }, 404);

  const emailNisn = adalahEmailSintetis(user.email);
  return json({
    nama: student.nama,
    email: emailNisn ? null : user.email,
    masukDenganNisn: emailNisn,
    nisn: student.nisn,
    jenjang: student.jenjang,
    jalur: student.jalur,
    sekolah: student.school?.nama ?? null,
    waKontak: student.waKontak,
    bisaUbahEmail: bisaUbahEmail(user.email),
    // Email kontak hanya berlaku untuk akun NISN (email loginnya sintetis); akun lain null.
    emailKontak: emailNisn ? ringkasEmailKontak(student) : null,
    keanggotaan: await getKeanggotaanSiswa(student),
  });
}

/** Ubah nama dan/atau nomor WhatsApp (semua siswa, termasuk Jalur A). Kolom yang tidak dikirim tidak disentuh. */
export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return json({ error: "Tidak diizinkan." }, 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = profilUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, 400);
  }

  const student = await prisma.student.findFirst({ where: { userId: user.id } });
  if (!student) return json({ error: "Profil siswa tidak ditemukan." }, 404);

  const ubah: { nama?: string; waKontak?: string | null } = {};

  if (parsed.data.nama !== undefined) {
    const namaBaru = parsed.data.nama.replace(/\s+/g, " ");
    if (namaBaru !== student.nama) ubah.nama = namaBaru;
  }

  if (parsed.data.waKontak !== undefined) {
    // Skema sudah memastikan bentuknya sah; "tidak_valid" tidak mungkin sampai di sini.
    const nomor = normalisasiNomorWa(parsed.data.waKontak);
    if (nomor !== "tidak_valid" && nomor !== student.waKontak) ubah.waKontak = nomor;
  }

  if (Object.keys(ubah).length === 0) {
    return json({ ok: true, berubah: false, nama: student.nama, waKontak: student.waKontak });
  }

  const baru = await prisma.student.update({ where: { id: student.id }, data: ubah });
  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "students",
    entitasId: student.id,
    before: { nama: student.nama, waKontak: student.waKontak },
    after: { nama: baru.nama, waKontak: baru.waKontak, aksi: "ubah_profil_mandiri" },
    ip: getClientIp(request),
  });

  return json({ ok: true, berubah: true, nama: baru.nama, waKontak: baru.waKontak });
}
