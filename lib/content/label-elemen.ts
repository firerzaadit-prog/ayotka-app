/**
 * Label elemen yang DITAMPILKAN kepada siswa, sekolah, dan pada rapor/laporan (web, PDF, Excel).
 *
 * Penamaan elemen mengikuti Kerangka Asesmen TKA (Perkaban No. 047/H/AN/2025; lihat lib/content/kerangka-asesmen.ts).
 * Master indikator dari portal resmi (kemendikdasmen-official.json) dan taksonomi hasil impor soal memakai nama yang
 * sedikit berbeda untuk SD Matematika: "Data dan Ketidakpastian", sedangkan Kerangka Asesmen menamainya "Data"
 * (temuan audit kesesuaian elemen, 8 Okt 2026). Agar rapor sama dengan kerangka, selisih itu dipetakan SAAT DITAMPILKAN
 * saja - data di database (IndikatorResmi.elemen, Elemen.nama) dan pencocokan soal-ke-indikator tidak diubah, sehingga
 * impor ulang master atau soal tetap aman. Murni (tanpa database dan tanpa "server-only"): dipakai server dan client.
 */

interface AturanLabelElemen {
  jenjang: string;
  /** Nama mapel mengandung kata ini (tanpa membedakan huruf besar/kecil). */
  mapel: string;
  /** Nama elemen di data (sudah dinormalkan: huruf kecil, spasi tunggal). */
  dari: string;
  /** Nama elemen menurut Kerangka Asesmen. */
  ke: string;
}

const ATURAN: readonly AturanLabelElemen[] = [{ jenjang: "SD", mapel: "matematika", dari: "data dan ketidakpastian", ke: "Data" }];

const normal = (teks: string) => teks.trim().replace(/\s+/g, " ").toLowerCase();

/** Jenjang + mata pelajaran tempat sebuah elemen berada (nama mapel seperti di tabel Subject / IndikatorResmi). */
export interface KonteksElemen {
  jenjang: string;
  namaMapel: string;
}

/**
 * Nama elemen sesuai Kerangka Asesmen untuk ditampilkan. Elemen yang tidak termasuk aturan dikembalikan apa adanya
 * (termasuk elemen yang sama persis di jenjang lain, mis. "Data dan Peluang" di SMP).
 */
export function labelElemenTampil(konteks: KonteksElemen, elemen: string): string {
  const jenjang = konteks.jenjang.trim().toUpperCase();
  const mapel = konteks.namaMapel.toLowerCase();
  const kunci = normal(elemen);
  for (const a of ATURAN) {
    if (a.jenjang === jenjang && mapel.includes(a.mapel) && a.dari === kunci) return a.ke;
  }
  return elemen;
}

/** Bentuk hasil query Prisma `elemen: { select: { nama, subject: { select: { nama, jenjang } } } }`. */
export interface ElemenDenganMapel {
  nama: string;
  subject: { nama: string; jenjang: string };
}

/** Sama dengan labelElemenTampil, untuk elemen taksonomi yang dimuat bersama mapelnya. */
export function namaElemenTampil(elemen: ElemenDenganMapel): string {
  return labelElemenTampil({ jenjang: elemen.subject.jenjang, namaMapel: elemen.subject.nama }, elemen.nama);
}
