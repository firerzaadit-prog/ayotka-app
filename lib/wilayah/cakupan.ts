import {
  adalahProvinsi,
  adalahStatusSekolah,
  kabupatenKotaDiProvinsi,
  periksaPasanganWilayah,
  provinsiDariKabupatenKota,
  type StatusSekolah,
} from "@/lib/wilayah";

/**
 * Cakupan dan penyaringan data per wilayah/status sekolah. Murni (tanpa database): satu sumber aturan untuk akun
 * dinas pendidikan (provinsi atau kota/kabupaten), filter analitik admin pusat, dan pembanding wilayah laporan sekolah.
 */

/** Wilayah yang boleh dilihat sebuah akun. Keduanya null = semua wilayah (hanya admin pusat). */
export interface CakupanWilayah {
  provinsi: string | null;
  kabupatenKota: string | null;
}

/** Penyaring sekolah: wilayah (provinsi dan/atau kota/kabupaten) + status negeri/swasta; null = tidak disaring. */
export interface FilterWilayah {
  provinsi: string | null;
  kabupatenKota: string | null;
  statusSekolah: StatusSekolah | null;
}

export const FILTER_WILAYAH_KOSONG: FilterWilayah = { provinsi: null, kabupatenKota: null, statusSekolah: null };

export type HasilFilterWilayah = { ok: true; filter: FilterWilayah } | { ok: false; pesan: string; status: 400 | 403 };

/** Sekolah (baris database) yang cukup untuk dicocokkan dengan wilayah. */
export interface SekolahBerwilayah {
  /** Boleh tidak ikut dimuat: diturunkan dari kota/kabupaten bila kosong. */
  provinsi?: string | null;
  kabupatenKota?: string | null;
  statusSekolah?: StatusSekolah | null;
}

/** Provinsi sebuah sekolah; bila kolom provinsi kosong diturunkan dari nama kota/kabupatennya. */
export function provinsiSekolah(sekolah: Pick<SekolahBerwilayah, "provinsi" | "kabupatenKota">): string | null {
  return sekolah.provinsi ?? provinsiDariKabupatenKota(sekolah.kabupatenKota);
}

/**
 * Bagian `where` Prisma untuk tabel sekolah. Kota/kabupaten (unik nasional) sudah menentukan provinsinya; bila hanya
 * provinsi yang dipilih, sekolah yang kolom provinsinya masih kosong tetapi kota/kabupatennya ada di provinsi itu ikut
 * terhitung (selaras dengan sekolahCocok). Mengisi kunci `OR` hanya untuk filter provinsi.
 */
export function whereSekolahWilayah(f: Partial<FilterWilayah>) {
  return {
    ...(f.kabupatenKota
      ? { kabupatenKota: f.kabupatenKota }
      : f.provinsi
        ? { OR: [{ provinsi: f.provinsi }, { kabupatenKota: { in: [...kabupatenKotaDiProvinsi(f.provinsi)] } }] }
        : {}),
    ...(f.statusSekolah ? { statusSekolah: f.statusSekolah } : {}),
  };
}

/** Padanan dalam-memori dari whereSekolahWilayah (hasil keduanya harus sama). */
export function sekolahCocok(sekolah: SekolahBerwilayah | null | undefined, f: Partial<FilterWilayah>): boolean {
  if (!sekolah) return !f.kabupatenKota && !f.provinsi && !f.statusSekolah;
  if (f.kabupatenKota) {
    if (sekolah.kabupatenKota !== f.kabupatenKota) return false;
  } else if (f.provinsi && provinsiSekolah(sekolah) !== f.provinsi) {
    return false;
  }
  if (f.statusSekolah && sekolah.statusSekolah !== f.statusSekolah) return false;
  return true;
}

/** Akun dengan cakupan ini boleh melihat sekolah ini? Cakupan kosong = tidak boleh (gagal tertutup). */
export function sekolahDalamCakupan(sekolah: SekolahBerwilayah | null | undefined, cakupan: CakupanWilayah | null): boolean {
  if (!sekolah || !cakupan || (!cakupan.provinsi && !cakupan.kabupatenKota)) return false;
  return sekolahCocok(sekolah, { provinsi: cakupan.provinsi, kabupatenKota: cakupan.kabupatenKota });
}

export interface PermintaanFilterWilayah {
  provinsi?: string | null;
  kabupatenKota?: string | null;
  /** "semua"/kosong = tidak disaring. */
  statusSekolah?: string | null;
}

const kosongJadiNull = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
};

/**
 * Filter wilayah dari permintaan (parameter URL), dibatasi cakupan akun:
 * - admin pusat (cakupan kosong): bebas memilih provinsi / kota/kabupaten;
 * - dinas provinsi: hanya di provinsinya, boleh mempersempit ke satu kota/kabupaten di dalamnya;
 * - dinas kota/kabupaten: hanya kota/kabupatennya (permintaan ke wilayah lain ditolak 403, bukan diam-diam diabaikan).
 */
export function gabungkanFilterWilayah(cakupan: CakupanWilayah, diminta: PermintaanFilterWilayah): HasilFilterWilayah {
  const statusMentah = kosongJadiNull(diminta.statusSekolah);
  if (statusMentah && statusMentah !== "semua" && !adalahStatusSekolah(statusMentah)) {
    return { ok: false, pesan: "Status sekolah tidak valid.", status: 400 };
  }
  const statusSekolah = statusMentah && adalahStatusSekolah(statusMentah) ? statusMentah : null;

  const pasangan = periksaPasanganWilayah({ provinsi: diminta.provinsi, kabupatenKota: diminta.kabupatenKota });
  if (!pasangan.ok) return { ok: false, pesan: pasangan.pesan, status: 400 };
  const minta = pasangan.nilai;

  if (cakupan.kabupatenKota) {
    const provinsiCakupan = cakupan.provinsi ?? provinsiDariKabupatenKota(cakupan.kabupatenKota);
    if (
      (minta.kabupatenKota && minta.kabupatenKota !== cakupan.kabupatenKota) ||
      (minta.provinsi && minta.provinsi !== provinsiCakupan)
    ) {
      return { ok: false, pesan: "Wilayah itu di luar cakupan akunmu.", status: 403 };
    }
    return { ok: true, filter: { provinsi: provinsiCakupan, kabupatenKota: cakupan.kabupatenKota, statusSekolah } };
  }

  if (cakupan.provinsi) {
    if (!adalahProvinsi(cakupan.provinsi) || (minta.provinsi && minta.provinsi !== cakupan.provinsi)) {
      return { ok: false, pesan: "Wilayah itu di luar cakupan akunmu.", status: 403 };
    }
    return { ok: true, filter: { provinsi: cakupan.provinsi, kabupatenKota: minta.kabupatenKota, statusSekolah } };
  }

  return { ok: true, filter: { provinsi: minta.provinsi, kabupatenKota: minta.kabupatenKota, statusSekolah } };
}

/** Baca provinsi / kabupatenKota / statusSekolah dari parameter URL. */
export function bacaPermintaanFilterWilayah(params: URLSearchParams): PermintaanFilterWilayah {
  return {
    provinsi: params.get("provinsi"),
    kabupatenKota: params.get("kabupatenKota"),
    statusSekolah: params.get("statusSekolah"),
  };
}
