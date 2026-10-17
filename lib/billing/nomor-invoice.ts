/**
 * Format nomor invoice sekolah: INV/AYOTKA/{tahun}/{bulan romawi}/{urut 3 digit}, mis. INV/AYOTKA/2026/X/001
 * (format pada desain invoice AyoTKA, 16 Okt 2026; sebelumnya INV/TKA/202610/0001). Urutan dihitung per bulan
 * (tahun + bulan WIB) dan mulai dari 001 lagi tiap bulan (kecuali bulan yang nomor awalnya sudah terpakai di luar
 * aplikasi, lihat URUTAN_TERPAKAI_DI_LUAR_APLIKASI). Murni (tanpa database) supaya diuji tabel kasus;
 * pengambilan nomor terakhir ada di lib/billing/school-invoice.ts.
 */
export const KODE_NOMOR_INVOICE = "AYOTKA";

const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"] as const;

/** Bulan 1-12 menjadi angka romawi; di luar rentang melempar galat (kesalahan pemrograman, bukan input pengguna). */
export function bulanRomawi(bulan: number): string {
  const r = ROMAWI[bulan - 1];
  if (!Number.isInteger(bulan) || !r) throw new RangeError(`Bulan tidak valid: ${bulan}`);
  return r;
}

/** Awalan semua nomor pada satu bulan, termasuk garis miring penutup: "INV/AYOTKA/2026/X/". */
export function awalanNomorInvoice(tahun: number, bulan: number): string {
  return awalanNomorInvoiceKode(KODE_NOMOR_INVOICE, tahun, bulan);
}

/**
 * Awalan untuk kode penerbit apa pun (Pembuat Invoice Admin Pusat: AYOTKA, ICN, atau kode sendiri): "INV/ICN/2026/X/".
 * Kode AYOTKA berbagi urutan dengan invoice sekolah (awalannya sama persis), jadi nomornya tidak pernah bentrok.
 */
export function awalanNomorInvoiceKode(kode: string, tahun: number, bulan: number): string {
  return `INV/${kode}/${tahun}/${bulanRomawi(bulan)}/`;
}

export function formatNomorInvoice(awalan: string, urut: number): string {
  return `${awalan}${String(urut).padStart(3, "0")}`;
}

/** Nomor urut di ujung nomor yang berawalan `awalan`; null bila bukan bagian dari awalan itu atau ekornya bukan angka murni. */
export function urutDariNomor(nomor: string, awalan: string): number | null {
  if (!nomor.startsWith(awalan)) return null;
  const ekor = nomor.slice(awalan.length);
  return /^\d{1,9}$/.test(ekor) ? parseInt(ekor, 10) : null;
}

/**
 * Nomor urut terbesar yang SUDAH DIPAKAI DI LUAR APLIKASI per bulan (kunci = awalan bulan): invoice yang diterbitkan
 * manual sebelum aplikasi menerbitkan nomor sendiri, jadi tidak ada barisnya di database. Aplikasi tidak pernah
 * menerbitkan nomor sampai angka itu, supaya dua invoice tidak memakai nomor yang sama.
 * - Oktober 2026: INV/AYOTKA/2026/X/001 sudah dipakai untuk MTsN 1 Kediri (keputusan pemilik, 16 Okt 2026: Oktober mulai dari 002).
 * Tambahkan baris di sini bila pemilik menerbitkan invoice manual lagi; bulan yang tidak tercantum mulai dari 001.
 */
const URUTAN_TERPAKAI_DI_LUAR_APLIKASI: Readonly<Record<string, number>> = {
  "INV/AYOTKA/2026/X/": 1,
};

/** Urutan terbesar yang sudah dipakai di luar aplikasi untuk awalan itu (0 bila tidak ada). */
export function urutTerpakaiDiLuarAplikasi(awalan: string): number {
  return URUTAN_TERPAKAI_DI_LUAR_APLIKASI[awalan] ?? 0;
}

/**
 * Nomor urut berikutnya: terbesar di antara nomor yang ada di database dan nomor yang sudah dipakai di luar aplikasi
 * (URUTAN_TERPAKAI_DI_LUAR_APLIKASI), + 1 (angka, bukan urutan huruf, jadi 999 -> 1000 tetap benar).
 * Nomor berformat lain atau rusak diabaikan.
 */
export function urutBerikutnya(nomorAda: string[], awalan: string): number {
  let maks = urutTerpakaiDiLuarAplikasi(awalan);
  for (const n of nomorAda) {
    const u = urutDariNomor(n, awalan);
    if (u !== null && u > maks) maks = u;
  }
  return maks + 1;
}
