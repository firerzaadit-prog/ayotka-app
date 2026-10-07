import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db/prisma";
import { bacaParamLaporan, slugBerkas } from "@/lib/indikator/laporan-param";
import { bangunLaporanIndikatorSekolah } from "@/lib/indikator/laporan-sekolah";
import { renderLaporanSekolahPdf } from "@/lib/pdf/laporan-sekolah-renderer";

/** Unduh laporan daya serap per indikator sekolah (PDF). Datanya sama persis dengan halaman web dan unduhan Excel. */
export async function GET(request: Request) {
  const param = await bacaParamLaporan(request);
  if ("galat" in param) return param.galat;
  if (!param.subjectId) {
    return NextResponse.json({ error: "Pilih mata pelajaran dulu." }, { status: 400 });
  }
  const data = await bangunLaporanIndikatorSekolah(prisma, param.schoolId, param.subjectId, param.rentang);
  if (!data) return NextResponse.json({ error: "Mata pelajaran atau sekolah tidak ditemukan." }, { status: 404 });

  // Logo dibaca dari disk (bukan diunduh lewat alamat publik): server tidak selalu bisa memanggil alamat publiknya sendiri.
  const logo = await readFile(path.join(process.cwd(), "public", "logo.png")).catch(() => null);

  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const potongan: Buffer[] = [];
  doc.on("data", (c: Buffer) => potongan.push(c));
  const selesai = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(potongan))));
  await renderLaporanSekolahPdf(doc, data, param.periodeLabel, logo);
  doc.end();
  const pdf = await selesai;

  const nama = `laporan-indikator-${slugBerkas(data.mapel.nama)}-${slugBerkas(data.sekolah.nama)}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nama}"`,
      "Cache-Control": "no-store",
    },
  });
}
