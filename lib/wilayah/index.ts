import { DATA_WILAYAH_INDONESIA } from "@/lib/constants/wilayah-indonesia";

/**
 * Wilayah sekolah se-Indonesia (provinsi + kabupaten/kota) dan status sekolah (negeri/swasta). Murni (tanpa database
 * dan tanpa "server-only"): dipakai server (validasi, filter analitik) dan client (dropdown bertingkat).
 *
 * Kabupaten/kota disimpan sebagai NAMA ("Kabupaten Malang", "Kota Malang"); nama itu unik secara nasional (diperiksa
 * saat daftar wilayah dibuat), jadi provinsinya selalu bisa diturunkan dari nama kabupaten/kota. Kolom provinsi tetap
 * disimpan terpisah agar sekolah yang baru diketahui provinsinya tetap bisa dipetakan.
 */

export const DAFTAR_PROVINSI: readonly string[] = DATA_WILAYAH_INDONESIA.map((d) => d.provinsi);

const KAB_KOTA_PER_PROVINSI = new Map<string, readonly string[]>(DATA_WILAYAH_INDONESIA.map((d) => [d.provinsi, d.kabupatenKota]));
const PROVINSI_PER_KAB_KOTA = new Map<string, string>(
  DATA_WILAYAH_INDONESIA.flatMap((d) => d.kabupatenKota.map((k) => [k, d.provinsi] as const)),
);

export const JUMLAH_KABUPATEN_KOTA = PROVINSI_PER_KAB_KOTA.size;

export function adalahProvinsi(nilai: string): boolean {
  return KAB_KOTA_PER_PROVINSI.has(nilai);
}

export function adalahKabupatenKota(nilai: string): boolean {
  return PROVINSI_PER_KAB_KOTA.has(nilai);
}

/** Kabupaten/kota di sebuah provinsi (kosong bila provinsinya tidak dikenal). */
export function kabupatenKotaDiProvinsi(provinsi: string | null | undefined): readonly string[] {
  return (provinsi && KAB_KOTA_PER_PROVINSI.get(provinsi)) || [];
}

/** Provinsi tempat sebuah kabupaten/kota berada; null bila namanya tidak dikenal. */
export function provinsiDariKabupatenKota(kabupatenKota: string | null | undefined): string | null {
  return (kabupatenKota && PROVINSI_PER_KAB_KOTA.get(kabupatenKota)) || null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Status sekolah
// ---------------------------------------------------------------------------------------------------------------------

export const STATUS_SEKOLAH = ["negeri", "swasta"] as const;
export type StatusSekolah = (typeof STATUS_SEKOLAH)[number];

export const LABEL_STATUS_SEKOLAH: Record<StatusSekolah, string> = { negeri: "Negeri", swasta: "Swasta" };

export function adalahStatusSekolah(nilai: unknown): nilai is StatusSekolah {
  return typeof nilai === "string" && (STATUS_SEKOLAH as readonly string[]).includes(nilai);
}

/** Isian formulir -> nilai kolom: "" / tidak ada = null; nilai selain negeri/swasta juga null (sudah ditolak skema). */
export function statusSekolahUntukSimpan(nilai: string | null | undefined): StatusSekolah | null {
  return adalahStatusSekolah(nilai) ? nilai : null;
}

/** Label tampilan; "-" bila belum diisi. */
export function labelStatusSekolah(nilai: string | null | undefined): string {
  return adalahStatusSekolah(nilai) ? LABEL_STATUS_SEKOLAH[nilai] : "-";
}

// ---------------------------------------------------------------------------------------------------------------------
// Pasangan provinsi + kabupaten/kota milik sekolah
// ---------------------------------------------------------------------------------------------------------------------

export interface WilayahSekolah {
  provinsi: string | null;
  kabupatenKota: string | null;
}

/** Isian dari formulir/API: undefined = tidak diubah, "" atau null = dikosongkan. */
export interface MasukanWilayah {
  provinsi?: string | null;
  kabupatenKota?: string | null;
}

export type HasilWilayah = { ok: true; nilai: WilayahSekolah } | { ok: false; pesan: string };

const bersih = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
};

/**
 * Periksa dan lengkapi pasangan provinsi + kabupaten/kota: kabupaten/kota tanpa provinsi dilengkapi provinsinya
 * (formulir lama hanya mengirim kabupaten/kota), nama yang tidak dikenal ditolak, dan kabupaten/kota harus berada di
 * provinsi yang dipilih.
 */
export function periksaPasanganWilayah(masukan: MasukanWilayah): HasilWilayah {
  const provinsi = bersih(masukan.provinsi);
  const kabupatenKota = bersih(masukan.kabupatenKota);
  if (provinsi && !adalahProvinsi(provinsi)) return { ok: false, pesan: "Pilih provinsi yang valid." };
  if (kabupatenKota && !adalahKabupatenKota(kabupatenKota)) return { ok: false, pesan: "Pilih kota/kabupaten yang valid." };
  if (kabupatenKota) {
    const asal = provinsiDariKabupatenKota(kabupatenKota)!;
    if (provinsi && provinsi !== asal) {
      return { ok: false, pesan: `${kabupatenKota} berada di Provinsi ${asal}, bukan di ${provinsi}. Pilih ulang kota/kabupaten.` };
    }
    return { ok: true, nilai: { provinsi: asal, kabupatenKota } };
  }
  return { ok: true, nilai: { provinsi, kabupatenKota: null } };
}

/**
 * Wilayah sekolah SETELAH perubahan sebagian (PATCH): isian yang tidak dikirim mengikuti data sebelumnya.
 * - kabupaten/kota dikirim tanpa provinsi: provinsi mengikuti kabupaten/kota itu (klien lama);
 * - provinsi diganti tanpa kabupaten/kota: kabupaten/kota lama harus masih berada di provinsi baru, bila tidak
 *   perubahan ditolak (tidak diam-diam mengosongkan atau memindahkan wilayah dinas).
 */
export function wilayahSetelahPerubahan(masukan: MasukanWilayah, sebelumnya: WilayahSekolah): HasilWilayah {
  const kabDikirim = masukan.kabupatenKota !== undefined;
  const provDikirim = masukan.provinsi !== undefined;
  if (!kabDikirim && !provDikirim) return { ok: true, nilai: { ...sebelumnya } };
  const kabupatenKota = kabDikirim ? bersih(masukan.kabupatenKota) : sebelumnya.kabupatenKota;
  // Klien lama (hanya kabupaten/kota): provinsi ikut kabupaten/kota yang dikirim, bukan data lama.
  const provinsi = provDikirim ? bersih(masukan.provinsi) : kabDikirim && kabupatenKota ? null : sebelumnya.provinsi;
  return periksaPasanganWilayah({ provinsi, kabupatenKota });
}
