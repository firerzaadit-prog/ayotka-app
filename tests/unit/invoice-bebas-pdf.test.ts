import PDFDocument from "pdfkit";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Merender banyak PDF (sampai 30 baris dengan teks panjang): sendirian cepat, tetapi saat seluruh suite berjalan paralel dan
// mesin sibuk batas bawaan 20 detik pernah terlewati. Batas longgar supaya tidak gagal hanya karena beban mesin.
vi.setConfig({ testTimeout: 90_000 });

import { muatAsetInvoice, renderInvoicePdf, type SpesifikasiInvoice } from "@/lib/pdf/invoice-sekolah-renderer";
import { invoiceBebasSchema, isianAwalInvoiceBebas, susunSpesifikasiBebas, type InvoiceBebasForm, type InvoiceBebasInput } from "@/lib/invoice/bebas";
import { IDENTITAS_INVOICE } from "@/lib/pdf/invoice-identitas";

/** Isian sah dengan perubahan seperlunya. Tanggal tetap supaya hasilnya tidak bergantung pada hari tes dijalankan. */
function isian(ubah: (f: InvoiceBebasForm) => void = () => {}): InvoiceBebasInput {
  const f = isianAwalInvoiceBebas(new Date("2026-10-16T03:00:00.000Z"));
  f.penerima = { nama: "MTsN 1 Kediri", alamat: "Jl. Stadion Canda Bhirawa 01, Pare, Kediri", up: "Bendahara" };
  ubah(f);
  return invoiceBebasSchema.parse(f);
}

type Gambar = { halaman: number; teks: string; y: number };
type Hasil = { teks: Gambar[]; halaman: number; jumlahGambar: number; pdf: Buffer };

/** Merender dan mencatat setiap teks yang digambar (beserta halaman dan posisi y) dan jumlah gambar. */
async function render(spec: SpesifikasiInvoice): Promise<Hasil> {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  const teks: Gambar[] = [];
  let jumlahGambar = 0;
  const halamanSaatIni = () => doc.bufferedPageRange().count;
  const asliTeks = doc.text.bind(doc);
  doc.text = ((...args: unknown[]) => {
    if (typeof args[0] === "string") teks.push({ halaman: halamanSaatIni(), teks: args[0], y: Number(args[2]) });
    return (asliTeks as (...a: unknown[]) => unknown)(...args);
  }) as typeof doc.text;
  const asliGambar = doc.image.bind(doc);
  doc.image = ((...args: unknown[]) => {
    jumlahGambar += 1;
    return (asliGambar as (...a: unknown[]) => unknown)(...args);
  }) as typeof doc.image;
  const potongan: Buffer[] = [];
  doc.on("data", (c: Buffer) => potongan.push(c));
  const selesai = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(potongan))));
  await renderInvoicePdf(doc, spec, await muatAsetInvoice());
  const halaman = halamanSaatIni();
  doc.end();
  return { teks, halaman, jumlahGambar, pdf: await selesai };
}

/** Batas atas garis kaki halaman (pt): semua isi selain kaki harus berada di atasnya. A4 = 841,89 pt. */
const Y_KAKI = 841.89 - (12 * 72) / 25.4 - (18 * 0.75 + Math.max(10.5 * 1.5 * 0.75, 22 * 0.75));

const banyak = (n: number, deskripsi = "Layanan"): InvoiceBebasForm["baris"] =>
  Array.from({ length: n }, (_, i) => ({ deskripsi: `${deskripsi} ${i + 1}`, detail: `Keterangan layanan nomor ${i + 1}`, jumlah: 10 + i, satuan: "siswa", harga: 1_000 * (i + 1) }));

