import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { periksaTokenEmailKontak } from "@/lib/siswa/email-kontak";
import { verifikasiEmailKontakSchema } from "@/lib/validations/email-kontak";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Menyelesaikan verifikasi email kontak dari tautan di email (halaman /verifikasi-email-kontak memanggil rute ini).
 * Sengaja TANPA sesi login: pemilik email sering membuka tautan di perangkat lain (mis. orang tua di ponselnya) atau saat
 * siswa sedang keluar. Keamanannya ada di token bertanda tangan (lib/siswa/email-kontak.ts): hanya server yang bisa
 * membuatnya, terikat pada siswa DAN alamat, dan kedaluwarsa. Memakai POST (bukan GET dari tautan langsung) supaya
 * pemindai tautan di kotak surat tidak memverifikasi alamat tanpa sepengetahuan pemiliknya.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request) ?? "unknown";
  if (!checkRateLimit(`verifikasi-email-kontak:${ip}`, 20, 10 * 60_000)) {
    return json({ error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." }, 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = verifikasiEmailKontakSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Tautan verifikasi tidak valid." }, 400);
  }

  const token = periksaTokenEmailKontak(parsed.data.token);
  if (!token.ok) {
    if (token.alasan === "kedaluwarsa") {
      return json({ error: "Tautan verifikasi sudah kedaluwarsa. Minta tautan baru lewat halaman Profil.", kode: "kedaluwarsa" }, 410);
    }
    if (token.alasan === "tanpa_kunci") {
      return json({ error: "Verifikasi email belum aktif di server ini. Hubungi admin AyoTKA." }, 503);
    }
    return json({ error: "Tautan verifikasi tidak valid.", kode: "tidak_sah" }, 400);
  }

  const siswa = await prisma.student.findFirst({
    where: { id: token.studentId, deletedAt: null },
    select: { id: true, userId: true, emailKontak: true, emailKontakVerifiedAt: true },
  });
  // Alamat yang tersimpan harus masih sama dengan alamat di tautan: kalau sudah diganti atau dilepas, tautan lama mati.
  if (!siswa || !siswa.emailKontak || siswa.emailKontak.toLowerCase() !== token.email) {
    return json({ error: "Tautan ini sudah tidak berlaku (email kontak sudah diganti atau dilepas).", kode: "usang" }, 409);
  }
  if (siswa.emailKontakVerifiedAt) {
    return json({ ok: true, sudahTerverifikasi: true });
  }

  // updateMany dengan syarat alamat yang sama: bila alamat berganti di antara pembacaan dan penulisan, tidak ada yang berubah.
  const hasil = await prisma.student.updateMany({
    where: { id: siswa.id, emailKontak: siswa.emailKontak, emailKontakVerifiedAt: null },
    data: { emailKontakVerifiedAt: new Date() },
  });
  if (hasil.count === 0) {
    return json({ error: "Tautan ini sudah tidak berlaku (email kontak sudah diganti atau dilepas).", kode: "usang" }, 409);
  }

  await logAudit({
    userId: siswa.userId,
    aksi: "update",
    entitas: "students",
    entitasId: siswa.id,
    after: { emailKontak: siswa.emailKontak, terverifikasi: true, aksi: "verifikasi_email_kontak" },
    ip: getClientIp(request),
  });

  return json({ ok: true, sudahTerverifikasi: false });
}
