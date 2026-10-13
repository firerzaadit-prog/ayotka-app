import PDFDocument from "pdfkit";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ANALISIS_CONTOH, IDENTITAS_CONTOH, buatHasilContoh, pngContoh } from "../helpers/rapor-fixture";
import { renderUji } from "../helpers/pdf-uji";
import { setupFonts } from "@/lib/pdf/pdf-umum";
import { gambarKepala } from "@/lib/pdf/rapor-komponen";
import { X0 } from "@/lib/pdf/indikator-gambar";
import { formatWIBDate } from "@/lib/utils/datetime";

afterEach(() => vi.restoreAllMocks());

const NAMA = "FIRERZA PRADITYA PERDANA";
const LABEL_WATERMARK = `${NAMA} · 008***42`;

describe("PDF rapor: kartu identitas", () => {
  it("memuat nama, asal sekolah, jenis Try Out, mata pelajaran, nama paket, kode soal, tanggal dan waktu ujian", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 4 }), { identitas: IDENTITAS_CONTOH });
    for (const label of ["NAMA SISWA", "ASAL SEKOLAH", "JENIS TRY OUT", "MATA PELAJARAN", "NAMA PAKET", "KODE SOAL", "TANGGAL UJIAN", "WAKTU PENGERJAAN"]) {
      expect(r.teks, label).toContain(label);
    }
    expect(r.teks).toContain(NAMA);
    expect(r.teks).toContain("ID Peserta 008***42");
    expect(r.teks).toContain("SDN Sukun 3 Malang");
    expect(r.teks).toContain("Try Out Mandiri");
    expect(r.teks).toContain("Matematika · SD");
    expect(r.teks).toContain("Try Out Matematika SD - Paket 1");
    expect(r.teks).toContain("MAT-SD-PT1");
    // 08.38 UTC = 15.38 WIB (hari Senin 12 Oktober 2026), selesai 09.12 UTC = 16.12 WIB, 34 menit
    expect(r.teks).toContain("Senin, 12 Oktober 2026");
    expect(r.teks).toContain("15.38 - 16.12 WIB (34 menit)");
  });

  it("tiga jenis Try Out tampil sesuai (mandiri, sekolah, nasional) di kartu dan di lencana kepala (huruf besar)", async () => {
    for (const [jenis, label] of [["mandiri", "Try Out Mandiri"], ["sekolah", "Try Out Sekolah"], ["nasional", "Try Out Nasional"]] as const) {
      const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2 }), { identitas: { ...IDENTITAS_CONTOH, jenisTryOut: jenis } });
      expect(r.teks, jenis).toContain(label);
      expect(r.teks, jenis).toContain(label.toUpperCase());
    }
  });

  it("tanpa identitas (pemanggil lama): bagian yang tidak diketahui ditulis '-', rapor tetap jadi, tanpa lencana jenis", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2 }));
    expect(r.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(r.teks.filter((t) => t === "-").length).toBeGreaterThanOrEqual(4); // asal sekolah, jenis, mata pelajaran, kode soal
    expect(r.teks).toContain(NAMA);
    expect(r.teks).toContain("Try Out Matematika SD - Paket 1");
    expect(r.teks).not.toContain("TRY OUT MANDIRI");
    // tanggal dan waktu tetap dari percobaan itu sendiri
    expect(r.teks).toContain("Senin, 12 Oktober 2026");
  });

  it("asal sekolah kosong (null): ditulis '-'; kode soal dari ID paket bila bukan hasil impor", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2 }), { identitas: { ...IDENTITAS_CONTOH, asalSekolah: null, kodeSoal: "PKT-1A2B3C4D" } });
    expect(r.teks).toContain("PKT-1A2B3C4D");
    expect(r.teks.filter((t) => t === "-").length).toBeGreaterThanOrEqual(1);
  });

  it("tanpa waktu selesai: hanya jam mulai ('mulai 15.38 WIB'), tidak 'NaN' atau 'Invalid'", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 2 });
    (hasil.attempt as { selesaiAt: Date | null }).selesaiAt = null;
    const r = await renderUji(hasil, { identitas: { ...IDENTITAS_CONTOH, selesaiAt: null } });
    expect(r.teks).toContain("mulai 15.38 WIB");
    expect(r.gabung).not.toMatch(/NaN|Invalid|undefined|null/);
  });

  it("teks identitas yang sangat panjang dipotong dan tidak menggagalkan rapor", async () => {
    const panjang = "SMP Negeri Contoh dengan Nama yang Sangat Panjang Sekali ".repeat(30);
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2, nama: "NAMA SISWA YANG SANGAT PANJANG ".repeat(20), namaPaket: panjang }), { identitas: { ...IDENTITAS_CONTOH, asalSekolah: panjang } });
    expect(r.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(r.halaman).toBeLessThanOrEqual(4);
    const sekolah = r.teks.find((t) => t.startsWith("SMP Negeri Contoh"))!;
    expect(sekolah.length).toBeLessThanOrEqual(160);
    expect(sekolah.endsWith("…")).toBe(true);
  });

  it("tanggal cetak tanpa akhiran 'WIB' dan memakai tanggal hari ini", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2 }));
    const dicetak = r.teks.find((t) => t.startsWith("Dicetak "))!;
    expect(dicetak).toBe(`Dicetak ${formatWIBDate(new Date()).replace(/ WIB$/, "")}`);
    expect(dicetak).not.toContain("WIB");
  });
});

