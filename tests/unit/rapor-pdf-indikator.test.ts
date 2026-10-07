import PDFDocument from "pdfkit";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { renderRaporPdf } from "@/lib/pdf/rapor-renderer";
import { hitungLaporanSiswa, type InfoIndikator, type JawabanBerindikator } from "@/lib/indikator/daya-serap";

const mat = (n: number, o: Partial<InfoIndikator> = {}): InfoIndikator => ({
  id: `m${n}`,
  jenjang: "SMP",
  namaMapel: "Matematika",
  elemen: n <= 5 ? "Bilangan" : n <= 9 ? "Aljabar" : "Geometri dan Pengukuran",
  subelemen: n <= 5 ? "Bilangan Real" : n <= 9 ? "Persamaan Linear" : "Bangun Datar",
  kompetensi: "Kemampuan memahami dan mengaplikasikan konsep untuk menyelesaikan permasalahan",
  indikator: `Menyelesaikan masalah kontekstual nomor ${n} (${n})`,
  urutan: n,
  nilaiNasional: 20 + n * 4.5,
  ...o,
});
const bin = (n: number, o: Partial<InfoIndikator> = {}): InfoIndikator => ({
  id: `b${n}`,
  jenjang: "SMP",
  namaMapel: "Bahasa Indonesia",
  elemen: n <= 10 ? "Pemahaman Tekstual" : n <= 20 ? "Pemahaman Inferensial" : "Evaluasi dan Apresiasi",
  subelemen: `Subkompetensi ${Math.ceil(n / 3)} dalam berbagai jenis teks`,
  kompetensi: `Subkompetensi ${Math.ceil(n / 3)} dalam berbagai jenis teks`,
  indikator: `Menentukan informasi penting pada teks nomor ${n} beserta alasan pendukungnya (${n})`,
  urutan: n,
  nilaiNasional: 30 + ((n * 2.3) % 40),
  ...o,
});

const jawab = (ind: InfoIndikator | null, skor: number): JawabanBerindikator => ({ indikator: ind, skor, skorMaks: 1 });

const hasilDasar = (indikator: ReturnType<typeof hitungLaporanSiswa> | undefined) => ({
  attempt: { id: "a1", status: "selesai", skorMentah: 20, skorAkhir: 64.5, mulaiAt: new Date(), selesaiAt: new Date() },
  package: { nama: "Try Out Uji" },
  siswa: { nama: "SISWA UJI", idSamar: "008***42" },
  canShowPembahasan: true,
  isFreeTrial: false,
  analisisAiDiminta: false,
  bisaUnduhRapor: true,
  ranking: null,
  elemenScores: [{ elemenNama: "Bilangan", jmlBenar: 5, jmlSoal: 10, persentase: 50 }],
  perSoal: [
    {
      questionId: "q1",
      format: "pg",
      teks: "Berapa 2 + 2?",
      skor: 1,
      skorMaks: 1,
      jawabanJson: { option_id: "o1" },
      options: [
        { id: "o1", label: "A", teks: "4", isCorrect: true },
        { id: "o2", label: "B", teks: "5", isCorrect: false },
      ],
      pembahasan: "Dua tambah dua sama dengan empat.",
    },
  ],
  indikator,
});

/** Render ke PDF sungguhan (pdfkit murni JS) dan kembalikan semua teks yang digambar + jumlah halaman. */
async function render(hasil: ReturnType<typeof hasilDasar>) {
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const teks: string[] = [];
  const asli = doc.text.bind(doc);
  vi.spyOn(doc, "text").mockImplementation(((...args: unknown[]) => {
    if (typeof args[0] === "string") teks.push(args[0]);
    return (asli as (...a: unknown[]) => unknown)(...args);
  }) as never);
  const potongan: Buffer[] = [];
  doc.on("data", (c: Buffer) => potongan.push(c));
  const selesai = new Promise<void>((r) => doc.on("end", () => r()));
  await renderRaporPdf(doc, hasil as never, null, null);
  const halaman = doc.bufferedPageRange().count;
  doc.end();
  await selesai;
  const pdf = Buffer.concat(potongan);
  return { teks, halaman, pdf, gabung: teks.join("\n") };
}

