import { z } from "zod";
import { adalahTanggalKalender, startOfDayWIB } from "@/lib/utils/datetime";
import { IDENTITAS_INVOICE, angkaRibuan } from "@/lib/pdf/invoice-identitas";
import { awalanNomorInvoiceKode, formatNomorInvoice } from "@/lib/billing/nomor-invoice";
import type { SpesifikasiInvoice } from "@/lib/pdf/invoice-sekolah-renderer";

/**
 * Pembuat Invoice di Admin Pusat (port dari alat invoice-ayotka.html milik pemilik): penerbit, penerima, nomor dan
 * tanggal, banyak baris layanan, PPN opsional, rekening, dan pengesahan (tanda tangan/stempel dibubuhkan atau dikosongkan
 * untuk dicap basah). Modul ini murni (tanpa database/server) supaya dipakai bersama formulir di browser, rute server, dan
 * tes: skema validasi, perhitungan, nomor, dan penyusunan SpesifikasiInvoice yang digambar renderer PDF.
 *
 * Batas total Rp2 miliar per invoice mengikuti kolom Int basis data (sama dengan invoice sekolah).
 */
export const BATAS_TOTAL_INVOICE = 2_000_000_000;
export const MAKS_BARIS_INVOICE = 30;

export type PresetPenerbit = "ayotka" | "icn" | "custom";

export const PRESET_PENERBIT: Record<PresetPenerbit, { label: string; nama: string; alamat: string; kode: string }> = {
  ayotka: {
    label: "AyoTKA · MaleTech-RG FMIPA UM",
    nama: IDENTITAS_INVOICE.namaPenerbit,
    alamat: IDENTITAS_INVOICE.alamatPenerbit.join("\n"),
    kode: "AYOTKA",
  },
  icn: {
    label: "PT Insan Cendekia Nusantara",
    nama: "PT Insan Cendekia Nusantara",
    alamat: "Penyelenggara layanan AyoTKA\nMalang, Jawa Timur\nWA 0821 3258 7980 · ayotka.id",
    kode: "ICN",
  },
  custom: { label: "Lainnya (isi manual)", nama: "", alamat: "", kode: "INV" },
};

const teks = (maks: number, label: string) => z.string().trim().max(maks, `${label} maksimal ${maks} karakter.`);
const tanggal = (label: string) => z.string().refine(adalahTanggalKalender, `${label} tidak valid.`);

const barisSchema = z.object({
  deskripsi: teks(150, "Nama layanan").min(1, "Nama layanan wajib diisi."),
  detail: teks(400, "Keterangan"),
  jumlah: z
    .number("Jumlah harus berupa angka.")
    .finite("Jumlah harus berupa angka.")
    .min(0, "Jumlah tidak boleh negatif.")
    .max(10_000_000, "Jumlah terlalu besar.")
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Jumlah maksimal 2 angka di belakang koma."),
  satuan: teks(24, "Satuan"),
  harga: z
    .number("Harga satuan harus berupa angka.")
    .int("Harga satuan harus bilangan bulat (rupiah).")
    .min(0, "Harga satuan tidak boleh negatif.")
    .max(BATAS_TOTAL_INVOICE, "Harga satuan terlalu besar."),
});