describe("PDF rapor: kepala halaman dan logo", () => {
  /** Menggambar kepala halaman dan mengembalikan posisi x tempat teks merek "AyoTKA" ditulis. */
  async function xMerek(logo: Buffer | null): Promise<{ x: number; gambar: number }> {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const fonts = setupFonts(doc);
    const teksAsli = doc.text.bind(doc);
    let x = Number.NaN;
    vi.spyOn(doc, "text").mockImplementation(((...args: unknown[]) => {
      if (args[0] === "AyoTKA") x = args[1] as number;
      return (teksAsli as (...a: unknown[]) => unknown)(...args);
    }) as never);
    const gambarAsli = doc.image.bind(doc);
    let gambar = 0;
    vi.spyOn(doc, "image").mockImplementation(((...args: unknown[]) => {
      const hasil = (gambarAsli as (...a: unknown[]) => unknown)(...args);
      gambar++;
      return hasil;
    }) as never);
    gambarKepala(doc, fonts, { logo, jenisLabel: null, subjudul: null, dicetak: "13 Oktober 2026" });
    doc.end();
    return { x, gambar };
  }

  it("dengan logo: merek bergeser ke kanan logo; tanpa logo atau logo rusak: merek di tepi kiri tanpa ruang kosong", async () => {
    const logoSah = Buffer.from((await pngContoh(60, 60)).split(",")[1]!, "base64");
    expect(await xMerek(logoSah)).toEqual({ x: X0 + 46, gambar: 1 });
    expect(await xMerek(null)).toEqual({ x: X0, gambar: 0 });
    // bukan gambar sama sekali: pdfkit gagal membukanya, rapor tetap jadi
    expect((await xMerek(Buffer.from("bukan gambar, hanya teks biasa"))).x).toBe(X0);
  });
});

describe("PDF rapor: informasi dokumen", () => {
  it("judul memuat nama siswa; penulis AyoTKA; subjek nama paket", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2 }), { identitas: IDENTITAS_CONTOH });
    expect(r.info.Title).toBe(`Rapor Hasil Ujian - ${NAMA}`);
    expect(r.info.Author).toBe("AyoTKA");
    expect(r.info.Creator).toBe("AyoTKA");
    expect(r.info.Subject).toBe("Try Out Matematika SD - Paket 1");
  });

  it("nama atau paket yang sangat panjang dipotong di informasi dokumen", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 1, nama: "N".repeat(400), namaPaket: "P".repeat(400) }));
    expect(String(r.info.Title).length).toBeLessThanOrEqual("Rapor Hasil Ujian - ".length + 80);
    expect(String(r.info.Subject).length).toBeLessThanOrEqual(120);
  });
});

