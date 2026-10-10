import PDFDocument from "pdfkit";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { terbilang } from "@/lib/utils/terbilang";
import { formatRupiah } from "@/lib/billing/school-invoice";
import { schoolInvoiceCreateSchema, schoolInvoiceUpdateSchema } from "@/lib/validations/school-invoice";
import { renderInvoiceSekolahPdf, type DataInvoiceSekolah } from "@/lib/pdf/invoice-sekolah-renderer";

describe("Invoice Sekolah Helpers & Validations", () => {
  it("terbilang menghasilkan kalimat rupiah yang tepat", () => {
    expect(terbilang(0)).toBe("Nol Rupiah");
    expect(terbilang(25000)).toBe("Dua Puluh Lima Ribu Rupiah");
    expect(terbilang(1500000)).toBe("Satu Juta Lima Ratus Ribu Rupiah");
    expect(terbilang(3750000)).toBe("Tiga Juta Tujuh Ratus Lima Puluh Ribu Rupiah");
    expect(terbilang(10000000)).toBe("Sepuluh Juta Rupiah");
  });

  it("formatRupiah memformat mata uang dengan benar", () => {
    const formatted = formatRupiah(25000);
    expect(formatted).toContain("25.000");
  });

  it("schoolInvoiceCreateSchema memvalidasi data form input", () => {
    const valid = schoolInvoiceCreateSchema.safeParse({
      jumlahSiswa: 100,
      hargaPerSiswa: 25000,
      jatuhTempo: "2026-10-24",
      keterangan: "Paket Try Out TKA Semester 1",
    });
    expect(valid.success).toBe(true);

    const invalidJumlah = schoolInvoiceCreateSchema.safeParse({
      jumlahSiswa: 0,
      hargaPerSiswa: 25000,
      jatuhTempo: "2026-10-24",
    });
    expect(invalidJumlah.success).toBe(false);

    const invalidHarga = schoolInvoiceCreateSchema.safeParse({
      jumlahSiswa: 50,
      hargaPerSiswa: -100,
      jatuhTempo: "2026-10-24",
    });
    expect(invalidHarga.success).toBe(false);
  });

  it("schoolInvoiceUpdateSchema memvalidasi pembaruan status", () => {
    const valid = schoolInvoiceUpdateSchema.safeParse({
      status: "lunas",
    });
    expect(valid.success).toBe(true);

    const invalidStatus = schoolInvoiceUpdateSchema.safeParse({
      status: "invalid_status",
    });
    expect(invalidStatus.success).toBe(false);
  });
});

describe("Render Invoice Sekolah PDF", () => {
  const dummyData: DataInvoiceSekolah = {
    invoice: {
      id: "inv-12345",
      schoolId: "sch-12345",
      periodeId: null,
      nomorInvoice: "INV/TKA/202610/0001",
      jumlahSiswa: 150,
      hargaPerSiswa: 25000,
      subtotal: 3750000,
      totalAmount: 3750000,
      status: "menunggu_pembayaran",
      tanggalInvoice: new Date("2026-10-10"),
      jatuhTempo: new Date("2026-10-24"),
      keterangan: "Akses Try Out AyoTKA Periode 2026/2027",
      bankTujuan: "Bank Mandiri - No. Rek: 144-00-1234567-8 a.n. PT Ayo TKA Edukasi",
      catatan: "Harap transfer sebelum jatuh tempo.",
      dibayarAt: null,
      dibuatOlehId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    school: {
      nama: "SMP Negeri 1 Surabaya",
      npsn: "20532001",
      jenjang: "SMP",
      kodeSekolah: "SMPN1SBY",
      alamat: "Jl. Wijaya Kusuma No. 48",
      kabupatenKota: "Kota Surabaya",
      provinsi: "Jawa Timur",
      statusSekolah: "negeri",
    },
    periode: {
      nama: "Semester Ganjil 2026/2027",
      mulai: new Date("2026-07-01"),
      berakhir: new Date("2026-12-31"),
    },
    bankAccount: {
      namaBank: "Bank Mandiri",
      nomorRekening: "144-00-1234567-8",
      atasNama: "PT Ayo TKA Edukasi",
    },
  };

  it("dapat merender dokumen PDF untuk invoice berstatus menunggu_pembayaran", async () => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const finishPromise = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    await renderInvoiceSekolahPdf(doc, dummyData, null);
    doc.end();

    const pdfBuffer = await finishPromise;
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // PDF Magic bytes: %PDF-
    expect(pdfBuffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("dapat merender dokumen PDF untuk invoice berstatus lunas", async () => {
    const lunasData: DataInvoiceSekolah = {
      ...dummyData,
      invoice: {
        ...dummyData.invoice,
        status: "lunas",
        dibayarAt: new Date("2026-10-12"),
      },
    };

    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const finishPromise = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    await renderInvoiceSekolahPdf(doc, lunasData, null);
    doc.end();

    const pdfBuffer = await finishPromise;
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