export const invoiceBebasSchema = z
  .object({
    penerbit: z.object({
      preset: z.enum(["ayotka", "icn", "custom"]),
      nama: teks(120, "Nama penerbit").min(1, "Nama penerbit wajib diisi."),
      alamat: teks(400, "Alamat penerbit"),
      kode: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9]{1,12}$/, "Kode nomor invoice harus 1-12 huruf atau angka (tanpa spasi atau garis miring)."),
    }),
    nomorUrut: z.number("Nomor urut harus berupa angka.").int("Nomor urut harus bilangan bulat.").min(1, "Nomor urut minimal 1.").max(99_999, "Nomor urut maksimal 99999."),
    status: z.enum(["menunggu_pembayaran", "lunas"]),
    tanggalTerbit: tanggal("Tanggal terbit"),
    jatuhTempo: tanggal("Jatuh tempo"),
    penerima: z.object({
      nama: teks(150, "Nama penerima").min(1, "Nama penerima (sekolah) wajib diisi."),
      alamat: teks(300, "Alamat penerima"),
      up: teks(120, "Kontak (Up.)"),
    }),
    baris: z.array(barisSchema).min(1, "Minimal satu baris rincian tagihan.").max(MAKS_BARIS_INVOICE, `Maksimal ${MAKS_BARIS_INVOICE} baris rincian.`),
    pajak: z.object({
      aktif: z.boolean(),
      persen: z
        .number("Tarif pajak harus berupa angka.")
        .min(0, "Tarif pajak tidak boleh negatif.")
        .max(100, "Tarif pajak maksimal 100%.")
        .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Tarif pajak maksimal 2 angka di belakang koma."),
    }),
    pembayaran: z.object({
      bank: teks(60, "Nama bank"),
      rekening: teks(60, "Nomor rekening"),
      atasNama: teks(100, "Nama pemilik rekening"),
      catatan: teks(600, "Catatan"),
    }),
    pengesahan: z.object({
      kota: teks(60, "Kota"),
      nama: teks(120, "Nama penanda tangan"),
      jabatan: teks(120, "Jabatan"),
      tandaTangan: z.boolean(),
      stempel: z.boolean(),
    }),
  })
  .superRefine((d, ctx) => {
    if (adalahTanggalKalender(d.tanggalTerbit) && adalahTanggalKalender(d.jatuhTempo) && d.jatuhTempo < d.tanggalTerbit) {
      ctx.addIssue({ code: "custom", path: ["jatuhTempo"], message: "Jatuh tempo tidak boleh sebelum tanggal terbit." });
    }
    // Rekening: kosong semua (kotak transfer tidak dicetak) atau lengkap bank + nomor + atas nama.
    const { bank, rekening, atasNama } = d.pembayaran;
    if (rekening && (!bank || !atasNama)) {
      ctx.addIssue({ code: "custom", path: ["pembayaran", "rekening"], message: "Lengkapi bank dan nama pemilik rekening, atau kosongkan nomor rekening." });
    } else if (!rekening && (bank || atasNama)) {
      ctx.addIssue({ code: "custom", path: ["pembayaran", "rekening"], message: "Isi nomor rekening, atau kosongkan bank dan nama pemilik rekening." });
    }
    const { total } = hitungInvoiceBebas(d);
    if (total > BATAS_TOTAL_INVOICE) {
      ctx.addIssue({ code: "custom", path: ["baris"], message: `Total tagihan melebihi batas Rp${angkaRibuan(BATAS_TOTAL_INVOICE)} per invoice.` });
    }
  });

export type InvoiceBebasInput = z.infer<typeof invoiceBebasSchema>;
/** Bentuk isian sebelum divalidasi (formulir): sama dengan InvoiceBebasInput tetapi kode boleh huruf kecil dan sebagainya. */
export type InvoiceBebasForm = z.input<typeof invoiceBebasSchema>;

/** Pesan galat pertama dalam bahasa yang bisa ditindaklanjuti: baris rincian diberi nomor ("Baris 2: ..."). */
export function pesanGalatInvoiceBebas(error: z.ZodError): string {
  const isu = error.issues[0];
  if (!isu) return "Data tidak valid.";
  if (isu.path[0] === "baris" && typeof isu.path[1] === "number") return `Baris ${isu.path[1] + 1}: ${isu.message}`;
  return isu.message;
}

export type HasilHitung = {
  baris: { subtotal: number }[];
  subtotal: number;
  pajak: number;
  total: number;
};

