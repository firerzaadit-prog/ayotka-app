import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sinkronkanMediaSoal } from "@/lib/soal-import/sinkron-media";
import { getGambarPaket } from "@/lib/soal-import/source-db";

/**
 * Tingkatkan soal yang SUDAH diimpor dari soal.ayotka.id menjadi dua gambar (Diagram Presisi + Foto Ilustrasi) bila
 * sumbernya memilikinya, supaya siswa juga bisa berpindah antara keduanya (lihat lib/soal-import/sinkron-media.ts).
 *
 * Dua langkah yang disengaja: tanpa `jalankan: true` hanya SIMULASI (menghitung, tidak menulis apa pun); penulisan
 * sungguhan baru terjadi saat admin menekan "Terapkan" dan dicatat di audit log. Aman diulang.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  if (!checkRateLimit(`soal-sinkron-media:${user.id}`, 6, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan, coba lagi sebentar lagi." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { jalankan?: unknown } | null;
  const jalankan = body?.jalankan === true;

  let laporan;
  try {
    laporan = await sinkronkanMediaSoal(prisma, getGambarPaket, { jalankan });
  } catch (err) {
    console.error("Gagal menyinkronkan media soal", err);
    return NextResponse.json({ error: "Gagal memeriksa gambar soal. Coba lagi sebentar lagi." }, { status: 500 });
  }

  if (jalankan) {
    await logAudit({
      userId: user.id,
      aksi: "update",
      entitas: "questions",
      entitasId: "sinkron-media",
      after: laporan.total,
      ip: getClientIp(request),
    });
  }

  return NextResponse.json({ laporan });
}
