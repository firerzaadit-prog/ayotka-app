import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement("a", { href, ...rest }, children),
}));

import { RiwayatPembayaranView } from "@/components/siswa/riwayat-pembayaran-view";
import {
  labelMetode,
  susunRiwayatPembayaran,
  type SumberInvoice,
  type SumberSaldo,
  type SumberVoucher,
} from "@/lib/billing/riwayat-pembayaran";

const SEKARANG = new Date("2026-10-16T05:00:00.000Z");
const hari = 86_400_000;
const t = (selisihHari: number) => new Date(SEKARANG.getTime() + selisihHari * hari);

const inv = (o: Partial<SumberInvoice> = {}): SumberInvoice => ({
  id: "inv-1",
  amount: 149_000,
  status: "paid",
  paymentChannel: "affiliate_id",
  createdAt: t(-2),
  expiresAt: t(-2),
  plan: { nama: "Paket Semester" },
  ...o,
});
const sal = (o: Partial<SumberSaldo> = {}): SumberSaldo => ({
  id: "sal-1",
  tipe: "topup",
  status: "berhasil",
  jumlah: 25_000,
  keterangan: "Top-up saldo 25000 via affiliate.id (otomatis)",
  paymentChannel: "affiliate_id",
  createdAt: t(-3),
  expiresAt: null,
  ...o,
});
const vou = (o: Partial<SumberVoucher> = {}): SumberVoucher => ({
  id: "vou-1",
  code: "AB12CD34EF",
  usedAt: t(-10),
  plan: { nama: "Paket Bulanan" },
  berlakuSampai: new Date("2026-11-20T10:00:00.000Z"),
  ...o,
});

const susun = (s: { invoice?: SumberInvoice[]; saldo?: SumberSaldo[]; voucher?: SumberVoucher[] }) =>
  susunRiwayatPembayaran({ invoice: s.invoice ?? [], saldo: s.saldo ?? [], voucher: s.voucher ?? [] }, SEKARANG);