/** Subtotal tiap baris = jumlah x harga dibulatkan ke rupiah; PPN = subtotal x tarif dibulatkan; total = subtotal + PPN. */
export function hitungInvoiceBebas(d: Pick<InvoiceBebasForm, "baris" | "pajak">): HasilHitung {
  const baris = d.baris.map((b) => ({ subtotal: Math.round((Number(b.jumlah) || 0) * (Number(b.harga) || 0)) }));
  const subtotal = baris.reduce((jumlah, b) => jumlah + b.subtotal, 0);
  const pajak = d.pajak.aktif ? Math.round((subtotal * (Number(d.pajak.persen) || 0)) / 100) : 0;
  return { baris, subtotal, pajak, total: subtotal + pajak };
}

/** Tahun dan bulan (1-12) dari "yyyy-MM-dd" tanpa melewati zona waktu. */
export function tahunBulanDariTanggal(tanggalStr: string): { tahun: number; bulan: number } | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(tanggalStr);
  if (!m || !adalahTanggalKalender(tanggalStr)) return null;
  return { tahun: Number(m[1]), bulan: Number(m[2]) };
}

/** Awalan nomor bulan terbit ("INV/ICN/2026/X/"); null bila tanggal atau kode tidak sah. */
export function awalanDariIsian(kode: string, tanggalTerbit: string): string | null {
  const tb = tahunBulanDariTanggal(tanggalTerbit);
  const kodeBaku = kode.trim().toUpperCase();
  if (!tb || !/^[A-Z0-9]{1,12}$/.test(kodeBaku)) return null;
  return awalanNomorInvoiceKode(kodeBaku, tb.tahun, tb.bulan);
}

/** Nomor lengkap, mis. "INV/AYOTKA/2026/X/002"; mengikuti bulan tanggal terbit seperti pada alat asal. */
export function nomorInvoiceBebas(d: Pick<InvoiceBebasInput, "penerbit" | "nomorUrut" | "tanggalTerbit">): string {
  const awalan = awalanDariIsian(d.penerbit.kode, d.tanggalTerbit);
  if (!awalan) throw new RangeError("Tanggal terbit atau kode nomor tidak valid.");
  return formatNomorInvoice(awalan, d.nomorUrut);
}

/** 369 -> "369", 1500 -> "1.500", 1.5 -> "1,5", 2.25 -> "2,25". */
export function formatJumlahInvoice(n: number): string {
  if (Number.isInteger(n)) return angkaRibuan(n);
  const bulat = Math.trunc(n);
  const pecahan = Math.round((n - bulat) * 100)
    .toString()
    .padStart(2, "0")
    .replace(/0+$/, "");
  return pecahan ? `${angkaRibuan(bulat)},${pecahan}` : angkaRibuan(bulat);
}

/** Tarif pajak untuk label: 11 -> "11", 11.5 -> "11,5". */
export function formatPersen(n: number): string {
  return String(n).replace(".", ",");
}

/** Tanggal kalender WIB "yyyy-MM-dd" -> pukul 12.00 WIB hari itu (tanggal tetap sama di zona waktu mana pun). */
export function tanggalSiangWIB(tanggalStr: string): Date {
  return new Date(startOfDayWIB(tanggalStr).getTime() + 12 * 3_600_000);
}

