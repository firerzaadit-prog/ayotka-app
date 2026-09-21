import { afterEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/storage", () => ({
  importImagePath: (hash: string, ext: string) => `impor/${hash}.${ext}`,
  publicImageUrl: (path: string) => `https://storage.test/soal-media/${path}`,
}));

import {
  findMarkdownImageUrls,
  mapMarkdownImageUrls,
  parseDriveUrl,
  sisipkanGambar,
  sniffGambar,
} from "@/lib/soal/gambar-format";
import { readSoalSheet } from "@/lib/soal/excel-io";
import { resolveGambar } from "@/lib/soal/resolve-gambar";
import { KOLOM_SOAL } from "@/lib/soal/excel-format";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const PNG2 = Buffer.concat([PNG, Buffer.from([0])]); // isi berbeda -> hash berbeda
const FILE_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

describe("sniffGambar", () => {
  it("mengenali PNG/JPEG/GIF/WEBP dari isinya, menolak selainnya", () => {
    expect(sniffGambar(PNG)?.ext).toBe("png");
    expect(sniffGambar(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.ext).toBe("jpg");
    expect(sniffGambar(Buffer.from("GIF89a....", "latin1"))?.ext).toBe("gif");
    expect(sniffGambar(Buffer.from("RIFF\0\0\0\0WEBP", "latin1"))?.ext).toBe("webp");
    expect(sniffGambar(Buffer.from("<html><body>login</body></html>"))).toBeNull();
    expect(sniffGambar(Buffer.from("%PDF-1.7"))).toBeNull();
  });
});

describe("parseDriveUrl", () => {
  it("mengenali bentuk-bentuk link file Drive", () => {
    expect(parseDriveUrl(`https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing`)).toEqual({ id: FILE_ID });
    expect(parseDriveUrl(`https://drive.google.com/file/u/0/d/${FILE_ID}/view`)).toEqual({ id: FILE_ID });
    expect(parseDriveUrl(`https://drive.google.com/open?id=${FILE_ID}`)).toEqual({ id: FILE_ID });
    expect(parseDriveUrl(`https://drive.google.com/uc?export=view&id=${FILE_ID}`)).toEqual({ id: FILE_ID });
    expect(parseDriveUrl(`https://lh3.googleusercontent.com/d/${FILE_ID}`)).toEqual({ id: FILE_ID });
  });
  it("membedakan link folder, dan bukan-Drive", () => {
    expect(parseDriveUrl(`https://drive.google.com/drive/folders/${FILE_ID}`)).toBe("folder");
    expect(parseDriveUrl("https://contoh.com/gambar.png")).toBeNull();
    expect(parseDriveUrl("bukan url")).toBeNull();
    // host palsu yang menyertakan kata drive.google.com tidak boleh lolos
    expect(parseDriveUrl(`https://drive.google.com.evil.test/file/d/${FILE_ID}/view`)).toBeNull();
  });
});

describe("markdown gambar", () => {
  it("menemukan dan mengganti URL gambar di dalam teks", () => {
    const t = "Lihat ![a](https://x.test/1.png) dan ![](https://x.test/2.png).";
    expect(findMarkdownImageUrls(t)).toEqual(["https://x.test/1.png", "https://x.test/2.png"]);
    expect(mapMarkdownImageUrls(t, (u) => u.replace("x.test", "y.test"))).toBe(
      "Lihat ![a](https://y.test/1.png) dan ![](https://y.test/2.png).",
    );
  });
});

describe("sisipkanGambar (penanda posisi)", () => {
  it("[gambar] diganti di posisinya, di tengah kalimat", () => {
    expect(sisipkanGambar("Perhatikan [gambar] lalu hitung luasnya.", ["U1"])).toEqual({
      teks: "Perhatikan ![](U1) lalu hitung luasnya.",
    });
  });
  it("penanda bernomor & tanpa nomor, urutan dihormati", () => {
    expect(sisipkanGambar("A [gambar 2] B [gambar 1]", ["U1", "U2"])).toEqual({ teks: "A ![](U2) B ![](U1)" });
    expect(sisipkanGambar("A [gambar] B [gambar]", ["U1", "U2"])).toEqual({ teks: "A ![](U1) B ![](U2)" });
    // tanpa nomor tidak boleh mencuri gambar yang sudah dipesan nomor eksplisit
    expect(sisipkanGambar("[gambar 1] dan [gambar]", ["U1", "U2"])).toEqual({ teks: "![](U1) dan ![](U2)" });
  });
  it("gambar tanpa penanda dilekatkan di akhir; sel kosong hanya berisi gambar", () => {
    expect(sisipkanGambar("Soal ini", ["U1"])).toEqual({ teks: "Soal ini\n![](U1)" });
    expect(sisipkanGambar("", ["U1", "U2"])).toEqual({ teks: "![](U1)\n![](U2)" });
    expect(sisipkanGambar("A [gambar 1] B", ["U1", "U2"])).toEqual({ teks: "A ![](U1) B\n![](U2)" });
  });
  it("penanda tanpa gambar = kesalahan yang jelas", () => {
    expect(sisipkanGambar("Lihat [gambar]", [])).toHaveProperty("error");
    expect(sisipkanGambar("Lihat [gambar 3]", ["U1"])).toHaveProperty("error");
  });
});

/** Buat file .xlsx dengan header standar + satu baris soal; `pasang` menempel gambar sesuai kebutuhan tes. */
async function buatXlsx(
  isiBaris: Record<string, string>,
  pasang: (ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook, col: (key: string) => number) => void,
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Soal");
  ws.addRow(KOLOM_SOAL.map((k) => k.header));
  const idx = (key: string) => KOLOM_SOAL.findIndex((k) => k.key === key);
  const r = KOLOM_SOAL.map((k) => isiBaris[k.key] ?? "");
  ws.addRow(r);
  pasang(ws, wb, (key) => idx(key));
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

const tempel = (wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, buf: Buffer, col0: number, row0: number) => {
  const id = wb.addImage({ buffer: buf as unknown as ExcelJS.Buffer, extension: "png" });
  ws.addImage(id, { tl: { col: col0 + 0.1, row: row0 + 0.1 }, ext: { width: 40, height: 40 } });
};

describe("readSoalSheet - gambar tempelan", () => {
  it("gambar dipetakan ke sel (baris & kolom) tempat pojok kirinya berada", async () => {
    const buf = await buatXlsx({ no: "1", teks: "Lihat [gambar]" }, (ws, wb, col) => {
      tempel(wb, ws, PNG, col("teks"), 1); // baris 2 (0-based 1), kolom Teks Soal
      tempel(wb, ws, PNG2, col("opsi_b"), 1);
    });
    const res = await readSoalSheet(buf);
    expect(res.gambarBermasalah).toEqual([]);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]!.gambar.teks).toHaveLength(1);
    expect(res.rows[0]!.gambar.opsi_b).toHaveLength(1);
    expect(res.rows[0]!.gambar.opsi_a).toBeUndefined();
  });

  it("gambar di kolom yang tidak bisa berisi gambar dilaporkan, tidak dibuang diam-diam", async () => {
    const buf = await buatXlsx({ no: "1", teks: "Soal" }, (ws, wb, col) => {
      tempel(wb, ws, PNG, col("kunci"), 1); // kolom Kunci Jawaban
      tempel(wb, ws, PNG, col("no"), 1); // kolom No
    });
    const res = await readSoalSheet(buf);
    expect(res.gambarBermasalah.map((e) => e.kolom).sort()).toEqual(["Kunci Jawaban", "No"]);
  });

  it("gambar di baris yang jauh di bawah data tetap terbaca sebagai baris (tidak hilang diam-diam)", async () => {
    const buf = await buatXlsx({ no: "1", teks: "Soal" }, (ws, wb, col) => tempel(wb, ws, PNG, col("teks"), 5));
    const res = await readSoalSheet(buf);
    const tercatat = res.rows.some((r) => r.row === 6) || res.gambarBermasalah.some((e) => e.row === 6);
    expect(tercatat).toBe(true);
  });

  it("baris yang hanya berisi gambar tetap dianggap baris soal (diperiksa validasinya)", async () => {
    const buf = await buatXlsx({}, (ws, wb, col) => tempel(wb, ws, PNG, col("opsi_a"), 1));
    const res = await readSoalSheet(buf);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]!.gambar.opsi_a).toHaveLength(1);
  });
});