describe("susunRiwayatPembayaran", () => {
  it("tanpa data: daftar kosong", () => {
    expect(susun({})).toEqual([]);
  });

  it("pembelian paket: judul = nama paket, jumlah = harga, status berhasil, cara bayar terbaca", () => {
    const [i] = susun({ invoice: [inv()] });
    expect(i).toMatchObject({
      id: "invoice:inv-1",
      jenis: "langganan",
      judul: "Paket Semester",
      jumlah: 149_000,
      status: "berhasil",
      metode: "affiliate.id",
    });
  });

  it.each([
    ["paid", "berhasil"],
    ["expired", "kedaluwarsa"],
    ["refunded", "dikembalikan"],
  ] as const)("status tagihan %s -> %s", (status, harapan) => {
    expect(susun({ invoice: [inv({ status })] })[0]!.status).toBe(harapan);
  });

  it("tagihan menunggu yang masih dalam batas bayar tetap 'menunggu'; yang batasnya lewat jadi 'kedaluwarsa'", () => {
    expect(susun({ invoice: [inv({ status: "pending", expiresAt: t(1) })] })[0]!.status).toBe("menunggu");
    expect(susun({ invoice: [inv({ status: "pending", expiresAt: t(-1) })] })[0]!.status).toBe("kedaluwarsa");
  });

  it("top-up berhasil: jenis topup, jumlah positif, memuat cara bayar", () => {
    expect(susun({ saldo: [sal()] })[0]).toMatchObject({ jenis: "topup", judul: "Top-up saldo", jumlah: 25_000, status: "berhasil", metode: "affiliate.id" });
  });

  it("top-up pending lewat batas jadi kedaluwarsa, gagal tetap gagal", () => {
    expect(susun({ saldo: [sal({ status: "pending", expiresAt: t(-1) })] })[0]!.status).toBe("kedaluwarsa");
    expect(susun({ saldo: [sal({ status: "pending", expiresAt: t(1) })] })[0]!.status).toBe("menunggu");
    expect(susun({ saldo: [sal({ status: "pending", expiresAt: null })] })[0]!.status).toBe("menunggu");
    expect(susun({ saldo: [sal({ status: "gagal" })] })[0]!.status).toBe("gagal");
  });

  it("pemakaian saldo (Learning Analytics): jumlah negatif, tanpa cara bayar", () => {
    const [i] = susun({ saldo: [sal({ id: "s2", tipe: "debit_analisis", jumlah: -4500, keterangan: "Learning Analytics Matematika", paymentChannel: null })] });
    expect(i).toMatchObject({ jenis: "pemakaian_saldo", judul: "Learning Analytics", jumlah: -4500, metode: null, keterangan: "Learning Analytics Matematika" });
  });

  it("penyesuaian admin (mis. pengembalian saldo): jenis tersendiri, tanda angka dipertahankan", () => {
    const [i] = susun({ saldo: [sal({ tipe: "penyesuaian_admin", jumlah: 4500, paymentChannel: null, keterangan: "Pengembalian analisis gagal" })] });
    expect(i).toMatchObject({ jenis: "penyesuaian_saldo", judul: "Penyesuaian saldo oleh admin", jumlah: 4500 });
  });

  it("keterangan kosong atau spasi menjadi null", () => {
    expect(susun({ saldo: [sal({ keterangan: "   " })] })[0]!.keterangan).toBeNull();
    expect(susun({ saldo: [sal({ keterangan: null })] })[0]!.keterangan).toBeNull();
  });

  it("voucher yang dipakai: tanpa nominal, memuat kode, paket, dan tanggal berlaku (WIB)", () => {
    const [i] = susun({ voucher: [vou()] });
    expect(i).toMatchObject({ id: "voucher:vou-1", jenis: "voucher", judul: "Voucher AB12CD34EF", jumlah: null, status: "berhasil", metode: "Kode voucher mitra" });
    expect(i!.keterangan).toBe("Paket Bulanan (berlaku sampai 20 November 2026)");
  });

  it("tanggal berlaku voucher memakai hari WIB, bukan UTC (23.00 UTC sudah hari berikutnya di WIB)", () => {
    const [i] = susun({ voucher: [vou({ berlakuSampai: new Date("2026-11-20T23:00:00.000Z") })] });
    expect(i!.keterangan).toBe("Paket Bulanan (berlaku sampai 21 November 2026)");
  });

  it("voucher tanpa masa berlaku: hanya nama paket", () => {
    expect(susun({ voucher: [vou({ berlakuSampai: null })] })[0]!.keterangan).toBe("Paket Bulanan");
  });

  it("voucher yang belum pernah dipakai tidak masuk riwayat", () => {
    expect(susun({ voucher: [vou({ usedAt: null })] })).toEqual([]);
  });

  it("semua sumber digabung dan diurutkan terbaru dulu", () => {
    const hasil = susun({
      invoice: [inv({ id: "a", createdAt: t(-2) })],
      saldo: [sal({ id: "b", createdAt: t(-1) }), sal({ id: "c", createdAt: t(-30) })],
      voucher: [vou({ id: "d", usedAt: t(-10) })],
    });
    expect(hasil.map((i) => i.id)).toEqual(["saldo:b", "invoice:a", "voucher:d", "saldo:c"]);
  });

  it("waktu yang sama: urutan tetap (menurut id) supaya tidak melompat antar muat", () => {
    const a = susun({ saldo: [sal({ id: "x", createdAt: t(-1) }), sal({ id: "y", createdAt: t(-1) })] });
    const b = susun({ saldo: [sal({ id: "y", createdAt: t(-1) }), sal({ id: "x", createdAt: t(-1) })] });
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
  });

  it("id unik walau id sumber sama (invoice dan saldo)", () => {
    const hasil = susun({ invoice: [inv({ id: "sama" })], saldo: [sal({ id: "sama" })] });
    expect(new Set(hasil.map((i) => i.id)).size).toBe(2);
  });

  it("hasil bisa diserialisasi JSON tanpa kehilangan arti (waktu = ISO string)", () => {
    const hasil = susun({ invoice: [inv()], saldo: [sal()], voucher: [vou()] });
    expect(JSON.parse(JSON.stringify(hasil))).toEqual(hasil);
    expect(typeof hasil[0]!.waktu).toBe("string");
  });
});

