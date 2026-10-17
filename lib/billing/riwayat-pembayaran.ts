/**
 * Riwayat pembayaran siswa (halaman /siswa/pembayaran): satu daftar waktu-terbaru-dulu yang menggabungkan
 *  - pembelian paket langganan (tabel invoices; juga yang diaktifkan manual oleh admin),
 *  - top-up saldo, pemakaian saldo (Learning Analytics) dan penyesuaian admin (tabel saldo_transactions),
 *  - voucher mitra yang ditukar (tabel vouchers + masa berlaku dari entitlement-nya).
 * Murni (tanpa database) supaya aturan penggabungan, status, dan label diuji tabel kasus; pengambilan datanya ada di
 * lib/billing/riwayat-pembayaran-server.ts. Hasilnya hanya berisi teks/angka sederhana (waktu = ISO) supaya bisa
 * dikirim dari server ke komponen klien.
 */
export type JenisRiwayat = "langganan" | "topup" | "voucher" | "pemakaian_saldo" | "penyesuaian_saldo";
export type StatusRiwayat = "berhasil" | "menunggu" | "gagal" | "kedaluwarsa" | "dikembalikan";

export type ItemRiwayat = {
  /** Unik antar sumber: "<sumber>:<id>". */
  id: string;
  /** Waktu kejadian (ISO). */
  waktu: string;
  jenis: JenisRiwayat;
  judul: string;
  keterangan: string | null;
  /** Rupiah bertanda: positif = uang/saldo masuk atau jumlah dibayar, negatif = saldo terpakai; null = tanpa nominal (voucher). */
  jumlah: number | null;
  status: StatusRiwayat;
  /** Cara bayar yang mudah dibaca (mis. "affiliate.id"); null bila tidak dicatat. */
  metode: string | null;
};

export type SumberInvoice = {
  id: string;
  amount: number;
  status: "pending" | "paid" | "expired" | "refunded";
  paymentChannel: string | null;
  createdAt: Date;
  expiresAt: Date;
  plan: { nama: string };
};

export type SumberSaldo = {
  id: string;
  tipe: "topup" | "debit_analisis" | "penyesuaian_admin";
  status: "pending" | "berhasil" | "gagal";
  jumlah: number;
  keterangan: string | null;
  paymentChannel: string | null;
  createdAt: Date;
  expiresAt: Date | null;
};

export type SumberVoucher = {
  id: string;
  code: string;
  usedAt: Date | null;
  plan: { nama: string };
  /** Masa berlaku akses yang diberikan voucher ini (entitlement sumber voucher), bila ada. */
  berlakuSampai: Date | null;
};

const LABEL_METODE: Record<string, string> = {
  affiliate_id: "affiliate.id",
  affiliate_manual: "Diaktifkan admin",
  bank_transfer: "Transfer bank",
  echannel: "Mandiri Bill",
  gopay: "GoPay",
  shopeepay: "ShopeePay",
  qris: "QRIS",
  credit_card: "Kartu kredit",
  cstore: "Minimarket",
};

/** Cara bayar dari kode kanal pembayaran; kode tak dikenal dibuat terbaca ("some_channel" -> "Some channel"). */
export function labelMetode(kanal: string | null | undefined): string | null {
  const k = (kanal ?? "").trim();
  if (!k) return null;
  const dikenal = LABEL_METODE[k.toLowerCase()];
  if (dikenal) return dikenal;
  const terbaca = k.replace(/[_-]+/g, " ").trim();
  return terbaca.charAt(0).toUpperCase() + terbaca.slice(1);
}

const STATUS_INVOICE: Record<SumberInvoice["status"], StatusRiwayat> = {
  paid: "berhasil",
  pending: "menunggu",
  expired: "kedaluwarsa",
  refunded: "dikembalikan",
};

const STATUS_SALDO: Record<SumberSaldo["status"], StatusRiwayat> = {
  berhasil: "berhasil",
  pending: "menunggu",
  gagal: "gagal",
};