describe("PDF rapor: Daya Serap per Indikator", () => {
  it("Matematika: hierarki 4 tingkat, daya serap, pembanding nasional, dan vonis kelompok tergambar", async () => {
    const jw: JawabanBerindikator[] = [];
    for (let n = 1; n <= 12; n++) for (let k = 0; k < 3; k++) jw.push(jawab(mat(n), (n + k) % 3 === 0 ? 0 : 1));
    const lap = hitungLaporanSiswa(jw)!;
    const r = await render(hasilDasar(lap));
    expect(r.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(r.gabung).toContain("Daya Serap per Indikator");
    expect(r.gabung).toContain("Matematika");
    expect(r.gabung).toContain("Elemen > Subelemen > Kompetensi > Indikator");
    expect(r.gabung).toContain("Elemen: Bilangan");
    expect(r.gabung).toContain("Elemen: Aljabar");
    expect(r.gabung).toMatch(/nas\. \d+,\d%/);
    expect(r.gabung).toContain("Menyelesaikan masalah kontekstual nomor 1 (1)");
    expect(r.gabung).toMatch(/rerata nasional \d+,\d%/);
    expect(r.gabung).toContain("Prioritas belajar");
    expect(r.gabung).toContain("Kekuatan");
    expect(r.gabung).toMatch(/Di atas rerata nasional|Perlu penguatan|Setara rerata nasional/);
  });

  it("Bahasa Indonesia: 3 tingkat dan TIDAK PERNAH menampilkan label Elemen atau Subelemen (aturan Pusmendik)", async () => {
    const jw: JawabanBerindikator[] = [];
    for (let n = 1; n <= 30; n++) for (let k = 0; k < 2; k++) jw.push(jawab(bin(n), (n + k) % 3 === 0 ? 0 : 1));
    const lap = hitungLaporanSiswa(jw)!;
    const r = await render(hasilDasar(lap));
    expect(r.gabung).toContain("Kompetensi > Subkompetensi > Indikator");
    expect(r.gabung).toContain("Kompetensi: Pemahaman Tekstual");
    expect(r.gabung).toContain("Kompetensi: Evaluasi dan Apresiasi");
    // satu-satunya "Elemen" yang boleh ada di PDF ini berasal dari Peta Kompetensi lama (elemenScores), bukan dari bagian indikator
    const bagianIndikator = r.teks.slice(r.teks.indexOf("Daya Serap per Indikator"), r.teks.indexOf("Rincian Jawaban"));
    expect(bagianIndikator.join("\n")).not.toMatch(/Elemen|Subelemen/);
  });

  it("tanpa data indikator (null/tidak ada): bagian itu tidak digambar dan hasilnya sama dengan sebelum fitur ada", async () => {
    const a = await render(hasilDasar(null));
    const b = await render(hasilDasar(undefined));
    expect(a.gabung).not.toContain("Daya Serap per Indikator");
    expect(b.gabung).not.toContain("Daya Serap per Indikator");
    expect(a.halaman).toBe(b.halaman);
    expect(a.teks).toEqual(b.teks);
  });

  it("laporan penuh 30 indikator tidak membuat halaman kosong berantai (jumlah halaman wajar) dan catatan tidak terpisah sendirian", async () => {
    const jw: JawabanBerindikator[] = [];
    for (let n = 1; n <= 30; n++) for (let k = 0; k < 2; k++) jw.push(jawab(bin(n), (n + k) % 3 === 0 ? 0 : 1));
    const r = await render(hasilDasar(hitungLaporanSiswa(jw)!));
    expect(r.halaman).toBeLessThanOrEqual(5);
    // catatan cara membaca ada di PENGANTAR, sebelum kelompok pertama (bukan di akhir tempat ia pernah terlempar ke halaman baru)
    const iCatatan = r.teks.findIndex((t) => t.startsWith("Daya serap = skor yang diperoleh"));
    const iKelompok = r.teks.findIndex((t) => t.startsWith("Kompetensi: Pemahaman Tekstual"));
    expect(iCatatan).toBeGreaterThan(-1);
    expect(iCatatan).toBeLessThan(iKelompok);
  });

  it("kelompok dengan sedikit soal ditandai 'Data belum cukup', bukan diberi vonis", async () => {
    const lap = hitungLaporanSiswa([jawab(mat(1), 1), jawab(mat(2), 0), ...[6, 6, 6, 7].map((n) => jawab(mat(n), 1))])!;
    const r = await render(hasilDasar(lap));
    expect(r.gabung).toContain("Data belum cukup");
    expect(r.gabung).toContain("minimal 3 untuk dibandingkan");
  });

  it("indikator tanpa rerata nasional tampil '-' dan kelompoknya 'Tanpa pembanding nasional'", async () => {
    const lap = hitungLaporanSiswa([1, 2, 3, 4].map((k) => jawab(mat(1, { nilaiNasional: null }), k % 2)))!;
    const r = await render(hasilDasar(lap));
    expect(r.gabung).toContain("Tanpa pembanding nasional");
    expect(r.teks).toContain("-");
  });

  it("indikator yang sangat panjang tidak menimpa kolom di kanannya dan tidak menggagalkan render", async () => {
    const panjang = "Menentukan " + "informasi penting yang sangat panjang ".repeat(40) + "(1)";
    const lap = hitungLaporanSiswa([1, 2, 3, 4].map((k) => jawab(mat(1, { indikator: panjang }), k % 2)))!;
    const r = await render(hasilDasar(lap));
    expect(r.halaman).toBeGreaterThanOrEqual(1);
    expect(r.gabung).toContain("Menentukan informasi penting");
  });

  it("kepala kelompok TIDAK PERNAH tertinggal sendirian di dasar halaman (selalu diikuti baris pertamanya), di banyak variasi panjang", async () => {
    const urutanKejadian = async (banyak: number) => {
      const jw: JawabanBerindikator[] = [];
      for (let n = 1; n <= banyak; n++) for (let k = 0; k < 2; k++) jw.push(jawab(bin(n, { elemen: n <= Math.ceil(banyak / 3) ? "Pemahaman Tekstual" : n <= Math.ceil((2 * banyak) / 3) ? "Pemahaman Inferensial" : "Evaluasi dan Apresiasi" }), (n + k) % 3 === 0 ? 0 : 1));
      const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
      const kejadian: string[] = [];
      const teksAsli = doc.text.bind(doc);
      const tambahAsli = doc.addPage.bind(doc);
      vi.spyOn(doc, "text").mockImplementation(((...a: unknown[]) => {
        if (typeof a[0] === "string") kejadian.push("T:" + a[0]);
        return (teksAsli as (...x: unknown[]) => unknown)(...a);
      }) as never);
      vi.spyOn(doc, "addPage").mockImplementation(((...a: unknown[]) => {
        kejadian.push("HALAMAN");
        return (tambahAsli as (...x: unknown[]) => unknown)(...a);
      }) as never);
      doc.on("data", () => undefined);
      await renderRaporPdf(doc, hasilDasar(hitungLaporanSiswa(jw)!) as never, null, null);
      doc.end();
      return kejadian;
    };
    let adaPindahHalamanDiTengah = 0;
    for (let banyak = 6; banyak <= 21; banyak++) {
      const k = await urutanKejadian(banyak);
      k.forEach((e, i) => {
        if (!e.startsWith("T:Kompetensi: ")) return;
        // sesudah kepala kelompok, sebelum pindah halaman berikutnya, harus ada teks indikator (baris pertama)
        const berikut = k.slice(i + 1);
        const iHal = berikut.indexOf("HALAMAN");
        const iBaris = berikut.findIndex((x) => x.startsWith("T:Menentukan informasi penting"));
        expect(iBaris, "banyak=" + banyak + " kepala '" + e + "' tanpa baris pertama").toBeGreaterThan(-1);
        if (iHal !== -1) {
          adaPindahHalamanDiTengah++;
          expect(iBaris, "banyak=" + banyak + ": kepala '" + e + "' terpisah dari baris pertamanya oleh pindah halaman").toBeLessThan(iHal);
        }
      });
    }
    expect(adaPindahHalamanDiTengah).toBeGreaterThan(3); // variasi memang mengenai batas halaman (tes tidak kosong)
  });
});
