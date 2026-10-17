import type { BarisIndikator, KelompokIndikator, LaporanIndikatorSiswa } from "@/lib/indikator/daya-serap";
import { bersihkanTeksIndikator } from "@/lib/indikator/tampilan";

/**
 * Baris tabel capaian di rapor web siswa (components/hasil/daya-serap-indikator.tsx): hierarki Elemen > Subelemen >
 * Kompetensi > Indikator (Matematika) atau Kompetensi > Subkompetensi > Indikator (Bahasa Indonesia), hanya dari
 * indikator yang muncul di soal percobaan ini. Murni (tanpa React/DB) supaya angkanya bisa diuji tanpa merender halaman.
 */
export interface BarisTabelCapaian {
  id: string;
  level: 1 | 2 | 3 | 4;
  /** Teks untuk tabel: "1. Bilangan" (tingkat 1), "› nama" (tingkat tengah), "• kalimat indikator" (daun). */
  teks: string;
  judulTampil: string;
  /** Kalimat indikator asli lengkap dengan nomor urutnya (teks bantu pembaca layar dan tooltip); hanya daun. */
  rawIndikatorTeks?: string;
  dayaSerap: number;
  /** Rujukan nasional; null bila tidak ada pembanding. */
  nasional: number | null;
  jmlSoal: number;
  skor: number;
  skorMaks: number;
  /** Nama kelompok laporan (tingkat 1) yang membawa vonis; hanya baris tingkat 1. */
  kelompokNama?: string;
}

const rata = (angka: Array<number | null | undefined>): number | null => {
  const n = angka.filter((v): v is number => typeof v === "number");
  return n.length === 0 ? null : n.reduce((a, b) => a + b, 0) / n.length;
};

const persen = (skor: number, maks: number) => (maks > 0 ? (skor / maks) * 100 : 0);

/** Ringkasan simpul tingkat tengah dari indikator di bawahnya (skor terbobot, rujukan nasional rata-rata biasa). */
function ringkasSimpul(isi: BarisIndikator[]) {
  const skor = isi.reduce((a, b) => a + b.skor, 0);
  const skorMaks = isi.reduce((a, b) => a + b.skorMaks, 0);
  return {
    dayaSerap: persen(skor, skorMaks),
    nasional: rata(isi.map((b) => b.nasional)),
    jmlSoal: isi.reduce((a, b) => a + b.jmlSoal, 0),
    skor,
    skorMaks,
  };
}

function barisKelompok(k: KelompokIndikator, nomor: number): BarisTabelCapaian {
  return {
    id: `l1-${nomor}`,
    level: 1,
    teks: `${nomor}. ${k.nama}`,
    judulTampil: k.nama,
    dayaSerap: k.dayaSerap,
    nasional: k.nasional,
    jmlSoal: k.jmlSoal,
    skor: k.skor,
    skorMaks: k.skorMaks,
    kelompokNama: k.nama,
  };
}

function barisDaun(b: BarisIndikator, level: 3 | 4, id: string): BarisTabelCapaian {
  return {
    id,
    level,
    teks: `• ${b.indikator}`,
    judulTampil: bersihkanTeksIndikator(b.indikator).judul,
    rawIndikatorTeks: b.indikator,
    dayaSerap: b.dayaSerap,
    nasional: b.nasional,
    jmlSoal: b.jmlSoal,
    skor: b.skor,
    skorMaks: b.skorMaks,
  };
}

function kelompokkanNama<T>(daftar: T[], nama: (t: T) => string): Map<string, T[]> {
  const peta = new Map<string, T[]>();
  for (const t of daftar) {
    const n = nama(t);
    const l = peta.get(n);
    if (l) l.push(t);
    else peta.set(n, [t]);
  }
  return peta;
}

/**
 * Hierarki dari indikator yang diuji pada percobaan ini. Baris tingkat 1 memakai angka resmi kelompok laporan (skor
 * terbobot menurut soal, rujukan nasional terbobot, dan nama kelompok untuk vonis).
 */
export function bangunBarisDiuji(laporan: LaporanIndikatorSiswa): BarisTabelCapaian[] {
  const matematika = laporan.jumlahTingkat === 4;
  const baris: BarisTabelCapaian[] = [];
  let i1 = 1;
  for (const k of laporan.kelompok) {
    baris.push(barisKelompok(k, i1));
    let i2 = 1;
    for (const [nama2, item2] of kelompokkanNama(k.baris, (b) => b.level2 || "-")) {
      baris.push({ id: `l2-${i1}-${i2}`, level: 2, teks: `› ${nama2}`, judulTampil: nama2, ...ringkasSimpul(item2) });
      if (matematika) {
        let i3 = 1;
        for (const [nama3, item3] of kelompokkanNama(item2, (b) => b.level3 || "-")) {
          baris.push({ id: `l3-${i1}-${i2}-${i3}`, level: 3, teks: `› ${nama3}`, judulTampil: nama3, ...ringkasSimpul(item3) });
          for (const b of item3) baris.push(barisDaun(b, 4, `l4-${b.indikatorId || b.urutan}`));
          i3++;
        }
      } else {
        for (const b of item2) baris.push(barisDaun(b, 3, `l3-${b.indikatorId || b.urutan}`));
      }
      i2++;
    }
    i1++;
  }
  return baris;
}