/** Tagihan yang menunggu tetapi batas bayarnya sudah lewat dianggap kedaluwarsa (statusnya di database tidak selalu diperbarui). */
function statusMenunggu(status: StatusRiwayat, batas: Date | null, now: Date): StatusRiwayat {
  return status === "menunggu" && batas && batas.getTime() < now.getTime() ? "kedaluwarsa" : status;
}

const JUDUL_SALDO: Record<SumberSaldo["tipe"], { jenis: JenisRiwayat; judul: string }> = {
  topup: { jenis: "topup", judul: "Top-up saldo" },
  debit_analisis: { jenis: "pemakaian_saldo", judul: "Learning Analytics" },
  penyesuaian_admin: { jenis: "penyesuaian_saldo", judul: "Penyesuaian saldo oleh admin" },
};

export function susunRiwayatPembayaran(
  sumber: { invoice: SumberInvoice[]; saldo: SumberSaldo[]; voucher: SumberVoucher[] },
  now: Date = new Date(),
): ItemRiwayat[] {
  const item: ItemRiwayat[] = [];

  for (const i of sumber.invoice) {
    item.push({
      id: `invoice:${i.id}`,
      waktu: i.createdAt.toISOString(),
      jenis: "langganan",
      judul: i.plan.nama,
      keterangan: "Paket langganan",
      jumlah: i.amount,
      status: statusMenunggu(STATUS_INVOICE[i.status], i.expiresAt, now),
      metode: labelMetode(i.paymentChannel),
    });
  }

  for (const s of sumber.saldo) {
    const { jenis, judul } = JUDUL_SALDO[s.tipe];
    item.push({
      id: `saldo:${s.id}`,
      waktu: s.createdAt.toISOString(),
      jenis,
      judul,
      keterangan: s.keterangan?.trim() || null,
      jumlah: s.jumlah,
      status: statusMenunggu(STATUS_SALDO[s.status], s.expiresAt, now),
      metode: s.tipe === "topup" ? labelMetode(s.paymentChannel) : null,
    });
  }

  for (const v of sumber.voucher) {
    // Voucher yang belum pernah dipakai tidak punya waktu kejadian: bukan bagian riwayat siswa ini.
    if (!v.usedAt) continue;
    item.push({
      id: `voucher:${v.id}`,
      waktu: v.usedAt.toISOString(),
      jenis: "voucher",
      judul: `Voucher ${v.code}`,
      keterangan: v.berlakuSampai ? `${v.plan.nama} (berlaku sampai ${tanggalIso(v.berlakuSampai)})` : v.plan.nama,
      jumlah: null,
      status: "berhasil",
      metode: "Kode voucher mitra",
    });
  }

  // Terbaru dulu; waktu sama diurutkan menurut id supaya urutannya selalu sama di setiap muat.
  return item.sort((a, b) => (a.waktu === b.waktu ? a.id.localeCompare(b.id) : a.waktu < b.waktu ? 1 : -1));
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Tanggal WIB "20 November 2026" tanpa pustaka tanggal (modul ini murni dan ikut ke komponen klien). */
function tanggalIso(d: Date): string {
  const wib = new Date(d.getTime() + 7 * 3_600_000);
  return `${wib.getUTCDate()} ${BULAN[wib.getUTCMonth()]} ${wib.getUTCFullYear()}`;
}

export const LABEL_JENIS_RIWAYAT: Record<JenisRiwayat, string> = {
  langganan: "Langganan",
  topup: "Top-up saldo",
  voucher: "Voucher",
  pemakaian_saldo: "Pemakaian saldo",
  penyesuaian_saldo: "Penyesuaian saldo",
};

export const LABEL_STATUS_RIWAYAT: Record<StatusRiwayat, string> = {
  berhasil: "Berhasil",
  menunggu: "Menunggu pembayaran",
  gagal: "Gagal",
  kedaluwarsa: "Kedaluwarsa",
  dikembalikan: "Dikembalikan",
};
