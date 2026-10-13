import { perkiraanSoalDariBeban } from "@/lib/billing/beban-ai";

/**
 * Harga satu Learning Analytics (LA) tambahan yang dibayar dari saldo siswa. Mulai 12 Okt 2026 harganya TIDAK tunggal,
 * melainkan mengikuti BEBAN AI paket (lib/billing/beban-ai.ts: taksiran token masukan prompt analisis, yang bergantung pada
 * banyak dan panjangnya soal beserta pembahasannya): semakin berat beban AI-nya, semakin besar modalnya, jadi semakin tinggi
 * harganya, di antara harga minimum dan harga maksimum yang diatur admin pusat (bawaan Rp4.500 sampai Rp7.500).
 *
 * Aturan (satu-satunya tempat yang menghitung; modul ini murni, tanpa I/O, supaya dipakai bersama server dan layar admin):
 * - paket dengan beban <= `bebanRingan` : harga minimum;
 * - paket dengan beban >= `bebanBerat`  : harga maksimum;
 * - di antaranya naik LURUS, dibulatkan ke Rp500 terdekat, lalu dijaga tetap di antara minimum dan maksimum.
 * Harga paket yang sama selalu sama bagi semua siswa, jadi bisa ditampilkan sebelum ujian dan sama dengan yang ditagih.
 */
export type KonfigHargaLA = {
  /** Harga untuk paket ringan (rupiah). */
  hargaMin: number;
  /** Harga untuk paket berat (rupiah). */
  hargaMaks: number;
  /** Paket dengan beban AI (token masukan) sebesar ini atau kurang dihargai `hargaMin`. */
  bebanRingan: number;
  /** Paket dengan beban AI (token masukan) sebesar ini atau lebih dihargai `hargaMaks`. */
  bebanBerat: number;
};

export const KONFIG_HARGA_LA_BAWAAN: Readonly<KonfigHargaLA> = Object.freeze({
  hargaMin: 4_500,
  hargaMaks: 7_500,
  bebanRingan: 6_500,
  bebanBerat: 13_500,
});

/** Kelipatan pembulatan harga di antara minimum dan maksimum. */
export const LANGKAH_HARGA_LA = 500;

const BATAS_HARGA = 1_000_000;
const BATAS_BEBAN = 1_000_000;
const BEBAN_RINGAN_MINIMAL = 100;

const adalahBilanganBulat = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

/**
 * Memeriksa pengaturan dari admin. Setiap angka harus bilangan bulat; harga minimum minimal Rp500 (LA tidak boleh gratis
 * tanpa sengaja), harga maksimum tidak boleh di bawah minimum, dan batas beban "berat" harus lebih besar dari batas "ringan".
 */
export function validasiKonfigHargaLA(input: unknown): { ok: true; konfig: KonfigHargaLA } | { ok: false; error: string } {
  const k = (input ?? {}) as Partial<Record<keyof KonfigHargaLA, unknown>>;
  const { hargaMin, hargaMaks, bebanRingan, bebanBerat } = k;
  if (![hargaMin, hargaMaks, bebanRingan, bebanBerat].every(adalahBilanganBulat)) {
    return { ok: false, error: "Semua isian harus berupa angka bulat." };
  }
  const [min, maks, ringan, berat] = [hargaMin, hargaMaks, bebanRingan, bebanBerat] as number[];
  if (min! < LANGKAH_HARGA_LA) return { ok: false, error: `Harga minimum minimal Rp${LANGKAH_HARGA_LA}.` };
  if (maks! < min!) return { ok: false, error: "Harga maksimum tidak boleh lebih kecil dari harga minimum." };
  if (maks! > BATAS_HARGA) return { ok: false, error: `Harga maksimum tidak boleh lebih dari Rp${BATAS_HARGA.toLocaleString("id-ID")}.` };
  if (ringan! < BEBAN_RINGAN_MINIMAL) return { ok: false, error: `Batas beban ringan minimal ${BEBAN_RINGAN_MINIMAL} token.` };
  if (berat! <= ringan!) return { ok: false, error: "Batas beban berat harus lebih besar dari batas beban ringan." };
  if (berat! > BATAS_BEBAN) return { ok: false, error: `Batas beban berat tidak boleh lebih dari ${BATAS_BEBAN.toLocaleString("id-ID")} token.` };
  return { ok: true, konfig: { hargaMin: min!, hargaMaks: maks!, bebanRingan: ringan!, bebanBerat: berat! } };
}

/**
 * Pengaturan yang dibaca dari database dipakai apa adanya bila sah; bila tidak sah (diubah langsung di database, atau
 * rusak), SELURUHNYA diganti nilai bawaan - lebih aman daripada memakai sebagian angka yang tidak saling cocok.
 */
export function perbaikiKonfigHargaLA(raw: unknown): KonfigHargaLA {
  const hasil = validasiKonfigHargaLA(raw);
  return hasil.ok ? hasil.konfig : { ...KONFIG_HARGA_LA_BAWAAN };
}

/**
 * Harga satu LA tambahan untuk paket dengan `beban` token masukan (taksiran, lib/billing/beban-ai.ts). `beban` yang bukan
 * angka sah (NaN, negatif) dibaca sebagai 0 sehingga hasilnya harga minimum.
 */
export function hitungHargaLA(beban: number, konfigMentah: KonfigHargaLA = KONFIG_HARGA_LA_BAWAAN): number {
  const konfig = perbaikiKonfigHargaLA(konfigMentah);
  const n = Number.isFinite(beban) && beban > 0 ? Math.floor(beban) : 0;
  const { hargaMin, hargaMaks, bebanRingan, bebanBerat } = konfig;
  if (n <= bebanRingan) return hargaMin;
  if (n >= bebanBerat) return hargaMaks;
  const mentah = hargaMin + ((hargaMaks - hargaMin) * (n - bebanRingan)) / (bebanBerat - bebanRingan);
  const bulat = Math.round(mentah / LANGKAH_HARGA_LA) * LANGKAH_HARGA_LA;
  return Math.min(hargaMaks, Math.max(hargaMin, bulat));
}

/** Rentang harga untuk ditampilkan umum (mis. di halaman Wallet): termurah dan termahal. */
export function rentangHargaLA(konfigMentah: KonfigHargaLA = KONFIG_HARGA_LA_BAWAAN): { min: number; maks: number } {
  const { hargaMin, hargaMaks } = perbaikiKonfigHargaLA(konfigMentah);
  return { min: hargaMin, maks: hargaMaks };
}

/**
 * Contoh harga untuk pratinjau di layar admin: batas ringan, tiga titik di antaranya, dan batas berat, masing-masing dengan
 * perkiraan banyak soal berukuran biasa yang setara. Tanpa angka kembar, urut dari ringan ke berat.
 */
export function contohHargaLA(
  konfigMentah: KonfigHargaLA = KONFIG_HARGA_LA_BAWAAN,
): { beban: number; perkiraanSoal: number; harga: number }[] {
  const konfig = perbaikiKonfigHargaLA(konfigMentah);
  const { bebanRingan, bebanBerat } = konfig;
  const rentang = bebanBerat - bebanRingan;
  const titik = new Set<number>([
    bebanRingan,
    bebanRingan + Math.round(rentang * 0.25),
    bebanRingan + Math.round(rentang * 0.5),
    bebanRingan + Math.round(rentang * 0.75),
    bebanBerat,
  ]);
  return [...titik]
    .sort((a, b) => a - b)
    .map((beban) => ({ beban, perkiraanSoal: perkiraanSoalDariBeban(beban), harga: hitungHargaLA(beban, konfig) }));
}
