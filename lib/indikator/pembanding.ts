import { LABEL_STATUS_SEKOLAH } from "@/lib/wilayah";
import type { FilterWilayah } from "@/lib/wilayah/cakupan";

/**
 * Pembanding "pengguna AyoTKA" untuk laporan sekolah: rerata daya serap seluruh sekolah AyoTKA pada wilayah (nasional,
 * provinsi, atau kota/kabupaten) dan status sekolah (negeri/swasta) yang dipilih, seperti filter Wilayah dan Status
 * Sekolah di portal hasil TKA. Murni (tanpa database): agregat mentah dihitung di lib/indikator/pembanding-wilayah.ts.
 *
 * PRIVASI: sekolah hanya melihat angka gabungan. Pembanding baru ditampilkan bila minimal MIN_SEKOLAH_PEMBANDING sekolah
 * berbeda (termasuk sekolah itu sendiri) punya data, supaya hasil satu sekolah lain tidak bisa dibaca dari angkanya;
 * identitas sekolah lain tidak pernah dikirim. Per indikator ditambah syarat MIN_JAWABAN_PEMBANDING jawaban.
 */
export const MIN_SEKOLAH_PEMBANDING = 3;
export const MIN_JAWABAN_PEMBANDING = 10;

/** Agregat satu indikator resmi pada seluruh sekolah dalam cakupan (percobaan pertama tiap siswa pada tiap paket). */
export interface AgregatIndikatorWilayah {
  indikatorId: string;
  skor: number;
  skorMaks: number;
  jmlSoal: number;
  jmlSekolah: number;
}

/** Agregat satu sekolah (semua soal berindikator pada mapel itu). Hanya dipakai untuk menghitung angka gabungan. */
export interface AgregatSekolahWilayah {
  schoolId: string;
  skor: number;
  skorMaks: number;
  jmlSiswa: number;
}

export interface PembandingIndikator {
  /** 0-100. */
  dayaSerap: number;
  jmlJawaban: number;
  jmlSekolah: number;
}

export interface SebaranSekolah {
  kuartil1: number;
  median: number;
  kuartil3: number;
}

export interface PosisiSekolah {
  /** 1 = tertinggi; sekolah dengan daya serap sama berbagi peringkat. */
  peringkat: number;
  /** Jumlah sekolah yang punya data pada cakupan ini (termasuk sekolah ini). */
  dari: number;
  /** Persentase sekolah LAIN yang daya serapnya lebih rendah (0-100). */
  persentil: number;
}

export interface PembandingWilayah {
  filter: FilterWilayah;
  /** Teks cakupan, mis. "Provinsi Jawa Timur · Negeri". */
  label: string;
  jumlahSekolah: number;
  jumlahSiswa: number;
  /** false = belum cukup sekolah; semua angka pembanding dikosongkan. */
  cukup: boolean;
  /** Daya serap gabungan seluruh sekolah dalam cakupan (tertimbang skor maksimum), null bila belum cukup. */
  rerata: number | null;
  sebaran: SebaranSekolah | null;
  /** Posisi sekolah pemilik laporan; null bila belum cukup atau sekolahnya tidak termasuk cakupan (mis. provinsi lain). */
  posisi: PosisiSekolah | null;
  /** Hanya indikator yang lolos ambang. */
  perIndikator: Record<string, PembandingIndikator>;
}

const persen = (skor: number, maks: number) => (maks > 0 ? (skor / maks) * 100 : 0);

/** "Nasional", "Provinsi Jawa Timur", atau nama kota/kabupaten; ditambah " · Negeri"/" · Swasta" bila status dipilih. */
export function labelCakupanPembanding(filter: FilterWilayah): string {
  const wilayah = filter.kabupatenKota ?? (filter.provinsi ? `Provinsi ${filter.provinsi}` : "Nasional");
  const status = filter.statusSekolah ? LABEL_STATUS_SEKOLAH[filter.statusSekolah] : "Negeri + Swasta";
  return `${wilayah} · ${status}`;
}

/** Persentil dengan interpolasi linear pada larik terurut naik. */
function persentil(urut: number[], p: number): number {
  if (urut.length === 0) return 0;
  const idx = (urut.length - 1) * p;
  const bawah = Math.floor(idx);
  const atas = Math.ceil(idx);
  return urut[bawah]! + (urut[atas]! - urut[bawah]!) * (idx - bawah);
}

/** Susun pembanding dari agregat mentah. `schoolIdSendiri` dipakai hanya untuk menentukan posisi sekolah pemilik laporan. */
export function susunPembanding(input: {
  filter: FilterWilayah;
  indikator: AgregatIndikatorWilayah[];
  sekolah: AgregatSekolahWilayah[];
  schoolIdSendiri: string;
}): PembandingWilayah {
  const sekolah = input.sekolah.filter((s) => s.skorMaks > 0);
  const dasar = {
    filter: input.filter,
    label: labelCakupanPembanding(input.filter),
    jumlahSekolah: sekolah.length,
    jumlahSiswa: sekolah.reduce((a, s) => a + s.jmlSiswa, 0),
  };
  if (sekolah.length < MIN_SEKOLAH_PEMBANDING) {
    return { ...dasar, cukup: false, rerata: null, sebaran: null, posisi: null, perIndikator: {} };
  }

  const dayaPerSekolah = sekolah.map((s) => ({ schoolId: s.schoolId, daya: persen(s.skor, s.skorMaks) }));
  const urut = dayaPerSekolah.map((s) => s.daya).sort((a, b) => a - b);
  const sendiri = dayaPerSekolah.find((s) => s.schoolId === input.schoolIdSendiri);
  const lebihRendah = sendiri ? dayaPerSekolah.filter((s) => s.daya < sendiri.daya).length : 0;
  const lebihTinggi = sendiri ? dayaPerSekolah.filter((s) => s.daya > sendiri.daya).length : 0;

  const perIndikator: Record<string, PembandingIndikator> = {};
  for (const i of input.indikator) {
    if (i.jmlSekolah < MIN_SEKOLAH_PEMBANDING || i.jmlSoal < MIN_JAWABAN_PEMBANDING || !(i.skorMaks > 0)) continue;
    perIndikator[i.indikatorId] = { dayaSerap: persen(i.skor, i.skorMaks), jmlJawaban: i.jmlSoal, jmlSekolah: i.jmlSekolah };
  }

  return {
    ...dasar,
    cukup: true,
    rerata: persen(
      sekolah.reduce((a, s) => a + s.skor, 0),
      sekolah.reduce((a, s) => a + s.skorMaks, 0),
    ),
    sebaran: { kuartil1: persentil(urut, 0.25), median: persentil(urut, 0.5), kuartil3: persentil(urut, 0.75) },
    posisi: sendiri
      ? {
          peringkat: lebihTinggi + 1,
          dari: sekolah.length,
          persentil: sekolah.length > 1 ? (lebihRendah / (sekolah.length - 1)) * 100 : 0,
        }
      : null,
    perIndikator,
  };
}
