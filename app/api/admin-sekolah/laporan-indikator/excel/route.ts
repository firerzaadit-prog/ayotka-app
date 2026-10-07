import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { bangunExcelLaporanSekolah } from "@/lib/indikator/laporan-excel";
import { bacaParamLaporan, slugBerkas } from "@/lib/indikator/laporan-param";
import { bangunLaporanIndikatorSekolah } from "@/lib/indikator/laporan-sekolah";

/** Unduh laporan daya serap per indikator sekolah (Excel). Datanya sama persis dengan halaman web dan unduhan PDF. */
export async function GET(request: Request) {
  const param = await bacaParamLaporan(request);
  if ("galat" in param) return param.galat;
  if (!param.subjectId) {
    return NextResponse.json({ error: "Pilih mata pelajaran dulu." }, { status: 400 });
  }
  const data = await bangunLaporanIndikatorSekolah(prisma, param.schoolId, param.subjectId, param.rentang);
  if (!data) return NextResponse.json({ error: "Mata pelajaran atau sekolah tidak ditemukan." }, { status: 404 });

  const buffer = await bangunExcelLaporanSekolah(data, param.periodeLabel);
  const nama = `laporan-indikator-${slugBerkas(data.mapel.nama)}-${slugBerkas(data.sekolah.nama)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nama}"`,
      "Cache-Control": "no-store",
    },
  });
}
