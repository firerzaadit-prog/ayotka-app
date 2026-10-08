import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { KelompokDetail } from "@/components/hasil/daya-serap-indikator";
import { hitungLaporanSekolah, type InfoIndikator, type JawabanSiswa } from "@/lib/indikator/daya-serap";
import { bangunExcelLaporanSekolah } from "@/lib/indikator/laporan-excel";
import type { DataLaporanSekolah } from "@/lib/indikator/laporan-sekolah";
import { susunPembanding } from "@/lib/indikator/pembanding";
import { susunWawasan } from "@/lib/indikator/wawasan";
import { renderLaporanSekolahPdf } from "@/lib/pdf/laporan-sekolah-renderer";
import type { FilterWilayah } from "@/lib/wilayah/cakupan";

const ind = (n: number): InfoIndikator => ({
  id: `m${n}`,
  jenjang: "SMP",
  namaMapel: "Matematika",
  elemen: n <= 2 ? "Bilangan" : "Aljabar",
  subelemen: "Bilangan Real",
  kompetensi: "Kemampuan X",
  indikator: `Indikator mat ${n} (${n})`,
  urutan: n,
  nilaiNasional: 50,
});

const FILTER: FilterWilayah = { provinsi: "Jawa Timur", kabupatenKota: null, statusSekolah: "negeri" };

function bangunData(opsi: { pembanding: "cukup" | "kurang" | "tidak" } = { pembanding: "cukup" }): DataLaporanSekolah {
  const jawaban: JawabanSiswa[] = [];
  for (let s = 0; s < 20; s++) {
    for (let n = 1; n <= 3; n++) {
      jawaban.push({ studentId: `s${s}`, indikator: ind(n), skor: (s + n) % 3 === 0 ? 1 : 0, skorMaks: 1, bulan: s < 10 ? "2026-09" : "2026-10", level: n === 1 ? "L1" : "L3" });
    }
  }
  const siswa = Array.from({ length: 20 }, (_, s) => ({ studentId: `s${s}`, nama: `Siswa ${s}`, nisn: `0012${s}` }));
  const pembanding =
    opsi.pembanding === "tidak"
      ? null
      : susunPembanding({
          filter: FILTER,
          indikator: [1, 2, 3].map((n) => ({ indikatorId: `m${n}`, skor: 45, skorMaks: 100, jmlSoal: 100, jmlSekolah: 5 })),
          sekolah: (opsi.pembanding === "cukup" ? [60, 50, 70, 40] : [60]).map((s, i) => ({ schoolId: i === 0 ? "sek-1" : `lain-${i}`, skor: s, skorMaks: 100, jmlSiswa: 20 })),
          schoolIdSendiri: "sek-1",
        });
  const peta = pembanding?.cukup ? new Map(Object.entries(pembanding.perIndikator).map(([id, p]) => [id, p.dayaSerap] as const)) : undefined;
  const laporan = hitungLaporanSekolah(jawaban, siswa, peta ? { pembandingWilayah: peta } : undefined)!;
  return {
    sekolah: { id: "sek-1", nama: "SMP Negeri 1 Contoh", provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: "negeri" },
    mapel: { subjectId: "mapel", nama: "Matematika", jenjang: "SMP" },
    jumlahSiswaMengerjakan: 20,
    jumlahPercobaan: 20,
    jumlahPaket: 1,
    laporan,
    pembanding,
    wawasan: susunWawasan(laporan, pembanding),
  };
}

async function teksPdf(data: DataLaporanSekolah) {
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const teks: string[] = [];
  const asli = doc.text.bind(doc);
  vi.spyOn(doc, "text").mockImplementation(((...args: unknown[]) => {
    if (typeof args[0] === "string") teks.push(args[0]);
    return (asli as (...a: unknown[]) => unknown)(...args);
  }) as never);
  doc.on("data", () => undefined);
  await renderLaporanSekolahPdf(doc, data, "Semua waktu", null);
  const halaman = doc.bufferedPageRange().count;
  doc.end();
  return { teks, gabung: teks.join("\n"), halaman };
}

async function bacaExcel(data: DataLaporanSekolah) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await bangunExcelLaporanSekolah(data, "Semua waktu")) as never);
  return wb;
}
const semuaTeks = (wb: ExcelJS.Workbook) => {
  const hasil: string[] = [];
  wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => { if (typeof c.value === "string") hasil.push(c.value); })));
  return hasil.join("\n");
};
const barisSebagaiPeta = (ws: ExcelJS.Worksheet) => {
  const peta = new Map<string, unknown>();
  ws.eachRow((r, n) => { if (n > 1) peta.set(String(r.getCell(1).value), r.getCell(2).value); });
  return peta;
};

