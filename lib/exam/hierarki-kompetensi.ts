import { kunciNamaHierarki, type UrutanHierarkiResmi } from "@/lib/indikator/hierarki-resmi";

/**
 * Hierarki kompetensi untuk rapor siswa: Elemen > Subelemen > Kompetensi, dengan capaian siswa di tiap simpul (jumlah
 * benar, jumlah soal, persen). Sumbernya competency_scores (satu baris per Kompetensi pada satu percobaan), jadi tersedia
 * untuk SEMUA percobaan - berbeda dengan daya serap per indikator resmi yang hanya ada bila soalnya tertaut ke indikator.
 * Fungsi murni (tanpa I/O) supaya mudah dites terpisah dari query Prisma.
 */

export type SkorKompetensi = {
  kompetensiId: string;
  elemenId: string;
  /** Nama elemen untuk ditampilkan (sudah disesuaikan Kerangka Asesmen, lihat lib/content/label-elemen.ts). */
  elemenNama: string;
  /** Nama elemen persis di database; dipakai (selain elemenNama) untuk mencocokkan urutan resmi. */
  elemenNamaAsli?: string;
  elemenUrutan: number;
  subElemen: string;
  kompetensi: string;
  /** Level kognitif ("L1" | "L2" | "L3"); mengurutkan kompetensi dalam satu subelemen dari yang paling dasar. */
  level: string;
  jmlBenar: number;
  jmlSoal: number;
};

export type BarisHierarkiKompetensi = {
  id: string;
  level: 1 | 2 | 3;
  /** Nomor urut elemen (hanya level 1), mis. 1 untuk "1. Bilangan". */
  nomor?: number;
  teks: string;
  jmlBenar: number;
  jmlSoal: number;
  /** null bila tidak ada soal (jmlSoal = 0). */
  persentase: number | null;
};

const SUBELEMEN_KOSONG = "Lainnya";
const SESUDAH_RESMI = 1000; // elemen/subelemen yang tidak dikenal di hierarki resmi diurutkan sesudah yang dikenal

const persen = (benar: number, soal: number) => (soal > 0 ? (benar / soal) * 100 : null);

/**
 * @param urutanResmi urutan elemen/subelemen resmi (urutanHierarkiResmi); null = urutkan memakai urutan elemen di database
 *   dan nama subelemen secara abjad. Yang tidak ada di urutan resmi selalu ditaruh sesudah yang ada.
 */
export function bangunHierarkiKompetensi(skor: SkorKompetensi[], urutanResmi: UrutanHierarkiResmi | null = null): BarisHierarkiKompetensi[] {
  type Sub = { nama: string; kunci: string; baris: SkorKompetensi[] };
  type Elemen = { id: string; nama: string; kuncis: string[]; urutan: number; subs: Map<string, Sub> };
  const daftar = new Map<string, Elemen>();

  for (const s of skor) {
    let e = daftar.get(s.elemenId);
    if (!e) {
      e = {
        id: s.elemenId,
        nama: s.elemenNama,
        kuncis: [kunciNamaHierarki(s.elemenNamaAsli ?? s.elemenNama), kunciNamaHierarki(s.elemenNama)],
        urutan: s.elemenUrutan,
        subs: new Map(),
      };
      daftar.set(s.elemenId, e);
    }
    const namaSub = s.subElemen?.trim() ? s.subElemen.trim() : SUBELEMEN_KOSONG;
    const kunciSub = kunciNamaHierarki(namaSub);
    let sub = e.subs.get(kunciSub);
    if (!sub) {
      sub = { nama: namaSub, kunci: kunciSub, baris: [] };
      e.subs.set(kunciSub, sub);
    }
    sub.baris.push(s);
  }

  const indeksElemen = (e: Elemen): number => {
    if (!urutanResmi) return -1;
    for (const k of e.kuncis) {
      const i = urutanResmi.elemen.indexOf(k);
      if (i >= 0) return i;
    }
    return -1;
  };
  const elemenUrut = [...daftar.values()].sort((a, b) => {
    const ia = indeksElemen(a);
    const ib = indeksElemen(b);
    const ka = ia >= 0 ? ia : SESUDAH_RESMI + a.urutan;
    const kb = ib >= 0 ? ib : SESUDAH_RESMI + b.urutan;
    return ka - kb || a.nama.localeCompare(b.nama, "id");
  });

  const hasil: BarisHierarkiKompetensi[] = [];
  elemenUrut.forEach((e, idxElemen) => {
    const subResmi = urutanResmi ? (e.kuncis.map((k) => urutanResmi.subelemen.get(k)).find(Boolean) ?? []) : [];
    const subUrut = [...e.subs.values()].sort((a, b) => {
      const ia = subResmi.indexOf(a.kunci);
      const ib = subResmi.indexOf(b.kunci);
      const ka = ia >= 0 ? ia : SESUDAH_RESMI;
      const kb = ib >= 0 ? ib : SESUDAH_RESMI;
      return ka - kb || a.nama.localeCompare(b.nama, "id");
    });

    const semua = subUrut.flatMap((s) => s.baris);
    const benarE = semua.reduce((n, s) => n + s.jmlBenar, 0);
    const soalE = semua.reduce((n, s) => n + s.jmlSoal, 0);
    hasil.push({ id: `e-${e.id}`, level: 1, nomor: idxElemen + 1, teks: e.nama, jmlBenar: benarE, jmlSoal: soalE, persentase: persen(benarE, soalE) });

    for (const sub of subUrut) {
      const benarS = sub.baris.reduce((n, s) => n + s.jmlBenar, 0);
      const soalS = sub.baris.reduce((n, s) => n + s.jmlSoal, 0);
      hasil.push({ id: `s-${e.id}-${sub.kunci}`, level: 2, teks: sub.nama, jmlBenar: benarS, jmlSoal: soalS, persentase: persen(benarS, soalS) });

      const kompetensi = [...sub.baris].sort((a, b) => a.level.localeCompare(b.level) || a.kompetensi.localeCompare(b.kompetensi, "id"));
      for (const k of kompetensi) {
        hasil.push({ id: `k-${k.kompetensiId}`, level: 3, teks: k.kompetensi, jmlBenar: k.jmlBenar, jmlSoal: k.jmlSoal, persentase: persen(k.jmlBenar, k.jmlSoal) });
      }
    }
  });
  return hasil;
}
