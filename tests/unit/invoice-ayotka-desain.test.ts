import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buatPdfInvoiceSekolah,
  muatAsetInvoice,
  renderInvoiceSekolahPdf,
  type AsetInvoice,
  type DataInvoiceSekolah,
} from "@/lib/pdf/invoice-sekolah-renderer";
import { IDENTITAS_INVOICE, angkaRibuan, labelBank, namaBerkasInvoice, rupiahRingkas } from "@/lib/pdf/invoice-identitas";
import { terbilangKalimat } from "@/lib/utils/terbilang";

/** Invoice contoh dari desain pemilik: MTsN 1 Kediri, 369 siswa x Rp20.000 = Rp7.380.000, terbit 10 Okt, jatuh tempo 24 Okt 2026. */
const mtsn: DataInvoiceSekolah = {
  invoice: {
    id: "inv-1",
    schoolId: "sch-1",
    periodeId: null,
    nomorInvoice: "INV/AYOTKA/2026/X/001",
    jumlahSiswa: 369,
    hargaPerSiswa: 20_000,
    subtotal: 7_380_000,
    totalAmount: 7_380_000,
    status: "menunggu_pembayaran",
    tanggalInvoice: new Date("2026-10-10T03:00:00.000Z"),
    jatuhTempo: new Date("2026-10-24T03:00:00.000Z"),
    keterangan: null,
    bankTujuan: null,
    catatan: null,
    dibayarAt: null,
    dibuatOlehId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  school: {
    nama: "MTsN 1 Kediri",
    npsn: "20581234",
    jenjang: "SMP",
    kodeSekolah: "RAHASIA1",
    alamat: "Jl. Stadion Canda Bhirawa 01 Tulungrejo, Puhrejo, Tulungrejo, Pare, Kediri",
    kabupatenKota: "Kabupaten Kediri",
    provinsi: "Jawa Timur",
    statusSekolah: "negeri",
  },
  periode: null,
  bankAccount: null,
};

const dengan = (o: { invoice?: Partial<DataInvoiceSekolah["invoice"]>; school?: Partial<DataInvoiceSekolah["school"]>; bankAccount?: DataInvoiceSekolah["bankAccount"]; periode?: DataInvoiceSekolah["periode"] }): DataInvoiceSekolah => ({
  ...mtsn,
  invoice: { ...mtsn.invoice, ...o.invoice },
  school: { ...mtsn.school, ...o.school },
  bankAccount: o.bankAccount ?? null,
  periode: o.periode ?? null,
});

type Hasil = { teks: string[]; halaman: number; pdf: Buffer; doc: PDFKit.PDFDocument };

/** Merender dan mengumpulkan semua teks yang digambar, supaya isi invoice bisa diperiksa tanpa membaca byte PDF. */
async function render(data: DataInvoiceSekolah, aset?: AsetInvoice | null): Promise<Hasil> {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  const teks: string[] = [];
  const asli = doc.text.bind(doc);
  doc.text = ((...args: unknown[]) => {
    if (typeof args[0] === "string") teks.push(args[0]);
    return (asli as (...a: unknown[]) => unknown)(...args);
  }) as typeof doc.text;
  const potongan: Buffer[] = [];
  doc.on("data", (c: Buffer) => potongan.push(c));
  const selesai = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(potongan))));
  await renderInvoiceSekolahPdf(doc, data, aset);
  const halaman = doc.bufferedPageRange().count;
  doc.end();
  return { teks, halaman, pdf: await selesai, doc };
}

const semua = (h: Hasil) => h.teks.join("\n");