/** Susunan lengkap invoice yang digambar renderer PDF dari isian yang sudah divalidasi. */
export function susunSpesifikasiBebas(d: InvoiceBebasInput): SpesifikasiInvoice {
  const hitung = hitungInvoiceBebas(d);
  const nomor = nomorInvoiceBebas(d);
  const alamatPenerbit = d.penerbit.alamat
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
  const alamatPenerima = [d.penerima.alamat.trim(), d.penerima.up.trim() ? `Up. ${d.penerima.up.trim()}` : ""].filter(Boolean).join("\n");
  const adaRekening = Boolean(d.pembayaran.rekening);

  return {
    nomor,
    status: d.status,
    penerbit: { nama: d.penerbit.nama, alamat: alamatPenerbit, tampilkanLogo: d.penerbit.preset !== "custom" },
    penerima: { nama: d.penerima.nama, alamat: alamatPenerima },
    tanggalTerbit: tanggalSiangWIB(d.tanggalTerbit),
    jatuhTempo: tanggalSiangWIB(d.jatuhTempo),
    tanggalLunas: null,
    baris: d.baris.map((b, i) => ({
      deskripsi: b.deskripsi,
      rincian: b.detail,
      jumlah: `${formatJumlahInvoice(b.jumlah)}${b.satuan ? ` ${b.satuan}` : ""}`,
      hargaSatuan: b.harga,
      subtotal: hitung.baris[i]!.subtotal,
    })),
    ringkasan: [
      { label: "Subtotal", nilai: hitung.subtotal },
      ...(d.pajak.aktif ? [{ label: `PPN ${formatPersen(d.pajak.persen)}%`, nilai: hitung.pajak }] : []),
    ],
    total: hitung.total,
    pembayaran: {
      rekening: adaRekening ? { namaBank: d.pembayaran.bank, nomorRekening: d.pembayaran.rekening, atasNama: d.pembayaran.atasNama } : null,
      tujuanKhusus: null,
      catatan: d.pembayaran.catatan,
    },
    pengesahan: {
      kota: d.pengesahan.kota,
      nama: d.pengesahan.nama,
      jabatan: d.pengesahan.jabatan,
      tandaTangan: d.pengesahan.tandaTangan,
      stempel: d.pengesahan.stempel,
    },
    footer: IDENTITAS_INVOICE.footer,
    judulDokumen: `Invoice ${nomor} - ${d.penerima.nama}`,
    subjekDokumen: "Invoice AyoTKA",
  };
}

/** Tanggal hari ini di WIB sebagai "yyyy-MM-dd" (untuk nilai awal formulir). */
export function hariIniWIB(sekarang: Date = new Date()): string {
  const wib = new Date(sekarang.getTime() + 7 * 3_600_000);
  return wib.toISOString().slice(0, 10);
}

/** Tambah hari pada tanggal kalender "yyyy-MM-dd". */
export function tambahHariTanggal(tanggalStr: string, hari: number): string {
  const [t, b, h] = tanggalStr.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(t, b - 1, h + hari));
  return d.toISOString().slice(0, 10);
}

/** Nilai awal formulir: penerbit AyoTKA, satu baris layanan, jatuh tempo 14 hari, rekening dan pengesahan bawaan pemilik. */
export function isianAwalInvoiceBebas(sekarang: Date = new Date()): InvoiceBebasForm {
  const hariIni = hariIniWIB(sekarang);
  const p = PRESET_PENERBIT.ayotka;
  return {
    penerbit: { preset: "ayotka", nama: p.nama, alamat: p.alamat, kode: p.kode },
    nomorUrut: 1,
    status: "menunggu_pembayaran",
    tanggalTerbit: hariIni,
    jatuhTempo: tambahHariTanggal(hariIni, 14),
    penerima: { nama: "", alamat: "", up: "" },
    baris: [{ deskripsi: IDENTITAS_INVOICE.namaLayanan, detail: IDENTITAS_INVOICE.rincianLayanan, jumlah: 100, satuan: "siswa", harga: 40_000 }],
    pajak: { aktif: false, persen: 11 },
    pembayaran: {
      bank: IDENTITAS_INVOICE.rekeningBawaan.namaBank,
      rekening: IDENTITAS_INVOICE.rekeningBawaan.nomorRekening,
      atasNama: IDENTITAS_INVOICE.rekeningBawaan.atasNama,
      catatan: IDENTITAS_INVOICE.catatanBawaan,
    },
    pengesahan: {
      kota: IDENTITAS_INVOICE.kota,
      nama: IDENTITAS_INVOICE.penandatangan.nama,
      jabatan: IDENTITAS_INVOICE.penandatangan.jabatan,
      tandaTangan: true,
      stempel: true,
    },
  };
}