describe("PDF rapor: ringkasan nilai", () => {
  it("nilai dibulatkan seperti halaman web (tanpa desimal), jawaban benar, dan status", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 12, skorAkhir: 72.5 }));
    expect(r.teks).toContain("73");
    expect(r.teks).toContain("8 / 12");
    expect(r.teks).toContain("67% soal benar");
    expect(r.teks).toContain("Selesai");
    expect(r.teks).toContain("dikumpulkan");
  });

  it("waktu habis (kedaluwarsa): status 'Waktu habis' dan keterangan dikumpulkan otomatis", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 3, status: "kedaluwarsa" }));
    expect(r.teks).toContain("Waktu habis");
    expect(r.teks).toContain("dikumpulkan otomatis");
    expect(r.teks).not.toContain("Selesai");
  });

  it("nilai belum ada: '-' bukan 'null' atau 'NaN'", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 3, skorAkhir: null }));
    expect(r.gabung).not.toMatch(/NaN|null|undefined/);
    expect(r.teks).toContain("-");
  });

  it("Try Out Nasional: PDF TIDAK memuat peringkat (berubah-ubah; potret tetap) dan nama peserta lain tidak pernah dicetak", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 3, ranking: true });
    hasil.ranking = {
      peringkatSaya: 3,
      totalPeserta: 45,
      papan: [
        { peringkat: 1, nama: "PESERTA LAIN SATU", skor: 98, andaSendiri: false },
        { peringkat: 2, nama: "PESERTA LAIN DUA", skor: 90, andaSendiri: false },
        { peringkat: 3, nama: NAMA, skor: 73, andaSendiri: true },
      ],
    };
    const r = await renderUji(hasil, { identitas: { ...IDENTITAS_CONTOH, jenisTryOut: "nasional" } });
    expect(r.teks).not.toContain("PERINGKAT");
    expect(r.teks).not.toContain("#3");
    expect(r.gabung).not.toContain("dari 45 peserta");
    expect(r.gabung).not.toContain("PESERTA LAIN");
    // ringkasan nilai tetap tiga kotak: nilai akhir, jawaban benar, status
    for (const label of ["NILAI AKHIR", "JAWABAN BENAR", "STATUS"]) expect(r.teks, label).toContain(label);
  });

  it("selain Try Out Nasional: juga tanpa kotak peringkat", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 3 }));
    expect(r.teks).not.toContain("PERINGKAT");
  });

  it("catatan skor tertimbang muncul hanya bila nilai akhir berbeda dari persentase soal benar lebih dari 1 poin", async () => {
    const beda = await renderUji(await buatHasilContoh({ jumlahSoal: 12, skorAkhir: 72.5 }));
    expect(beda.gabung).toContain("Nilai Akhir adalah skor tertimbang");
    const sama = await renderUji(await buatHasilContoh({ jumlahSoal: 12, skorAkhir: 66.7 }));
    expect(sama.gabung).not.toContain("Nilai Akhir adalah skor tertimbang");
  });
});

