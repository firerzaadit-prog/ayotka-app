import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { bangunExcelLaporanSekolah } from "@/lib/indikator/laporan-excel";
import { hitungLaporanSekolah, type InfoIndikator, type JawabanSiswa } from "@/lib/indikator/daya-serap";
import type { DataLaporanSekolah } from "@/lib/indikator/laporan-sekolah";

const mat = (n: number, o: Partial<InfoIndikator> = {}): InfoIndikator => ({
  id: `m${n}`,
  jenjang: "SMP",
  namaMapel: "Matematika",
  elemen: n <= 2 ? "Bilangan" : "Aljabar",
  subelemen: n <= 2 ? "Bilangan Real" : "Persamaan",
  kompetensi: `Kompetensi ${n}`,
  indikator: `Indikator mat ${n} (${n})`,
  urutan: n,
  nilaiNasional: 60,
  ...o,
});
const bin = (n: number): InfoIndikator => ({
  id: `b${n}`,
  jenjang: "SMP",
  namaMapel: "Bahasa Indonesia",
  elemen: "Pemahaman Tekstual",
  subelemen: `Subkompetensi ${n}`,
  kompetensi: `Subkompetensi ${n}`,
  indikator: `Indikator bin ${n} (${n})`,
  urutan: n,
  nilaiNasional: 55,
});
const sw = (studentId: string, ind: InfoIndikator, skor: number): JawabanSiswa => ({ studentId, indikator: ind, skor, skorMaks: 1 });

function data(jawaban: JawabanSiswa[], mapel = { subjectId: "s", nama: "Matematika", jenjang: "SMP" }): DataLaporanSekolah {
  const siswa = [...new Set(jawaban.map((j) => j.studentId))].map((id) => ({ studentId: id, nama: `Siswa ${id}`, nisn: `0012${id}` }));
  return {
    sekolah: { id: "sek", nama: "SMPN 1 Contoh" },
    mapel,
    jumlahSiswaMengerjakan: siswa.length,
    jumlahPercobaan: siswa.length,
    jumlahPaket: 1,
    laporan: hitungLaporanSekolah(jawaban, siswa),
  };
}

async function baca(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as never);
  return wb;
}

/** 10 siswa menjawab satu indikator; `benar` di antaranya benar. */
const kelas = (ind: InfoIndikator, benar: number, awalan = "s"): JawabanSiswa[] =>
  Array.from({ length: 10 }, (_, i) => sw(`${awalan}${i}`, ind, i < benar ? 1 : 0));

