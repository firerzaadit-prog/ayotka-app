import { tanggalWIB } from "../utils/datetime";

/**
 * Pilihan cepat rentang tanggal untuk filter analitik lintas sekolah. Semua dihitung dari TANGGAL KALENDER WIB (bukan
 * jam UTC peramban), supaya "hari ini" tidak meleset sehari di sekitar tengah malam. Kalender akademik Indonesia:
 * semester ganjil Juli-Desember, semester genap Januari-Juni; tahun ajaran dimulai 1 Juli dan berakhir 30 Juni.
 */
export type PresetTanggal = { dari: string; sampai: string };

function tambahHari(tanggal: string, hari: number): string {
  const [y, m, d] = tanggal.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + hari)).toISOString().slice(0, 10);
}

function tahunBulan(now: Date): { tahun: number; bulan: number } {
  const [y, m] = tanggalWIB(now).split("-").map(Number) as [number, number];
  return { tahun: y, bulan: m };
}

/** 30 hari terakhir termasuk hari ini. */
export function presetTigaPuluhHari(now: Date = new Date()): PresetTanggal {
  const hariIni = tanggalWIB(now);
  return { dari: tambahHari(hariIni, -29), sampai: hariIni };
}

/** Semester berjalan: Juli-Desember (ganjil) atau Januari-Juni (genap). */
export function presetSemesterIni(now: Date = new Date()): PresetTanggal {
  const { tahun, bulan } = tahunBulan(now);
  return bulan >= 7
    ? { dari: `${tahun}-07-01`, sampai: `${tahun}-12-31` }
    : { dari: `${tahun}-01-01`, sampai: `${tahun}-06-30` };
}

/** Tahun ajaran berjalan: 1 Juli sampai 30 Juni. */
export function presetTahunAjaranIni(now: Date = new Date()): PresetTanggal {
  const { tahun, bulan } = tahunBulan(now);
  return bulan >= 7
    ? { dari: `${tahun}-07-01`, sampai: `${tahun + 1}-06-30` }
    : { dari: `${tahun - 1}-07-01`, sampai: `${tahun}-06-30` };
}

/** Rentang yang sah: kosong di salah satu sisi boleh, tetapi tanggal mulai tidak boleh setelah tanggal akhir. */
export function rentangTanggalValid(dari: string, sampai: string): boolean {
  return !(dari && sampai && dari > sampai);
}