describe("PDF laporan sekolah - pembanding dan wawasan", () => {
  it("memuat baris pembanding, blok wawasan dengan label jenis, tren, level, dan rerata wilayah per kelompok", async () => {
    const data = bangunData();
    const { gabung } = await teksPdf(data);
    expect(gabung).toContain("Pembanding pengguna AyoTKA (Provinsi Jawa Timur · Negeri): rerata daya serap 55,0% dari 4 sekolah dan 80 siswa.");
    expect(gabung).toContain("Wawasan Learning Analytics");
    for (const w of data.wawasan!) expect(gabung).toContain(w.teks.slice(0, 40));
    expect(gabung).toMatch(/PERHATIAN|INFO|BAIK/);
    expect(gabung).toContain("Tren dan Level Kognitif");
    expect(gabung).toContain("Tren bulanan: Sep 2026");
    expect(gabung).toContain("Per level kognitif: Level 1 (Pengetahuan & Pemahaman)");
    expect(gabung).toContain("AyoTKA Provinsi Jawa Timur · Negeri");
    expect(gabung).toMatch(/AyoTKA \d+%/); // keterangan tiap baris indikator
  });

  it("pembanding belum cukup: kalimat penjelasan, tanpa rerata wilayah per kelompok", async () => {
    const { gabung } = await teksPdf(bangunData({ pembanding: "kurang" }));
    expect(gabung).toContain("belum cukup: baru 1 sekolah yang punya data pada mapel ini (minimal 3).");
    expect(gabung).not.toMatch(/AyoTKA \d+%/);
  });

  it("tanpa pembanding sama sekali: tidak ada baris pembanding (perilaku lama), wawasan lain tetap ada", async () => {
    const { gabung } = await teksPdf(bangunData({ pembanding: "tidak" }));
    expect(gabung).not.toContain("Pembanding pengguna AyoTKA");
    expect(gabung).toContain("Wawasan Learning Analytics");
  });

  it("laporan tanpa wawasan/tren/level (data lama): tidak menggambar blok-blok itu dan tidak gagal", async () => {
    const data = bangunData({ pembanding: "tidak" });
    const polos: DataLaporanSekolah = { ...data, wawasan: [], laporan: { ...data.laporan!, tren: [], perLevel: [] } };
    const { gabung } = await teksPdf(polos);
    expect(gabung).not.toContain("Wawasan Learning Analytics");
    expect(gabung).not.toContain("Tren dan Level Kognitif");
  });

  it("jumlah halaman wajar (tidak ada halaman kosong berantai)", async () => {
    const { halaman } = await teksPdf(bangunData());
    expect(halaman).toBeLessThanOrEqual(6);
  });
});

