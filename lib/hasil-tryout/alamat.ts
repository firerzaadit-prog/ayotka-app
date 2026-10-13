/**
 * Filter halaman laporan <-> alamat (query string). Murni (tanpa React maupun server) supaya bisa diuji: halaman memakainya
 * untuk membangun query ke API dan untuk menyalin filter ke alamat peramban, jadi muat ulang atau membagikan tautan tetap
 * menampilkan hal yang sama.
 */
export type NilaiFilter = Record<string, string>;

/** Query string dari filter: hanya yang terisi dan BUKAN nilai bawaan (alamat tetap pendek), urut kunci supaya stabil. */
export function buatQuery(nilai: NilaiFilter, bawaan: NilaiFilter): string {
  const p = new URLSearchParams();
  for (const kunci of Object.keys(nilai).sort()) {
    const v = nilai[kunci] ?? "";
    if (v === "" || v === (bawaan[kunci] ?? "")) continue;
    p.set(kunci, v);
  }
  return p.toString();
}

/**
 * Nilai awal halaman dari alamat: hanya kunci yang dikenal, nilai berupa teks tunggal berpanjang wajar; sisanya dibuang.
 * Validasi isi (UUID, tanggal, jenis) dilakukan server; yang keliru di sini hanya membuat API menjawab 400 yang ditampilkan.
 */
export function bacaAwal(sumber: Record<string, string | string[] | undefined>, kunciDikenal: readonly string[]): NilaiFilter {
  const hasil: NilaiFilter = {};
  for (const kunci of kunciDikenal) {
    const mentah = sumber[kunci];
    const v = Array.isArray(mentah) ? mentah[0] : mentah;
    if (typeof v === "string" && v.length > 0 && v.length <= 200) hasil[kunci] = v;
  }
  return hasil;
}

/** Alamat halaman dengan filter terkini (tanpa kunci kosong/bawaan). */
export function alamatDenganFilter(jalur: string, nilai: NilaiFilter, bawaan: NilaiFilter): string {
  const q = buatQuery(nilai, bawaan);
  return q ? `${jalur}?${q}` : jalur;
}

/** Kunci filter yang dikenal tiap halaman (alamat selain ini diabaikan). */
export const KUNCI_FILTER = {
  rapor: ["jenis", "mapel", "paket", "dari", "sampai", "alumni", "cari", "urut", "halaman", "ukuran"],
  peringkat: ["jenis", "mapel", "dari", "sampai", "alumni", "minimal"],
  paket: ["jenis", "mapel", "dari", "sampai", "alumni", "urut"],
  detailPaket: ["jenis", "dari", "sampai", "alumni", "tab"],
} as const;
