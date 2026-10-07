import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sinkronkanIndikatorSoal } from "@/lib/indikator/sinkron-soal";
import { getIndikatorPaket } from "@/lib/soal-import/source-db";

/**
 * Isi indikator pada soal yang SUDAH diimpor (dari soal.ayotka.id) dan tautkan ke master resmi. Hanya mengisi kolom yang
 * masih kosong dan aman diulang - lihat lib/indikator/sinkron-soal.ts. Dipakai setelah master diunggah, atau setelah
 * memperbarui master.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  if (!checkRateLimit(`indikator-sinkron:${user.id}`, 5, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan, coba lagi sebentar lagi." }, { status: 429 });
  }

  let laporan;
  try {
    laporan = await sinkronkanIndikatorSoal(prisma, getIndikatorPaket);
  } catch (err) {
    console.error("Gagal menyinkronkan indikator soal", err);
    return NextResponse.json({ error: "Gagal menyinkronkan indikator soal." }, { status: 500 });
  }

  if (!laporan.masterKosong) {
    await logAudit({
      userId: user.id,
      aksi: "update",
      entitas: "questions",
      entitasId: "sinkron-indikator",
      after: laporan.total,
      ip: getClientIp(request),
    });
  }

  return NextResponse.json({ laporan });
}