describe("PDF rapor: footer dan watermark (watermark hanya di PDF)", () => {
  it("setiap halaman punya footer 'Halaman N dari M' dengan nama siswa", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 20 }), { identitas: IDENTITAS_CONTOH });
    expect(r.halaman).toBeGreaterThan(2);
    for (let i = 1; i <= r.halaman; i++) expect(r.teks, `halaman ${i}`).toContain(`Halaman ${i} dari ${r.halaman}`);
    expect(r.teks.filter((t) => t === `AyoTKA · Rapor Hasil Ujian · ${NAMA}`)).toHaveLength(r.halaman);
  });

  it("nama siswa yang panjang dipotong di footer supaya tetap satu baris", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 3, nama: "MUHAMMAD ABDURRAHMAN AL-FARISI BIN ABDULLAH NASIRUDDIN" }));
    const footer = r.teks.filter((t) => t.startsWith("AyoTKA · Rapor Hasil Ujian · "));
    expect(footer).toHaveLength(r.halaman);
    for (const f of footer) {
      expect(f.replace("AyoTKA · Rapor Hasil Ujian · ", "").length).toBeLessThanOrEqual(34);
      expect(f.endsWith("…")).toBe(true);
    }
  });

  it("watermark (nama · ID samar) digambar berulang di SETIAP halaman, di langkah akhir (di atas isi)", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 10 }), { identitas: IDENTITAS_CONTOH });
    const jumlah = r.teks.filter((t) => t === LABEL_WATERMARK).length;
    expect(jumlah).toBeGreaterThanOrEqual(r.halaman * 40);
    // semua watermark tergambar sesudah isi terakhir (Rincian Jawaban), bukan di tengah isi
    const iWatermarkPertama = r.kejadian.indexOf(`T:${LABEL_WATERMARK}`);
    const iRincian = r.kejadian.indexOf("T:Rincian Jawaban");
    expect(iRincian).toBeGreaterThan(-1);
    expect(iWatermarkPertama).toBeGreaterThan(iRincian);
    // jumlah ubin per halaman sama (satu pola untuk semua halaman)
    expect(jumlah % r.halaman).toBe(0);
  });

  it("watermark dengan nama sangat panjang: ubin dalam satu baris tidak saling bertumpuk", async () => {
    const nama = "MUHAMMAD ALFARIZQI RAMADHAN PUTRA WIJAYA KUSUMA NEGARA";
    const label = `${nama} · 008***42`;
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 2, nama }));
    const ukur = new PDFDocument({ size: "A4" });
    const fonts = setupFonts(ukur);
    ukur.font(fonts.regular).fontSize(9);
    const lebarTeks = ukur.widthOfString(label);
    expect(lebarTeks).toBeGreaterThan(190); // lebar ubin lama: tanpa penyesuaian, ubin akan bertumpuk
    const ubin = r.panggilan.filter((a) => a[0] === label) as Array<[string, number, number]>;
    expect(ubin.length).toBeGreaterThan(0);
    const perBaris = new Map<number, number[]>();
    for (const [, x, y] of ubin) perBaris.set(y, [...(perBaris.get(y) ?? []), x]);
    let barisBerisiBanyak = 0;
    for (const xs of perBaris.values()) {
      // pola yang sama diulang di setiap halaman, jadi koordinat yang kembar (halaman lain) dibuang
      const urut = [...new Set(xs)].sort((a, b) => a - b);
      if (urut.length > 1) barisBerisiBanyak++;
      // jarak antar ubin = lebar teks + celah (tidak hanya bersentuhan)
      for (let i = 1; i < urut.length; i++) expect(urut[i]! - urut[i - 1]!, "jarak antar ubin harus melebihi lebar teks dengan celah").toBeGreaterThanOrEqual(lebarTeks + 30);
    }
    expect(barisBerisiBanyak).toBeGreaterThan(0);
  });

  it("ID samar yang kosong tidak menggagalkan watermark atau footer", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 2 });
    hasil.siswa.idSamar = "";
    const r = await renderUji(hasil);
    expect(r.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(r.teks).not.toContain("ID Peserta ");
  });
});

describe("PDF rapor: urutan bagian mengikuti halaman web", () => {
  it("nilai, Peta Kompetensi, Daya Serap per Indikator, Analisis Learning Analytics, lalu Rincian Jawaban", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 4 }), { analisis: ANALISIS_CONTOH, identitas: IDENTITAS_CONTOH });
    const urut = ["NILAI AKHIR", "Peta Kompetensi", "Daya Serap per Indikator", "Analisis Learning Analytics", "Rincian Jawaban"].map((t) => r.teks.indexOf(t));
    for (const i of urut) expect(i).toBeGreaterThan(-1);
    expect([...urut].sort((a, b) => a - b)).toEqual(urut);
  });
});
