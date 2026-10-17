import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifikasiPasswordSaatIni } from "@/lib/auth/verifikasi-password";
import { adalahEmailSintetis } from "@/lib/billing/pembayaran-affiliate";
import {
  buatEmailEmailKontakBerubah,
  buatEmailVerifikasiEmailKontak,
  kirimPemberitahuanAkun,
} from "@/lib/email/profil";
import {
  MASA_BERLAKU_TOKEN_MS,
  buatTokenEmailKontak,
  emailKontakTerverifikasi,
  labelNisnTersamar,
  ringkasEmailKontak,
} from "@/lib/siswa/email-kontak";
import { emailKontakSchema } from "@/lib/validations/email-kontak";
import { asalPublik } from "@/lib/utils/asal-publik";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Pasang/ganti/lepas: cukup longgar untuk salah ketik, cukup ketat untuk menebak password. */
const BATAS_UBAH = 5;
/** Kirim ulang verifikasi tidak butuh password, jadi lebih ketat supaya tidak dipakai membanjiri kotak surat orang lain. */
const BATAS_KIRIM_ULANG = 3;
const JENDELA_MS = 15 * 60_000;

/**
 * Email kontak untuk akun yang masuk dengan NISN (lihat lib/siswa/email-kontak.ts). Hanya akun NISN: akun dengan email
 * sungguhan sudah menerima email di alamat loginnya. Alamat baru TIDAK dipakai untuk apa pun sampai pemiliknya
 * mengklik tautan verifikasi; mengganti atau melepas alamat yang sudah terverifikasi memberi tahu alamat lamanya.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return json({ error: "Tidak diizinkan." }, 403);
  }

  if (!adalahEmailSintetis(user.email)) {
    return json({ error: "Akunmu sudah memakai email sungguhan untuk masuk, jadi semua email dikirim ke alamat itu." }, 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = emailKontakSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, 400);
  }
  const aksi = parsed.data;

  const kunciLaju = aksi.aksi === "kirim_ulang" ? `profil-email-kontak-ulang:${user.id}` : `profil-email-kontak:${user.id}`;
  if (!checkRateLimit(kunciLaju, aksi.aksi === "kirim_ulang" ? BATAS_KIRIM_ULANG : BATAS_UBAH, JENDELA_MS)) {
    return json({ error: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit." }, 429);
  }

  const siswa = await prisma.student.findFirst({ where: { userId: user.id, deletedAt: null } });
  if (!siswa) return json({ error: "Profil siswa tidak ditemukan." }, 404);

  // Password saat ini wajib untuk mengubah siapa yang menerima tautan lupa password (akun bisa direbut lewat kontak).
  if (aksi.aksi !== "kirim_ulang") {
    const verifikasi = await verifikasiPasswordSaatIni(user.email, aksi.password);
    if (verifikasi === "salah") return json({ error: "Password saat ini salah." }, 400);
    if (verifikasi === "dibatasi") return json({ error: "Sistem sedang ramai. Tunggu beberapa saat lalu coba lagi." }, 429);
    if (verifikasi === "layanan") {
      return json({ error: "Layanan masuk sedang gangguan, email kontak belum bisa diubah. Coba lagi beberapa saat lagi." }, 503);
    }
  }

  const asal = asalPublik(request);
  const labelAkun = labelNisnTersamar(siswa.nisn);
  const lamaTerverifikasi = emailKontakTerverifikasi(siswa);

  /** Kirim tautan verifikasi untuk alamat yang sedang tersimpan. null = server tidak punya kunci penanda tangan. */
  async function kirimVerifikasi(alamat: string): Promise<boolean | null> {
    const token = buatTokenEmailKontak({ studentId: siswa!.id, email: alamat });
    if (!token) return null;
    const tautan = `${asal}/verifikasi-email-kontak?token=${encodeURIComponent(token)}`;
    const hasil = await kirimPemberitahuanAkun(
      alamat,
      buatEmailVerifikasiEmailKontak({ nama: siswa!.nama, email: alamat, labelAkun, tautan, berlakuJam: MASA_BERLAKU_TOKEN_MS / 3_600_000 }),
    );
    return hasil.ok;
  }

  if (aksi.aksi === "kirim_ulang") {
    if (!siswa.emailKontak) return json({ error: "Belum ada email kontak yang didaftarkan." }, 409);
    if (siswa.emailKontakVerifiedAt) {
      return json({ ok: true, emailKontak: ringkasEmailKontak(siswa), pengiriman: null, pesan: "Email kontakmu sudah terverifikasi." });
    }
    const terkirim = await kirimVerifikasi(siswa.emailKontak);
    if (terkirim === null) return json({ error: "Verifikasi email belum aktif di server ini. Hubungi admin AyoTKA." }, 503);
    return json({ ok: true, emailKontak: ringkasEmailKontak(siswa), pengiriman: terkirim });
  }

  if (aksi.aksi === "hapus") {
    if (!siswa.emailKontak) return json({ ok: true, emailKontak: null, pengiriman: null });
    await prisma.student.update({ where: { id: siswa.id }, data: { emailKontak: null, emailKontakVerifiedAt: null } });
    await logAudit({
      userId: user.id,
      aksi: "update",
      entitas: "students",
      entitasId: siswa.id,
      before: { emailKontak: siswa.emailKontak, terverifikasi: siswa.emailKontakVerifiedAt != null },
      after: { emailKontak: null, aksi: "lepas_email_kontak" },
      ip: getClientIp(request),
    });
    if (lamaTerverifikasi) {
      await kirimPemberitahuanAkun(
        lamaTerverifikasi,
        buatEmailEmailKontakBerubah({ nama: siswa.nama, emailLama: lamaTerverifikasi, emailBaru: null, labelAkun, waktu: new Date(), asal }),
      );
    }
    return json({ ok: true, emailKontak: null, pengiriman: null });
  }

  // aksi "simpan"
  const alamat = aksi.email;
  if (siswa.emailKontak && siswa.emailKontak.toLowerCase() === alamat) {
    if (siswa.emailKontakVerifiedAt) {
      return json({ ok: true, emailKontak: ringkasEmailKontak(siswa), pengiriman: null, pesan: "Email kontak itu sudah terpasang dan terverifikasi." });
    }
    // Alamat yang sama tetapi belum diverifikasi: anggap permintaan kirim ulang.
    const terkirim = await kirimVerifikasi(alamat);
    if (terkirim === null) return json({ error: "Verifikasi email belum aktif di server ini. Hubungi admin AyoTKA." }, 503);
    return json({ ok: true, emailKontak: ringkasEmailKontak(siswa), pengiriman: terkirim });
  }

  // Server harus bisa menandatangani tautan sebelum apa pun disimpan: alamat tanpa jalan verifikasi tidak ada gunanya.
  if (!buatTokenEmailKontak({ studentId: siswa.id, email: alamat })) {
    return json({ error: "Verifikasi email belum aktif di server ini. Hubungi admin AyoTKA." }, 503);
  }

  const baru = await prisma.student.update({ where: { id: siswa.id }, data: { emailKontak: alamat, emailKontakVerifiedAt: null } });
  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "students",
    entitasId: siswa.id,
    before: { emailKontak: siswa.emailKontak, terverifikasi: siswa.emailKontakVerifiedAt != null },
    after: { emailKontak: alamat, terverifikasi: false, aksi: "pasang_email_kontak" },
    ip: getClientIp(request),
  });

  const terkirim = await kirimVerifikasi(alamat);
  if (lamaTerverifikasi) {
    await kirimPemberitahuanAkun(
      lamaTerverifikasi,
      buatEmailEmailKontakBerubah({ nama: siswa.nama, emailLama: lamaTerverifikasi, emailBaru: alamat, labelAkun, waktu: new Date(), asal }),
    );
  }
  return json({ ok: true, emailKontak: ringkasEmailKontak(baru), pengiriman: terkirim });
}
