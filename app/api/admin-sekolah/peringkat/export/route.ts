import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { buatExcelPeringkat, namaBerkasLaporan } from "@/lib/hasil-tryout/excel";
import { bangunPeringkat, namaSekolah, teksSyarat } from "@/lib/hasil-tryout/laporan";
import { bacaAksesLaporan, bacaFilterLaporan, bacaMinimalTryOut } from "@/lib/hasil-tryout/param";
import { ringkasHasil } from "@/lib/hasil-tryout/susun";
import { muatLogoPdf } from "@/lib/pdf/logo";
import { renderPeringkatPdf } from "@/lib/pdf/peringkat-renderer";
import { formatWIBDate } from "@/lib/utils/datetime";

export const dynamic = "force-dynamic";

/**
 * Unduh peringkat siswa sebagai Excel (?format=xlsx, bawaan) atau PDF (?format=pdf) dengan syarat yang sama persis dengan
 * layar (/api/admin-sekolah/peringkat): jenis, mapel, paket, dari, sampai, alumni, minimal.
 */
export async function GET(request: Request) {
  const akses = await bacaAksesLaporan(request, { kunci: "hasil-tryout-unduh", batasPerMenit: 20 });
  if ("galat" in akses) return akses.galat;

  const f = bacaFilterLaporan(akses.url, "tanpa");
  if ("galat" in f) return f.galat;
  const minimal = bacaMinimalTryOut(akses.url);
  if ("galat" in minimal) return minimal.galat;
  const format = akses.url.searchParams.get("format") || "xlsx";
  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json({ error: "Format unduhan tidak dikenal." }, { status: 400 });
  }

  const { semua, terpilih, baris } = await bangunPeringkat(akses.schoolId, f.filter, minimal.nilai);
  const sekarang = new Date();
  const sekolah = await namaSekolah(akses.schoolId);
  const syarat = teksSyarat(f.filter, semua, { minimalTryOut: minimal.nilai });

  if (format === "pdf") {
    const diperingkat = new Set(baris.map((b) => b.studentId));
    const ringkas = ringkasHasil(terpilih.filter((h) => diperingkat.has(h.studentId)));
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
    const potongan: Buffer[] = [];
    doc.on("data", (c: Buffer) => potongan.push(c));
    const selesai = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(potongan))));
    await renderPeringkatPdf(
      doc,
      {
        sekolah,
        syarat,
        dicetak: formatWIBDate(sekarang).replace(/ WIB$/, ""),
        ringkasan: { jumlahSiswa: baris.length, jumlahTryOut: baris.reduce((s, b) => s + b.jumlahTryOut, 0), rataRata: ringkas.rataRata },
        baris,
      },
      await muatLogoPdf(),
    );
    doc.end();
    const pdf = await selesai;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${namaBerkasLaporan("peringkat-siswa", sekolah, sekarang, "pdf")}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const berkas = await buatExcelPeringkat({ sekolah, filter: syarat, dibuatPada: sekarang }, baris);
  return new NextResponse(new Uint8Array(berkas), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaBerkasLaporan("peringkat-siswa", sekolah, sekarang, "xlsx")}"`,
      "Cache-Control": "no-store",
    },
  });
}