describe("bangunExcelLaporanSekolah", () => {
  it("menghasilkan berkas xlsx valid dengan lembar-lembar yang diharapkan (Matematika)", async () => {
    const d = data([...kelas(mat(1), 3, "a"), ...kelas(mat(3), 9, "b")]);
    const buf = await bangunExcelLaporanSekolah(d, "Semua waktu");
    expect(buf.subarray(0, 2).toString()).toBe("PK"); // xlsx = zip
    const wb = await baca(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Ringkasan", "Per Kelompok", "Per Indikator", "Prioritas Remedial", "Di Bawah Nasional", "Siswa Perlu Perhatian"]);
  });

  it("ringkasan memuat identitas, periode, hierarki, cakupan, dan sebaran", async () => {
    const d = data([...kelas(mat(1), 3, "a"), ...kelas(mat(3), 9, "b")]);
    const ws = (await baca(await bangunExcelLaporanSekolah(d, "Semester Ganjil (01 Jul - 31 Des)"))).getWorksheet("Ringkasan")!;
    const peta = new Map<string, unknown>();
    ws.eachRow((r, n) => {
      if (n > 1) peta.set(String(r.getCell(1).value), r.getCell(2).value);
    });
    expect(peta.get("Sekolah")).toBe("SMPN 1 Contoh");
    expect(peta.get("Mata pelajaran")).toBe("Matematika (SMP)");
    expect(peta.get("Periode")).toBe("Semester Ganjil (01 Jul - 31 Des)");
    expect(peta.get("Hierarki resmi")).toBe("Elemen > Subelemen > Kompetensi > Indikator");
    expect(peta.get("Jawaban berindikator resmi / seluruh jawaban")).toBe("20 / 20");
    expect(peta.get("Daya serap keseluruhan (%)")).toBe(60); // (3 + 9) / 20
  });

  it("angka disimpan sebagai ANGKA (bukan teks) dan dibulatkan satu desimal", async () => {
    const d = data(kelas(mat(1, { nilaiNasional: 33.333 }), 1)); // 10% vs 33,333
    const ws = (await baca(await bangunExcelLaporanSekolah(d, "x"))).getWorksheet("Per Indikator")!;
    const baris = ws.getRow(2);
    const dayaKol = ws.getRow(1).values as unknown[];
    const iDaya = dayaKol.indexOf("Daya serap (%)");
    const iNas = dayaKol.indexOf("Rerata nasional (%)");
    const iSel = dayaKol.indexOf("Selisih (poin)");
    expect(typeof baris.getCell(iDaya).value).toBe("number");
    expect(baris.getCell(iDaya).value).toBe(10);
    expect(baris.getCell(iNas).value).toBe(33.3);
    expect(baris.getCell(iSel).value).toBe(-23.3);
  });

  it("Matematika: lembar Per Indikator punya 4 tingkat (kolom Kompetensi ada)", async () => {
    const d = data(kelas(mat(1), 5));
    const ws = (await baca(await bangunExcelLaporanSekolah(d, "x"))).getWorksheet("Per Indikator")!;
    const kepala = (ws.getRow(1).values as unknown[]).slice(1);
    expect(kepala).toEqual(expect.arrayContaining(["Elemen", "Subelemen", "Kompetensi", "Indikator"]));
  });

  it("Bahasa Indonesia: 3 tingkat dan TIDAK ADA kolom/label Elemen atau Subelemen di lembar mana pun", async () => {
    const d = data([...kelas(bin(1), 5, "a"), ...kelas(bin(2), 2, "b")], { subjectId: "s", nama: "Bahasa Indonesia", jenjang: "SMP" });
    const wb = await baca(await bangunExcelLaporanSekolah(d, "x"));
    const semuaTeks: string[] = [];
    wb.eachSheet((ws) =>
      ws.eachRow((r) => r.eachCell((c) => { if (typeof c.value === "string") semuaTeks.push(c.value); })),
    );
    const kepalaInd = (wb.getWorksheet("Per Indikator")!.getRow(1).values as unknown[]).slice(1);
    expect(kepalaInd).toEqual(expect.arrayContaining(["Kompetensi", "Subkompetensi", "Indikator"]));
    expect(kepalaInd).not.toContain("Elemen");
    expect(kepalaInd).not.toContain("Subelemen");
    expect(semuaTeks.join("\n")).toContain("Kompetensi > Subkompetensi > Indikator");
    expect(semuaTeks.join("\n")).not.toMatch(/Elemen|Subelemen/);
  });

  it("per kelompok: vonis berupa teks resmi, selisih angka", async () => {
    const d = data([...kelas(mat(1, { nilaiNasional: 30 }), 9, "a"), ...kelas(mat(3, { nilaiNasional: 90 }), 2, "b")]);
    const ws = (await baca(await bangunExcelLaporanSekolah(d, "x"))).getWorksheet("Per Kelompok")!;
    const rows: Record<string, unknown[]> = {};
    ws.eachRow((r, n) => {
      if (n > 1) rows[String(r.getCell(1).value)] = r.values as unknown[];
    });
    expect(rows["Bilangan"]).toEqual(expect.arrayContaining(["Di atas rerata nasional"]));
    expect(rows["Aljabar"]).toEqual(expect.arrayContaining(["Perlu penguatan"]));
  });

  it("siswa perlu perhatian: nama, NISN sebagai teks (nol di depan tetap), dan dua indikator terlemah", async () => {
    const jw = [...kelas(mat(1), 0, "x"), sw("y", mat(1), 1)];
    const d = data(jw);
    const ws = (await baca(await bangunExcelLaporanSekolah(d, "x"))).getWorksheet("Siswa Perlu Perhatian")!;
    const kepala = (ws.getRow(1).values as unknown[]).slice(1);
    expect(kepala).toEqual(["No", "Nama", "NISN", "Daya serap (%)", "Jawaban", "Indikator terlemah 1", "Daya serap 1 (%)", "Indikator terlemah 2", "Daya serap 2 (%)"]);
    const nisn = ws.getRow(2).getCell(3).value;
    expect(typeof nisn).toBe("string");
    expect(String(nisn)).toMatch(/^0012/);
    expect(ws.getRow(2).getCell(6).value).toBe("Indikator mat 1 (1)");
  });

  it("nama yang diawali '=' atau '+' disimpan sebagai teks, bukan rumus", async () => {
    const jw = Array.from({ length: 6 }, () => sw("=cmd|' /C calc'!A0", mat(1), 0));
    const d = data(jw);
    d.laporan!.siswaPerhatian[0]!.nama = "=HYPERLINK(\"http://x\")";
    const ws = (await baca(await bangunExcelLaporanSekolah(d, "x"))).getWorksheet("Siswa Perlu Perhatian")!;
    const sel = ws.getRow(2).getCell(2);
    expect(sel.type).toBe(ExcelJS.ValueType.String);
    expect(sel.value).toBe("=HYPERLINK(\"http://x\")");
  });

  it("tanpa soal berindikator resmi: hanya lembar Ringkasan dengan catatan, tanpa galat", async () => {
    const d: DataLaporanSekolah = { sekolah: { id: "s", nama: "SMPN 1" }, mapel: { subjectId: "m", nama: "Matematika", jenjang: "SMP" }, jumlahSiswaMengerjakan: 3, jumlahPercobaan: 3, jumlahPaket: 1, laporan: null };
    const wb = await baca(await bangunExcelLaporanSekolah(d, "Semua waktu"));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Ringkasan"]);
    let ada = false;
    wb.getWorksheet("Ringkasan")!.eachRow((r) => { if (String(r.getCell(2).value).includes("Belum ada soal berindikator resmi")) ada = true; });
    expect(ada).toBe(true);
  });

  it("baris kepala dibekukan dan diberi gaya, agar nyaman untuk data panjang", async () => {
    const d = data(kelas(mat(1), 5));
    const ws = (await baca(await bangunExcelLaporanSekolah(d, "x"))).getWorksheet("Per Indikator")!;
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(ws.getRow(1).font?.bold).toBe(true);
  });
});
