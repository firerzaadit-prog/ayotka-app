import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { bacaParamLaporan } from "@/lib/indikator/laporan-param";
import { bangunLaporanIndikatorSekolah, daftarMapelLaporan } from "@/lib/indikator/laporan-sekolah";

/**
 * Laporan daya serap per indikator sekolah (JSON untuk halaman web). Tanpa ?subjectId hanya mengembalikan daftar mata
 * pelajaran yang punya percobaan selesai; dengan ?subjectId= ikut mengembalikan laporan mapel itu, lengkap dengan
 * pembanding pengguna AyoTKA (?provinsi=, ?kabupatenKota=, ?statusSekolah=; tanpa parameter = nasional) dan wawasan otomatis.
 */
export async function GET(request: Request) {
  const param = await bacaParamLaporan(request);
  if ("galat" in param) return param.galat;

  const mapel = await daftarMapelLaporan(prisma, param.schoolId, param.rentang);
  if (!param.subjectId) {
    return NextResponse.json({ mapel, periodeLabel: param.periodeLabel, data: null });
  }
  const data = await bangunLaporanIndikatorSekolah(prisma, param.schoolId, param.subjectId, param.rentang, { pembanding: param.pembanding });
  if (!data) return NextResponse.json({ error: "Mata pelajaran atau sekolah tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ mapel, periodeLabel: param.periodeLabel, data });
}
