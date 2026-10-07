import { kodeJenjangMaster, kunciMaster, kunciTeksIndikator } from "./normalisasi";

export interface MasterRingkas {
  id: string;
  jenjang: string;
  namaMapel: string;
  teksKunci: string;
}

export interface SoalSumberIndikator {
  jenjang: string;
  mapel: string;
  indikator: string | null | undefined;
}

/**
 * Pencocok indikator: mengembalikan id indikator resmi bila teks indikator soal sumber PERSIS sama (setelah spasi
 * dirapikan dan huruf dibuat kecil) dengan sebuah indikator resmi pada jenjang dan mapel yang sama; selain itu null.
 * Tidak ada pencocokan mirip-mirip atau lewat nomor - lihat lib/indikator/normalisasi.ts.
 */
export function buatPencocokIndikator(master: MasterRingkas[]): (soal: SoalSumberIndikator) => string | null {
  const peta = new Map<string, string>();
  for (const m of master) peta.set(kunciMaster(m.jenjang, m.namaMapel, m.teksKunci), m.id);

  return (soal) => {
    const jenjang = kodeJenjangMaster(soal.jenjang);
    const kunci = kunciTeksIndikator(soal.indikator);
    if (!jenjang || !kunci || !soal.mapel?.trim()) return null;
    return peta.get(kunciMaster(jenjang, soal.mapel, kunci)) ?? null;
  };
}

/**
 * Untuk soal yang SUDAH diimpor sebelum fitur indikator ada: cocokkan soal di ayotka.id dengan soal sumbernya lewat
 * teks soal yang persis sama, lalu ambil teks indikator sumbernya. Soal yang teksnya muncul lebih dari sekali di sumber
 * dengan indikator berbeda dilewati (ambigu) - lebih baik kosong daripada salah. Hasil: id soal ayotka -> teks indikator.
 */
export function cocokkanSoalDenganSumber(
  soalAyotka: Array<{ id: string; teks: string }>,
  sumber: Array<{ teks: string; indikator: string | null | undefined }>,
): { cocok: Map<string, string>; ambigu: number; tanpaSumber: number; sumberTanpaIndikator: number } {
  const perTeks = new Map<string, Set<string>>();
  const teksTanpaIndikator = new Set<string>();
  for (const s of sumber) {
    const ind = (s.indikator ?? "").trim();
    if (!ind) {
      teksTanpaIndikator.add(s.teks);
      continue;
    }
    const set = perTeks.get(s.teks) ?? new Set<string>();
    set.add(ind);
    perTeks.set(s.teks, set);
  }

  const cocok = new Map<string, string>();
  let ambigu = 0;
  let tanpaSumber = 0;
  let sumberTanpaIndikator = 0;
  for (const q of soalAyotka) {
    const set = perTeks.get(q.teks);
    if (!set) {
      if (teksTanpaIndikator.has(q.teks)) sumberTanpaIndikator++;
      else tanpaSumber++;
      continue;
    }
    if (set.size > 1) {
      ambigu++;
      continue;
    }
    cocok.set(q.id, [...set][0]!);
  }
  return { cocok, ambigu, tanpaSumber, sumberTanpaIndikator };
}

export interface RingkasIndikatorImpor {
  /** false bila master indikator belum diunggah (semua soal otomatis "belum bisa dicocokkan"). */
  masterTersedia: boolean;
  total: number;
  /** Indikator soal sama persis dengan indikator resmi. */
  cocok: number;
  /** Soal punya indikator, tetapi bukan indikator resmi (tetap diimpor; masuk "di luar indikator resmi" di rapor). */
  tidakCocok: number;
  /** Soal tanpa indikator di sumbernya. */
  tanpa: number;
}

/** Ringkasan untuk pratinjau impor: berapa soal yang indikatornya resmi, tidak resmi, atau kosong. */
export function ringkasIndikatorImpor(
  soal: Array<{ indikator: string | null; indikatorResmiId: string | null }>,
  masterTersedia: boolean,
): RingkasIndikatorImpor {
  let cocok = 0;
  let tidakCocok = 0;
  let tanpa = 0;
  for (const s of soal) {
    if (!s.indikator?.trim()) tanpa++;
    else if (s.indikatorResmiId) cocok++;
    else tidakCocok++;
  }
  return { masterTersedia, total: soal.length, cocok, tidakCocok, tanpa };
}