describe("Excel laporan sekolah - pembanding dan wawasan", () => {
  it("lembar: Wawasan setelah Ringkasan dan Tren dan Level sebelum Siswa Perlu Perhatian", async () => {
    const wb = await bacaExcel(bangunData());
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Ringkasan", "Wawasan", "Per Kelompok", "Per Indikator", "Prioritas Remedial", "Di Bawah Nasional", "Tren dan Level", "Siswa Perlu Perhatian"]);
  });

  it("ringkasan: pembanding, jumlah sekolah/siswa, rerata, dan posisi sekolah", async () => {
    const peta = barisSebagaiPeta((await bacaExcel(bangunData())).getWorksheet("Ringkasan")!);
    expect(peta.get("Pembanding pengguna AyoTKA")).toBe("Provinsi Jawa Timur · Negeri");
    expect(peta.get("Sekolah pembanding / siswa")).toBe("4 / 80");
    expect(peta.get("Rerata pembanding (%)")).toBe(55);
    expect(peta.get("Posisi sekolah")).toBe("Peringkat 2 dari 4 sekolah (lebih tinggi dari 67% sekolah lain)");
  });

  it("ringkasan saat pembanding belum cukup: catatan, tanpa rerata", async () => {
    const peta = barisSebagaiPeta((await bacaExcel(bangunData({ pembanding: "kurang" }))).getWorksheet("Ringkasan")!);
    expect(peta.get("Catatan pembanding")).toBe("Belum cukup: baru 1 sekolah yang punya data (minimal 3).");
    expect(peta.has("Rerata pembanding (%)")).toBe(false);
  });

  it("Per Kelompok dan Per Indikator: kolom rerata wilayah + selisih sebagai ANGKA", async () => {
    const wb = await bacaExcel(bangunData());
    for (const nama of ["Per Kelompok", "Per Indikator"]) {
      const ws = wb.getWorksheet(nama)!;
      const kepala = (ws.getRow(1).values as unknown[]).slice(1) as string[];
      const iWil = kepala.indexOf("Rerata AyoTKA Provinsi Jawa Timur · Negeri (%)") + 1;
      const iSel = kepala.indexOf("Selisih wilayah (poin)") + 1;
      expect(iWil, nama).toBeGreaterThan(0);
      expect(iSel, nama).toBeGreaterThan(0);
      expect(ws.getRow(2).getCell(iWil).value).toBe(45);
      expect(typeof ws.getRow(2).getCell(iSel).value).toBe("number");
    }
  });

  it("lembar Wawasan memuat semua kalimat wawasan dengan jenisnya", async () => {
    const data = bangunData();
    const ws = (await bacaExcel(data)).getWorksheet("Wawasan")!;
    const baris: Array<[unknown, unknown]> = [];
    ws.eachRow((r, n) => { if (n > 1) baris.push([r.getCell(1).value, r.getCell(2).value]); });
    expect(baris.map((b) => b[1])).toEqual(data.wawasan!.map((w) => w.teks));
    for (const [jenis] of baris) expect(["Perhatian", "Info", "Baik"]).toContain(jenis);
  });

  it("lembar Tren dan Level: bulan urut, level L1 dan L3, daya serap angka", async () => {
    const ws = (await bacaExcel(bangunData())).getWorksheet("Tren dan Level")!;
    const baris: unknown[][] = [];
    ws.eachRow((r, n) => { if (n > 1) baris.push([r.getCell(1).value, r.getCell(2).value, r.getCell(5).value]); });
    expect(baris.map((b) => [b[0], b[1]])).toEqual([
      ["Tren bulanan", "Sep 2026"],
      ["Tren bulanan", "Okt 2026"],
      ["Level kognitif", "Level 1 (Pengetahuan & Pemahaman)"],
      ["Level kognitif", "Level 3 (Penalaran)"],
    ]);
    for (const b of baris) expect(typeof b[2]).toBe("number");
  });

  it("tanpa pembanding/wawasan/tren (data lama): tidak ada lembar atau kolom tambahan", async () => {
    const data = bangunData({ pembanding: "tidak" });
    const polos: DataLaporanSekolah = { ...data, pembanding: undefined, wawasan: undefined, laporan: { ...data.laporan!, tren: [], perLevel: [] } };
    const wb = await bacaExcel(polos);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Ringkasan", "Per Kelompok", "Per Indikator", "Prioritas Remedial", "Di Bawah Nasional", "Siswa Perlu Perhatian"]);
    expect(semuaTeks(wb)).not.toContain("AyoTKA");
    expect((wb.getWorksheet("Per Indikator")!.getRow(1).values as unknown[]).join("|")).not.toContain("Selisih wilayah");
  });

  it("teks wawasan yang diawali '=' tetap teks (bukan rumus)", async () => {
    const data = bangunData();
    data.wawasan = [{ jenis: "info", teks: "=HYPERLINK(\"http://x\")" }];
    const sel = (await bacaExcel(data)).getWorksheet("Wawasan")!.getRow(2).getCell(2);
    expect(sel.type).toBe(ExcelJS.ValueType.String);
  });
});

describe("KelompokDetail (web) - rerata wilayah", () => {
  it("menampilkan rerata wilayah dan selisih dengan label pembanding; tanpa wilayah tidak ada keterangannya", () => {
    const data = bangunData();
    const k = data.laporan!.kelompok[0]!;
    const html = renderToStaticMarkup(createElement(KelompokDetail, { label0: "Elemen", k, labelWilayah: "AyoTKA Provinsi Jawa Timur · Negeri" }));
    expect(html).toContain("data-pembanding-wilayah");
    expect(html).toContain("Rerata AyoTKA Provinsi Jawa Timur · Negeri 45,0%");
    expect(html).toMatch(/AyoTKA Provinsi Jawa Timur · Negeri \d+,\d% \([+-]\d+,\d poin\)/);
    const tanpa = bangunData({ pembanding: "tidak" }).laporan!.kelompok[0]!;
    expect(renderToStaticMarkup(createElement(KelompokDetail, { label0: "Elemen", k: tanpa }))).not.toContain("data-pembanding-wilayah");
  });

  it("kelompok tanpa angka wilayah (null): tidak menampilkan baris wilayah", () => {
    const data = bangunData();
    const k = { ...data.laporan!.kelompok[0]!, wilayah: null, selisihWilayah: null };
    expect(renderToStaticMarkup(createElement(KelompokDetail, { label0: "Elemen", k }))).not.toContain("data-pembanding-wilayah");
  });
});
