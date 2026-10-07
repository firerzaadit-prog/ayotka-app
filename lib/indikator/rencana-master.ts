import type { BarisMaster } from "./master";
import { kunciMaster } from "./normalisasi";

/** Baris master yang sudah ada di database (hanya kolom yang dibandingkan). */
export interface MasterTersimpan {
  id: string;
  jenjang: string;
  namaMapel: string;
  teksKunci: string;
  kdMapel: string;
  elemen: string;
  subelemen: string;
  kompetensi: string;
  subkompetensi: string | null;
  indikator: string;
  urutan: number;
  nilaiNasional: number | null;
}

export type DataPerbaruiMaster = Pick<
  BarisMaster,
  "kdMapel" | "namaMapel" | "elemen" | "subelemen" | "kompetensi" | "subkompetensi" | "indikator" | "urutan" | "nilaiNasional"
>;

export interface RencanaSimpanMaster {
  buat: BarisMaster[];
  perbarui: Array<{ id: string; data: DataPerbaruiMaster }>;
  samaPersis: number;
  /** Indikator yang ada di database tetapi tidak ada di berkas baru. TIDAK dihapus (soal yang menaut padanya tetap utuh). */
  tidakAdaDiBerkas: number;
}

const FIELD: Array<keyof DataPerbaruiMaster> = [
  "kdMapel",
  "namaMapel",
  "elemen",
  "subelemen",
  "kompetensi",
  "subkompetensi",
  "indikator",
  "urutan",
  "nilaiNasional",
];

/**
 * Unggah ulang master aman diulang: indikator dikenali dari jenjang + mapel + teks (kunci pencocokan), yang berubah
 * isinya (mis. nilai nasional baru) diperbarui, yang sama persis dibiarkan, yang baru ditambahkan. Indikator yang tidak
 * ada di berkas baru TIDAK dihapus: soal yang sudah menaut padanya akan kehilangan tautan, dan rapor lama berubah.
 */
export function rencanaSimpanMaster(ada: MasterTersimpan[], baru: BarisMaster[]): RencanaSimpanMaster {
  const peta = new Map(ada.map((a) => [kunciMaster(a.jenjang, a.namaMapel, a.teksKunci), a]));
  const dipakai = new Set<string>();
  const buat: BarisMaster[] = [];
  const perbarui: RencanaSimpanMaster["perbarui"] = [];
  let samaPersis = 0;

  for (const b of baru) {
    const kunci = kunciMaster(b.jenjang, b.namaMapel, b.teksKunci);
    const lama = peta.get(kunci);
    if (!lama) {
      buat.push(b);
      continue;
    }
    dipakai.add(kunci);
    const data: DataPerbaruiMaster = {
      kdMapel: b.kdMapel,
      namaMapel: b.namaMapel,
      elemen: b.elemen,
      subelemen: b.subelemen,
      kompetensi: b.kompetensi,
      subkompetensi: b.subkompetensi,
      indikator: b.indikator,
      urutan: b.urutan,
      nilaiNasional: b.nilaiNasional,
    };
    if (FIELD.every((f) => lama[f] === data[f])) samaPersis++;
    else perbarui.push({ id: lama.id, data });
  }

  return { buat, perbarui, samaPersis, tidakAdaDiBerkas: ada.length - dipakai.size };
}