describe("resolveGambar", () => {
  afterEach(() => vi.unstubAllGlobals());

  const baris = (cells: Record<string, string>, gambar: Record<string, Buffer[]> = {}) => ({
    row: 2,
    cells,
    gambar: Object.fromEntries(Object.entries(gambar).map(([k, v]) => [k, v.map((buffer) => ({ buffer }))])),
  });

  it("gambar tempelan: URL deterministik dari isi gambar, disisipkan di posisi penanda", async () => {
    const a = await resolveGambar([baris({ teks: "Lihat [gambar] ya" }, { teks: [PNG] })] as never);
    const b = await resolveGambar([baris({ teks: "Lihat [gambar] ya" }, { teks: [PNG] })] as never);
    expect(a.errors).toEqual([]);
    expect(a.rows[0]!.cells.teks).toMatch(/^Lihat !\[\]\(https:\/\/storage\.test\/soal-media\/impor\/[0-9a-f]{64}\.png\) ya$/);
    expect(a.rows[0]!.cells.teks).toBe(b.rows[0]!.cells.teks); // impor ulang -> teks identik -> dedupe jalan
    expect(a.tertunda.size).toBe(1);
  });

  it("gambar tempelan di Media Soal menjadi URL; dua gambar / gambar+teks ditolak", async () => {
    const ok = await resolveGambar([baris({ media: "" }, { media: [PNG] })] as never);
    expect(ok.rows[0]!.cells.media).toMatch(/^https:\/\/storage\.test\/soal-media\/impor\/.+\.png$/);
    const dua = await resolveGambar([baris({ media: "" }, { media: [PNG, PNG2] })] as never);
    expect(dua.errors[0]?.pesan).toMatch(/hanya boleh berisi 1 gambar/);
    const campur = await resolveGambar([baris({ media: "https://x.test/a.png" }, { media: [PNG] })] as never);
    expect(campur.errors[0]?.pesan).toMatch(/DAN teks/);
  });

  it("file tempelan yang bukan gambar didukung ditolak dengan pesan jelas", async () => {
    const r = await resolveGambar([baris({ teks: "x" }, { teks: [Buffer.from("bukan gambar sama sekali")] })] as never);
    expect(r.errors[0]?.pesan).toMatch(/bukan PNG\/JPEG\/WEBP\/GIF/);
  });

  it("link Drive di Media Soal & di dalam ![](...) diunduh lalu diganti URL sistem", async () => {
    const fetchMock = vi.fn(async (u: string) => {
      expect(u).toContain("drive.google.com/uc");
      return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const link = `https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing`;
    const r = await resolveGambar([baris({ media: link, teks: `Awal ![](${link}) akhir` })] as never);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]!.cells.media).toMatch(/^https:\/\/storage\.test\//);
    expect(r.rows[0]!.cells.teks).toMatch(/^Awal !\[\]\(https:\/\/storage\.test\/.+\.png\) akhir$/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // link yang sama hanya diunduh sekali
    expect(r.tertunda.size).toBe(1);
  });

  it("Drive mengembalikan halaman web (file tidak dibagikan) -> kesalahan yang menyebut cara memperbaiki", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Sign in</html>", { status: 200, headers: { "content-type": "text/html" } })));
    const r = await resolveGambar([baris({ media: `https://drive.google.com/open?id=${FILE_ID}` })] as never);
    expect(r.errors[0]?.kolom).toBe("Media Soal");
    expect(r.errors[0]?.pesan).toMatch(/bukan gambar/);
  });

  it("pengalihan ke host di luar Google ditolak (tidak diikuti)", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveGambar([baris({ media: `https://drive.google.com/open?id=${FILE_ID}` })] as never);
    expect(r.errors[0]?.pesan).toMatch(/tidak bisa diakses/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("link folder Drive ditolak; link non-Drive dibiarkan apa adanya", async () => {
    const f = await resolveGambar([baris({ media: `https://drive.google.com/drive/folders/${FILE_ID}` })] as never);
    expect(f.errors[0]?.pesan).toMatch(/FOLDER/);
    const lain = await resolveGambar([baris({ media: "https://contoh.test/a.png" })] as never);
    expect(lain.errors).toEqual([]);
    expect(lain.rows[0]!.cells.media).toBe("https://contoh.test/a.png");
  });
});