describe("renderInvoicePdf: invoice bebas satu baris", () => {
  it("satu halaman A4 dengan semua bagian desain: judul, nomor, kartu, tabel, terbilang, total, transfer, tanda tangan, kaki", async () => {
    const spec = susunSpesifikasiBebas(isian());
    const r = await render(spec);
    const semua = r.teks.map((t) => t.teks).join("\n");
    expect(r.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(r.halaman).toBe(1);
    for (const potong of ["INVOICE", "No. INV/AYOTKA/2026/X/001", "BELUM DIBAYAR", "DITAGIHKAN KEPADA", "MTsN 1 Kediri", "Up. Bendahara", "Deskripsi layanan", "Paket Sekolah AyoTKA", "100 siswa", "Rp40.000", "Rp4.000.000", "TERBILANG", "Empat juta rupiah", "Subtotal", "Total", "TRANSFER KE", "Bank BNI", "1847488087", "Malang, 16 Oktober 2026", IDENTITAS_INVOICE.penandatangan.nama, IDENTITAS_INVOICE.footer]) {
      expect(semua, potong).toContain(potong);
    }
    expect(semua).not.toContain("PPN");
    // logo kepala + stempel + tanda tangan + logo MaleTech-RG di kaki
    expect(r.jumlahGambar).toBe(4);
  });

  it("PPN aktif: baris PPN dengan tarif dan jumlahnya, total ikut naik, terbilang mengikuti total", async () => {
    const r = await render(susunSpesifikasiBebas(isian((f) => (f.pajak = { aktif: true, persen: 11 }))));
    const semua = r.teks.map((t) => t.teks).join("\n");
    expect(semua).toContain("PPN 11%");
    expect(semua).toContain("Rp440.000");
    expect(semua).toContain("Rp4.440.000");
    expect(semua).toContain("Empat juta empat ratus empat puluh ribu rupiah");
  });

  it("tarif PPN berkoma tampil dengan koma Indonesia (11,5%)", async () => {
    const r = await render(susunSpesifikasiBebas(isian((f) => (f.pajak = { aktif: true, persen: 11.5 }))));
    expect(r.teks.map((t) => t.teks)).toContain("PPN 11,5%");
  });

  it("status lunas: lencana LUNAS dan tanpa baris tanggal lunas (alat asal tidak mencetaknya)", async () => {
    const r = await render(susunSpesifikasiBebas(isian((f) => (f.status = "lunas"))));
    const semua = r.teks.map((t) => t.teks);
    expect(semua).toContain("LUNAS");
    expect(semua).not.toContain("BELUM DIBAYAR");
    expect(semua).not.toContain("Tanggal lunas");
  });

  it("tanda tangan dan stempel dikosongkan: gambar keduanya tidak dibubuhkan, ruangnya tetap ada", async () => {
    const dasar = await render(susunSpesifikasiBebas(isian()));
    const kosongTtd = await render(susunSpesifikasiBebas(isian((f) => (f.pengesahan = { ...f.pengesahan, tandaTangan: false }))));
    const kosongStempel = await render(susunSpesifikasiBebas(isian((f) => (f.pengesahan = { ...f.pengesahan, stempel: false }))));
    const kosongKeduanya = await render(susunSpesifikasiBebas(isian((f) => (f.pengesahan = { ...f.pengesahan, tandaTangan: false, stempel: false }))));
    expect([dasar.jumlahGambar, kosongTtd.jumlahGambar, kosongStempel.jumlahGambar, kosongKeduanya.jumlahGambar]).toEqual([4, 3, 3, 2]);
    // nama penanda tangan tetap tercetak walau tanda tangan dikosongkan (untuk ditandatangani basah)
    expect(kosongKeduanya.teks.map((t) => t.teks)).toContain(IDENTITAS_INVOICE.penandatangan.nama);
  });

  it("penerbit 'Lainnya' tanpa logo: logo kepala tidak digambar; nama dan alamat yang diisi manual tetap tercetak", async () => {
    const r = await render(
      susunSpesifikasiBebas(isian((f) => (f.penerbit = { preset: "custom", nama: "CV Mitra Belajar", alamat: "Jl. Mawar 1\nSurabaya", kode: "INV" }))),
    );
    expect(r.jumlahGambar).toBe(3); // stempel + tanda tangan + logo MaleTech-RG
    const semua = r.teks.map((t) => t.teks);
    expect(semua).toContain("CV Mitra Belajar");
    expect(semua).toContain("Jl. Mawar 1\nSurabaya");
    expect(semua).toContain("No. INV/INV/2026/X/001");
  });

  it("tanpa rekening: kotak transfer tidak dicetak tetapi catatan tetap", async () => {
    const r = await render(susunSpesifikasiBebas(isian((f) => (f.pembayaran = { bank: "", rekening: "", atasNama: "", catatan: "Catatan khusus invoice ini." }))));
    const semua = r.teks.map((t) => t.teks);
    expect(semua).not.toContain("TRANSFER KE");
    expect(semua).toContain("Catatan khusus invoice ini.");
  });

  it("tanpa rekening dan tanpa catatan: halaman tetap jadi dan satu halaman", async () => {
    const r = await render(susunSpesifikasiBebas(isian((f) => (f.pembayaran = { bank: "", rekening: "", atasNama: "", catatan: "" }))));
    expect(r.halaman).toBe(1);
    expect(r.teks.map((t) => t.teks)).not.toContain("TRANSFER KE");
  });

  it("penerima tanpa alamat dan tanpa Up.: kartu hanya memuat nama", async () => {
    const r = await render(susunSpesifikasiBebas(isian((f) => (f.penerima = { nama: "SD Kecil", alamat: "", up: "" }))));
    const semua = r.teks.map((t) => t.teks);
    expect(semua).toContain("SD Kecil");
    expect(semua.some((t) => t.startsWith("Up."))).toBe(false);
  });

  it("jumlah pecahan dan satuan kosong tampil rapi (1,5 bulan; angka saja bila satuan kosong)", async () => {
    const r = await render(
      susunSpesifikasiBebas(
        isian((f) => (f.baris = [{ deskripsi: "A", detail: "", jumlah: 1.5, satuan: "bulan", harga: 100_000 }, { deskripsi: "B", detail: "", jumlah: 2500, satuan: "", harga: 10 }])),
      ),
    );
    const semua = r.teks.map((t) => t.teks);
    expect(semua).toContain("1,5 bulan");
    expect(semua).toContain("2.500");
    expect(semua).toContain("Rp150.000");
    expect(semua).toContain("Rp25.000");
  });
});

describe("renderInvoicePdf: banyak baris dan banyak halaman", () => {
  it("beberapa baris yang masih muat: tetap satu halaman, nomor baris berurutan", async () => {
    const r = await render(susunSpesifikasiBebas(isian((f) => (f.baris = banyak(3)))));
    expect(r.halaman).toBe(1);
    const nomor = r.teks.filter((t) => /^[1-9]$/.test(t.teks)).map((t) => t.teks);
    expect(nomor).toEqual(["1", "2", "3"]);
  });

  it("baris sangat banyak: tabel berlanjut ke halaman berikutnya; kepala tabel diulang, 'lanjutan' ditandai, kaki di tiap halaman", async () => {
    const r = await render(susunSpesifikasiBebas(isian((f) => (f.baris = banyak(24)))));
    expect(r.halaman).toBeGreaterThanOrEqual(2);
    const hitungTeks = (t: string) => r.teks.filter((x) => x.teks === t).length;
    // kepala tabel diulang di setiap halaman yang memuat baris; tidak ada yang tertinggal tanpa kepala
    expect(hitungTeks("Deskripsi layanan")).toBeGreaterThanOrEqual(2);
    expect(r.teks.some((t) => t.teks.includes("(lanjutan)"))).toBe(true);
    // kaki halaman digambar tepat sekali per halaman; bagian yang tunggal hanya sekali
    expect(hitungTeks(IDENTITAS_INVOICE.footer)).toBe(r.halaman);
    expect(hitungTeks("TRANSFER KE")).toBe(1);
    expect(hitungTeks("TERBILANG")).toBe(1);
    expect(hitungTeks("INVOICE")).toBe(1);
    expect(hitungTeks(IDENTITAS_INVOICE.penandatangan.nama)).toBe(1);
    // semua 24 baris tercetak, berurutan
    const nomor = r.teks.filter((t) => /^\d{1,2}$/.test(t.teks) && Number(t.teks) <= 24).map((t) => Number(t.teks));
    expect(nomor).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  it("logo MaleTech-RG di kaki tiap halaman; logo kepala, stempel, dan tanda tangan hanya sekali", async () => {
    const r = await render(susunSpesifikasiBebas(isian((f) => (f.baris = banyak(24)))));
    expect(r.jumlahGambar).toBe(r.halaman + 3);
  });

  it.each([1, 2, 3, 5, 8, 12, 18, 24, 30])("%i baris: tidak ada isi yang menimpa kaki halaman dan semua baris tercetak", async (n) => {
    const r = await render(susunSpesifikasiBebas(isian((f) => (f.baris = banyak(n)))));
    for (const t of r.teks) {
      if (t.teks === IDENTITAS_INVOICE.footer) continue;
      expect(t.y, `halaman ${t.halaman}: "${t.teks.slice(0, 30)}"`).toBeLessThan(Y_KAKI);
    }
    const deskripsi = r.teks.filter((t) => /^Layanan \d+$/.test(t.teks)).map((t) => t.teks);
    expect(deskripsi).toEqual(Array.from({ length: n }, (_, i) => `Layanan ${i + 1}`));
  });

  it("baris berkeluhan teks sangat panjang tidak menembus halaman (dipotong, bukan melebar)", async () => {
    const panjang = "Rincian panjang sekali ".repeat(17).slice(0, 400);
    const r = await render(
      susunSpesifikasiBebas(
        isian((f) => {
          f.baris = Array.from({ length: 10 }, (_, i) => ({ deskripsi: `Layanan ${i + 1} ${"nama panjang ".repeat(10).slice(0, 140)}`, detail: panjang, jumlah: 1, satuan: "paket", harga: 1_000 })) as InvoiceBebasForm["baris"];
          f.penerima = { nama: "Nama sekolah yang sangat panjang ".repeat(5).slice(0, 150), alamat: "Alamat ".repeat(40).slice(0, 300), up: "Kontak ".repeat(17).slice(0, 119) };
        }),
      ),
    );
    for (const t of r.teks) {
      if (t.teks === IDENTITAS_INVOICE.footer) continue;
      expect(t.y).toBeLessThan(Y_KAKI);
    }
    expect(r.halaman).toBeGreaterThanOrEqual(1);
    expect(r.halaman).toBeLessThanOrEqual(6);
  });

  it("dua kali render dengan isian sama menghasilkan teks yang sama (deterministik)", async () => {
    const a = await render(susunSpesifikasiBebas(isian((f) => (f.baris = banyak(12)))));
    const b = await render(susunSpesifikasiBebas(isian((f) => (f.baris = banyak(12)))));
    expect(a.teks).toEqual(b.teks);
    expect(a.halaman).toBe(b.halaman);
  });
});