describe("labelMetode", () => {
  it.each([
    ["affiliate_id", "affiliate.id"],
    ["affiliate_manual", "Diaktifkan admin"],
    ["bank_transfer", "Transfer bank"],
    ["qris", "QRIS"],
    ["QRIS", "QRIS"],
    ["some_new_channel", "Some new channel"],
  ])("%s -> %s", (kanal, harapan) => {
    expect(labelMetode(kanal)).toBe(harapan);
  });

  it("kosong atau tak ada -> null", () => {
    expect(labelMetode(null)).toBeNull();
    expect(labelMetode(undefined)).toBeNull();
    expect(labelMetode("  ")).toBeNull();
  });
});

describe("RiwayatPembayaranView", () => {
  const item = susun({
    invoice: [inv()],
    saldo: [sal(), sal({ id: "s2", tipe: "debit_analisis", jumlah: -4500, keterangan: "LA Matematika", paymentChannel: null, createdAt: t(-1) })],
    voucher: [vou()],
  });
  const render = (o: Partial<Parameters<typeof RiwayatPembayaranView>[0]> = {}) =>
    renderToStaticMarkup(createElement(RiwayatPembayaranView, { item, saldo: 20_500, terpotong: false, sekolahMenanggung: null, ...o }));

  it("menampilkan semua jenis, jumlah bertanda, dan saldo saat ini", () => {
    const h = render();
    expect(h).toContain("Riwayat Pembayaran");
    expect(h).toContain("Paket Semester");
    expect(h).toContain("Rp149.000");
    expect(h).toContain("+Rp25.000");
    expect(h).toContain("-Rp4.500");
    expect(h).toContain("Voucher AB12CD34EF");
    expect(h).toContain("Berhasil");
    expect(h).toContain("via affiliate.id");
    expect(h).toMatch(/data-saldo-saat-ini[^>]*>Rp20\.500</);
  });

  it("cara bayar tidak diulang bila keterangan sudah menyebutnya; tetap ditambahkan bila belum", () => {
    const h = render();
    // top-up: keterangan "... via affiliate.id (otomatis)" sudah memuat cara bayar -> hanya satu "via affiliate.id" pada baris itu
    expect(h).toContain("Top-up saldo 25000 via affiliate.id (otomatis)");
    expect(h).not.toContain("(otomatis) · via affiliate.id");
    // pembelian paket: keterangan "Paket langganan" belum menyebutnya -> ditambahkan
    expect(h).toContain("Paket langganan · via affiliate.id");
  });

  it("saldo negatif (penyesuaian admin) tetap tampil bertanda minus, bukan seolah positif", () => {
    expect(render({ saldo: -4500 })).toMatch(/data-saldo-saat-ini[^>]*>-Rp4\.500</);
    expect(render({ saldo: 0 })).toMatch(/data-saldo-saat-ini[^>]*>Rp0</);
  });

  it("riwayat kosong: keadaan kosong dengan ajakan, tanpa tabel", () => {
    const h = render({ item: [] });
    expect(h).toContain("Belum ada pembayaran");
    expect(h).not.toContain("data-tabel-riwayat-pembayaran");
  });

  it("siswa yang ditanggung sekolah melihat keterangannya (tanggal berlaku)", () => {
    const h = render({ sekolahMenanggung: { berlakuSampai: "2026-12-31T16:59:59.999Z" } });
    expect(h).toContain("data-info-sekolah-menanggung");
    expect(h).toContain("31 Desember 2026");
  });

  it("tanpa sekolah menanggung: tidak ada keterangan itu", () => {
    expect(render()).not.toContain("data-info-sekolah-menanggung");
  });

  it("riwayat terpotong: pemberitahuan riwayat lama tidak ditampilkan", () => {
    expect(render({ terpotong: true })).toContain("Hanya riwayat terbaru");
    expect(render({ terpotong: false })).not.toContain("Hanya riwayat terbaru");
  });

  it("lebih dari 20 baris: dipotong 20 dengan tombol 'Tampilkan lebih banyak'", () => {
    const banyak = susun({ saldo: Array.from({ length: 25 }, (_, n) => sal({ id: `s${n}`, createdAt: t(-n - 1) })) });
    const h = render({ item: banyak });
    expect(h).toContain("Menampilkan 20 dari 25 riwayat");
    expect(h).toContain("Tampilkan lebih banyak");
    expect((h.match(/<tr/g) ?? []).length).toBe(21); // 20 baris + 1 baris judul kolom
  });

  it("satu halaman penuh: tidak ada tombol tambah", () => {
    expect(render()).not.toContain("Tampilkan lebih banyak");
  });
});