describe("invoice AyoTKA mengikuti desain pemilik", () => {
  it("contoh MTsN 1 Kediri: semua bagian desain ada, satu halaman", async () => {
    const h = await render(mtsn);
    const t = semua(h);
    expect(h.halaman).toBe(1);
    // kepala
    expect(t).toContain("AyoTKA.ID");
    expect(t).toContain("Grup Riset MaleTech-RG, FMIPA Universitas Negeri Malang");
    expect(t).toContain("Jl. Semarang 5, Malang 65145");
    expect(t).toContain("INVOICE");
    expect(t).toContain("No. INV/AYOTKA/2026/X/001");
    expect(t).toContain("BELUM DIBAYAR");
    // kartu
    expect(t).toContain("DITAGIHKAN KEPADA");
    expect(t).toContain("MTsN 1 Kediri");
    expect(t).toContain("Jl. Stadion Canda Bhirawa 01 Tulungrejo");
    expect(t).toContain("Tanggal terbit");
    expect(t).toContain("10 Oktober 2026");
    expect(t).toContain("Jatuh tempo");
    expect(t).toContain("24 Oktober 2026");
    expect(t).toContain("Total tagihan");
    // tabel
    for (const kolom of ["No", "Deskripsi layanan", "Jumlah", "Harga satuan", "Subtotal"]) expect(h.teks).toContain(kolom);
    expect(t).toContain("Paket Sekolah AyoTKA");
    expect(t).toContain("Tryout TKA dengan learning analytics, Tryout Nasional 3 tahap, dan dasbor sekolah");
    expect(t).toContain("369 siswa");
    expect(t).toContain("Rp20.000");
    expect(h.teks.filter((x) => x === "Rp7.380.000").length).toBeGreaterThanOrEqual(4); // kartu, baris, subtotal, total
    // terbilang berbentuk kalimat, bukan Title Case
    expect(t).toContain("TERBILANG");
    expect(t).toContain("Tujuh juta tiga ratus delapan puluh ribu rupiah");
    expect(t).not.toContain("Tujuh Juta");
    // total + transfer
    expect(h.teks).toContain("Total");
    expect(t).toContain("TRANSFER KE");
    expect(t).toContain("Bank BNI");
    expect(t).toContain("1847488087");
    expect(t).toContain("Tomi Listiawan");
    expect(t).toContain("Mohon cantumkan nomor invoice pada berita transfer dan kirim bukti pembayaran melalui WhatsApp 0821 3258 7980.");
    // tanda tangan + kaki
    expect(t).toContain("Malang, 10 Oktober 2026");
    expect(t).toContain("Dr. Tomi Listiawan, S.Si., M.Pd., MCE.");
    expect(t).toContain("Penanggung Jawab AyoTKA");
    expect(t).toContain("ayotka.id · Tryout TKA berbasis learning analytics · Terima kasih atas kepercayaan Anda");
  });

  it("tidak ada PPN: tidak ada baris pajak bila total = subtotal (sesuai desain, PPN opsional)", async () => {
    const t = semua(await render(mtsn));
    expect(t).not.toMatch(/PPN|Pajak|pajak/);
    expect(t).not.toContain("Potongan");
  });

  it("kode sekolah (rahasia untuk pendaftaran siswa) tidak tercetak di invoice", async () => {
    expect(semua(await render(mtsn))).not.toContain("RAHASIA1");
  });

  it("alamat tagihan: alamat, wilayah, NPSN, jenjang dan jenis sekolah", async () => {
    const t = semua(await render(mtsn));
    expect(t).toContain("Kabupaten Kediri, Jawa Timur");
    expect(t).toContain("NPSN 20581234 · SMP Negeri");
  });

  it("tanpa alamat/wilayah/NPSN: kartu tetap dibuat tanpa baris kosong yang aneh", async () => {
    const h = await render(dengan({ school: { alamat: null, kabupatenKota: null, provinsi: null, npsn: null, statusSekolah: null } }));
    expect(h.halaman).toBe(1);
    expect(semua(h)).toContain("SMP");
    expect(semua(h)).not.toContain("NPSN");
  });

  it("lunas: badge LUNAS dan tanggal lunas, tanpa BELUM DIBAYAR", async () => {
    const h = await render(dengan({ invoice: { status: "lunas", dibayarAt: new Date("2026-10-12T03:00:00.000Z") } }));
    const t = semua(h);
    expect(t).toContain("LUNAS");
    expect(t).toContain("Tanggal lunas");
    expect(t).toContain("12 Oktober 2026");
    expect(t).not.toContain("BELUM DIBAYAR");
    expect(h.halaman).toBe(1);
  });

  it("belum dibayar: tidak ada baris tanggal lunas - juga bila kolom dibayarAt terlanjur terisi (data janggal)", async () => {
    expect(semua(await render(mtsn))).not.toContain("Tanggal lunas");
    const janggal = await render(dengan({ invoice: { status: "menunggu_pembayaran", dibayarAt: new Date("2026-10-12T03:00:00.000Z") } }));
    expect(semua(janggal)).not.toContain("Tanggal lunas");
    expect(semua(janggal)).toContain("BELUM DIBAYAR");
    const batal = await render(dengan({ invoice: { status: "dibatalkan", dibayarAt: new Date("2026-10-12T03:00:00.000Z") } }));
    expect(semua(batal)).not.toContain("Tanggal lunas");
  });

  it("dibatalkan: badge DIBATALKAN", async () => {
    const t = semua(await render(dengan({ invoice: { status: "dibatalkan" } })));
    expect(t).toContain("DIBATALKAN");
    expect(t).not.toContain("BELUM DIBAYAR");
  });

  it("rekening aktif dari Admin Pusat didahulukan atas rekening bawaan; awalan 'Bank' tidak digandakan", async () => {
    const h = await render(dengan({ bankAccount: { namaBank: "Bank Mandiri", nomorRekening: "144-00-1234567-8", atasNama: "PT Contoh" } }));
    const t = semua(h);
    expect(t).toContain("Bank Mandiri");
    expect(t).not.toContain("Bank Bank");
    expect(t).toContain("144-00-1234567-8");
    expect(t).toContain("PT Contoh");
    expect(t).not.toContain("1847488087");
  });

  it("tujuan bank khusus invoice (teks bebas) mengalahkan rekening aktif", async () => {
    const h = await render(
      dengan({
        invoice: { bankTujuan: "Bank Jatim 0012345678 a.n. Bendahara AyoTKA" },
        bankAccount: { namaBank: "Bank Mandiri", nomorRekening: "144", atasNama: "X" },
      }),
    );
    const t = semua(h);
    expect(t).toContain("Bank Jatim 0012345678 a.n. Bendahara AyoTKA");
    expect(t).not.toContain("Bank Mandiri");
  });

  it("keterangan dan periode ditambahkan di bawah rincian layanan; catatan khusus ditambahkan setelah catatan baku", async () => {
    const h = await render(
      dengan({
        invoice: { keterangan: "Akses Try Out Semester Ganjil", catatan: "Harap transfer sebelum jatuh tempo." },
        periode: { nama: "Semester Ganjil 2026/2027", mulai: new Date("2026-07-01"), berakhir: new Date("2026-12-31") },
      }),
    );
    const t = semua(h);
    expect(t).toContain("Akses Try Out Semester Ganjil");
    expect(t).toContain("Periode: Semester Ganjil 2026/2027");
    expect(t).toContain(IDENTITAS_INVOICE.catatanBawaan);
    expect(t).toContain("Harap transfer sebelum jatuh tempo.");
    expect(t.indexOf(IDENTITAS_INVOICE.catatanBawaan)).toBeLessThan(t.indexOf("Harap transfer sebelum jatuh tempo."));
  });

  it("selisih antara total dan subtotal (data lama) ditampilkan jujur, bukan disembunyikan; terbilang mengikuti TOTAL", async () => {
    const lebih = await render(dengan({ invoice: { totalAmount: 7_500_000 } }));
    expect(semua(lebih)).toContain("Biaya/pajak lain");
    expect(semua(lebih)).toContain("Tujuh juta lima ratus ribu rupiah");
    expect(semua(lebih)).not.toContain("Tujuh juta tiga ratus delapan puluh ribu rupiah");
    expect(lebih.teks.filter((x) => x === "Rp7.500.000").length).toBeGreaterThanOrEqual(2); // kartu dan total
    const kurang = await render(dengan({ invoice: { totalAmount: 7_000_000 } }));
    expect(semua(kurang)).toContain("Potongan");
    expect(semua(kurang)).toContain("Tujuh juta rupiah");
  });

  it("jumlah besar memakai titik ribuan dan terbilang miliar", async () => {
    const h = await render(dengan({ invoice: { jumlahSiswa: 1500, hargaPerSiswa: 1_000_000, subtotal: 1_500_000_000, totalAmount: 1_500_000_000 } }));
    const t = semua(h);
    expect(t).toContain("Rp1.500.000.000");
    expect(t).toContain("1.500 siswa");
    expect(t).toContain("Satu miliar lima ratus juta rupiah");
  });

  it("isi yang sangat panjang dipangkas: tetap satu halaman, tanpa galat", async () => {
    const panjang = "kata ".repeat(300);
    const h = await render(
      dengan({
        invoice: { keterangan: panjang, catatan: panjang, bankTujuan: panjang },
        school: { nama: "Sekolah Menengah Pertama Islam Terpadu Al-Hikmah Nusantara Raya ".repeat(3), alamat: panjang },
        periode: { nama: panjang, mulai: new Date(), berakhir: new Date() },
      }),
    );
    expect(h.halaman).toBe(1);
    expect(h.pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("nama sekolah dengan karakter khusus (aksen, ampersand, tanda kutip) tidak merusak PDF", async () => {
    const h = await render(dengan({ school: { nama: 'SMP "Cahaya" & Putra-Putri Éclair (Filial)' } }));
    expect(h.halaman).toBe(1);
    expect(semua(h)).toContain('SMP "Cahaya" & Putra-Putri Éclair (Filial)');
  });

  it("tanpa gambar sama sekali (berkas hilang): tetap menghasilkan invoice satu halaman", async () => {
    const h = await render(mtsn, { logo: null, tandaTangan: null, stempel: null, maletech: null });
    expect(h.halaman).toBe(1);
    expect(semua(h)).toContain("INVOICE");
  });

  it("gambar desain terpasang: logo, tanda tangan, stempel, dan logo MaleTech-RG semuanya PNG sah", async () => {
    const aset = await muatAsetInvoice();
    for (const [nama, buf] of Object.entries(aset)) {
      expect(buf, nama).not.toBeNull();
      expect(buf!.subarray(0, 8).toString("hex"), nama).toBe("89504e470d0a1a0a");
    }
  });

  it("PDF berisi gambar-gambar itu dan metadata judul/penulis", async () => {
    const h = await render(mtsn);
    const mentah = h.pdf.toString("latin1");
    expect((mentah.match(/\/Subtype \/Image/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(mentah).toContain("Invoice INV/AYOTKA/2026/X/001 - MTsN 1 Kediri");
    expect(mentah).toContain("AyoTKA.ID");
  });

  it("buatPdfInvoiceSekolah menghasilkan berkas PDF utuh satu halaman", async () => {
    const pdf = await buatPdfInvoiceSekolah(mtsn);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20_000); // memuat gambar desain
    expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
  });

  it("nomor lama (INV/TKA/202610/0001) tetap dirender apa adanya", async () => {
    expect(semua(await render(dengan({ invoice: { nomorInvoice: "INV/TKA/202610/0001" } })))).toContain("No. INV/TKA/202610/0001");
  });

  it("jika SIMPAN_PDF_UJI diisi, contoh PDF ditulis ke folder itu untuk dilihat mata (bukan bagian asersi)", async () => {
    const folder = process.env.SIMPAN_PDF_UJI;
    if (!folder) return;
    mkdirSync(folder, { recursive: true });
    const kasus: [string, DataInvoiceSekolah][] = [
      ["mtsn-belum-dibayar", mtsn],
      ["lunas-rekening-aktif", dengan({ invoice: { status: "lunas", dibayarAt: new Date("2026-10-12T03:00:00.000Z"), keterangan: "Akses Try Out Semester Ganjil 2026/2027", catatan: "Terima kasih, pembayaran sudah kami terima." }, bankAccount: { namaBank: "Bank Mandiri", nomorRekening: "144-00-1234567-8", atasNama: "Grup Riset MaleTech-RG" }, periode: { nama: "Semester Ganjil 2026/2027", mulai: new Date("2026-07-01"), berakhir: new Date("2026-12-31") } })],
      ["dibatalkan-panjang", dengan({ invoice: { status: "dibatalkan", catatan: "kata ".repeat(120) }, school: { nama: "Sekolah Menengah Pertama Islam Terpadu Al-Hikmah Nusantara Raya Cabang Utara" } })],
    ];
    for (const [nama, data] of kasus) writeFileSync(path.join(folder, `${nama}.pdf`), await buatPdfInvoiceSekolah(data));
  });
});

describe("pembantu invoice", () => {
  it("angkaRibuan dan rupiahRingkas: titik ribuan, tanpa spasi, negatif bertanda", () => {
    expect(angkaRibuan(0)).toBe("0");
    expect(angkaRibuan(999)).toBe("999");
    expect(angkaRibuan(1000)).toBe("1.000");
    expect(angkaRibuan(7_380_000)).toBe("7.380.000");
    expect(angkaRibuan(1_234_567_890)).toBe("1.234.567.890");
    expect(rupiahRingkas(20_000)).toBe("Rp20.000");
    expect(rupiahRingkas(0)).toBe("Rp0");
    expect(rupiahRingkas(-5_000)).toBe("Rp-5.000".replace("Rp-", "-Rp"));
    expect(rupiahRingkas(1234.6)).toBe("Rp1.235");
    expect(rupiahRingkas(-0.2)).toBe("Rp0");
  });

  it("labelBank: awalan Bank tidak digandakan", () => {
    expect(labelBank("BNI")).toBe("Bank BNI");
    expect(labelBank("Bank Mandiri")).toBe("Bank Mandiri");
    expect(labelBank("  bank   jatim ")).toBe("bank jatim");
    expect(labelBank("Banking Corp")).toBe("Bank Banking Corp");
  });

  it("terbilangKalimat: huruf awal kapital saja", () => {
    expect(terbilangKalimat(7_380_000)).toBe("Tujuh juta tiga ratus delapan puluh ribu rupiah");
    expect(terbilangKalimat(0)).toBe("Nol rupiah");
    expect(terbilangKalimat(1_000)).toBe("Seribu rupiah");
  });

  it("namaBerkasInvoice mengikuti contoh pemilik dan aman untuk header unduhan", () => {
    expect(namaBerkasInvoice("INV/AYOTKA/2026/X/001", "MTsN 1 Kediri")).toBe("Invoice INV-AYOTKA-2026-X-001 - MTsN 1 Kediri.pdf");
    expect(namaBerkasInvoice("INV/TKA/202610/0001", "SMP Negeri 1 Surabaya")).toBe("Invoice INV-TKA-202610-0001 - SMP Negeri 1 Surabaya.pdf");
    const aneh = namaBerkasInvoice("INV/AYOTKA/2026/X/002", 'SMP "Éclair" <Utama>\r\nX');
    expect(aneh).toMatch(/^[\x20-\x7e]+$/);
    expect(aneh).not.toMatch(/["<>\r\n]/);
    expect(aneh.endsWith(".pdf")).toBe(true);
    expect(namaBerkasInvoice("INV/AYOTKA/2026/X/003", "")).toBe("Invoice INV-AYOTKA-2026-X-003.pdf");
    expect(namaBerkasInvoice("INV/AYOTKA/2026/X/004", "x".repeat(200)).length).toBeLessThan(110);
  });
});
