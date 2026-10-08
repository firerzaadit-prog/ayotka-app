import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DayaSerapIndikator } from "@/components/hasil/daya-serap-indikator";
import { hitungLaporanSekolah, hitungLaporanSiswa, type InfoIndikator, type JawabanBerindikator, type JawabanSiswa } from "@/lib/indikator/daya-serap";
import { bangunExcelLaporanSekolah } from "@/lib/indikator/laporan-excel";
import type { DataLaporanSekolah } from "@/lib/indikator/laporan-sekolah";
import { renderLaporanSekolahPdf } from "@/lib/pdf/laporan-sekolah-renderer";
import { renderRaporPdf } from "@/lib/pdf/rapor-renderer";

/**
 * Semua keluaran rapor/laporan harus memakai nama elemen menurut Kerangka Asesmen: SD Matematika "Data", bukan
 * "Data dan Ketidakpastian" (nama di master portal). Master di database tetap apa adanya - hanya tampilannya.
 */
const MASTER = "Data dan Ketidakpastian";

const sd = (n: number, elemen: string, o: Partial<InfoIndikator> = {}): InfoIndikator => ({
  id: `sd${n}`,
  jenjang: "SD",
  namaMapel: "Matematika",
  elemen,
  subelemen: elemen === MASTER ? "Penyajian dan Penggunaan Data" : "Bilangan Rasional",
  kompetensi: `Kemampuan ${n}`,
  indikator: `Indikator SD ${n} (${n})`,
  urutan: n,
  nilaiNasional: 50,
  ...o,
});
const jw = (ind: InfoIndikator, skor: number): JawabanBerindikator => ({ indikator: ind, skor, skorMaks: 1 });
const ulang = (ind: InfoIndikator, n: number, benar: number) => Array.from({ length: n }, (_, i) => jw(ind, i < benar ? 1 : 0));

const jawabanSiswa = [...ulang(sd(1, "Bilangan"), 4, 3), ...ulang(sd(2, MASTER), 4, 1)];

describe("rapor siswa di web", () => {
  it("kelompok elemen tampil 'Data', tanpa 'Ketidakpastian'", () => {
    const html = renderToStaticMarkup(createElement(DayaSerapIndikator, { laporan: hitungLaporanSiswa(jawabanSiswa)! }));
    expect(html).toMatch(/>Data</);
    expect(html).toContain("Penyajian dan Penggunaan Data");
    expect(html).not.toContain("Ketidakpastian");
  });
});

/** Render ke PDF sungguhan (pdfkit) dan kumpulkan semua teks yang digambar. */
async function kumpulkanTeks(gambar: (doc: PDFKit.PDFDocument) => Promise<void>) {
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const teks: string[] = [];
  const asli = doc.text.bind(doc);
  vi.spyOn(doc, "text").mockImplementation(((...args: unknown[]) => {
    if (typeof args[0] === "string") teks.push(args[0]);
    return (asli as (...a: unknown[]) => unknown)(...args);
  }) as never);
  doc.on("data", () => undefined);
  await gambar(doc);
  doc.end();
  return teks.join("\n");
}

describe("PDF rapor siswa", () => {
  it("kepala kelompok 'Elemen: Data' dan tidak ada 'Ketidakpastian' di halaman mana pun", async () => {
    const hasil = {
      attempt: { id: "a1", status: "selesai", skorMentah: 4, skorAkhir: 50, mulaiAt: new Date(), selesaiAt: new Date() },
      package: { nama: "Try Out SD" },
      siswa: { nama: "SISWA UJI", idSamar: "008***42" },
      canShowPembahasan: true,
      isFreeTrial: false,
      analisisAiDiminta: false,
      bisaUnduhRapor: true,
      ranking: null,
      // Peta Kompetensi (taksonomi) sudah dipetakan oleh buildHasil; di sini cukup memastikan renderer menuliskannya apa adanya.
      elemenScores: [
        { elemenNama: "Bilangan", jmlBenar: 3, jmlSoal: 4, persentase: 75 },
        { elemenNama: "Data", jmlBenar: 1, jmlSoal: 4, persentase: 25 },
      ],
      perSoal: [],
      indikator: hitungLaporanSiswa(jawabanSiswa),
    };
    const teks = await kumpulkanTeks((doc) => renderRaporPdf(doc, hasil as never, null, null));
    expect(teks).toContain("Elemen: Data");
    expect(teks).toContain("Elemen: Bilangan");
    expect(teks).not.toContain("Ketidakpastian");
  });
});

const siswa = (id: string) => ({ studentId: id, nama: `Siswa ${id}`, nisn: `0012${id}` });
const sw = (studentId: string, ind: InfoIndikator, skor: number): JawabanSiswa => ({ studentId, indikator: ind, skor, skorMaks: 1 });
/** 10 siswa menjawab satu indikator; `benar` di antaranya benar. */
const kelas = (ind: InfoIndikator, benar: number, awalan: string): JawabanSiswa[] =>
  Array.from({ length: 10 }, (_, i) => sw(`${awalan}${i}`, ind, i < benar ? 1 : 0));

function dataSekolah(): DataLaporanSekolah {
  const jawaban = [...kelas(sd(1, "Bilangan"), 8, "a"), ...kelas(sd(2, MASTER), 2, "b")];
  const murid = [...new Set(jawaban.map((j) => j.studentId))].map(siswa);
  return {
    sekolah: { id: "sek", nama: "SD Negeri Contoh" },
    mapel: { subjectId: "m", nama: "Matematika", jenjang: "SD" },
    jumlahSiswaMengerjakan: murid.length,
    jumlahPercobaan: murid.length,
    jumlahPaket: 1,
    laporan: hitungLaporanSekolah(jawaban, murid),
  };
}

describe("laporan sekolah", () => {
  it("PDF: elemen 'Data' tampil, tanpa 'Ketidakpastian'", async () => {
    const teks = await kumpulkanTeks((doc) => renderLaporanSekolahPdf(doc, dataSekolah(), "Semua waktu", null));
    expect(teks).toMatch(/Elemen: Data(\s|$)/);
    expect(teks).not.toContain("Ketidakpastian");
  });

  it("Excel: lembar Per Kelompok dan Per Indikator memakai 'Data'; tidak ada sel berisi 'Ketidakpastian'", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await bangunExcelLaporanSekolah(dataSekolah(), "Semua waktu")) as never);
    const semua: string[] = [];
    wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => { if (typeof c.value === "string") semua.push(c.value); })));
    expect(semua).toContain("Data");
    expect(semua.join("\n")).not.toContain("Ketidakpastian");
    const kelompok: string[] = [];
    wb.getWorksheet("Per Kelompok")!.eachRow((r, n) => { if (n > 1) kelompok.push(String(r.getCell(1).value)); });
    expect(kelompok.sort()).toEqual(["Bilangan", "Data"]);
  });
});
