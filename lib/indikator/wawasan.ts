import { labelPeriodeBulan } from "@/lib/utils/datetime";
import type { BarisIndikatorSekolah, KelompokIndikator, LaporanIndikatorSekolah } from "./daya-serap";
import { MIN_SEKOLAH_PEMBANDING, type PembandingWilayah } from "./pembanding";
import { formatPersen, formatSelisih } from "./tampilan";

/**
 * Wawasan Learning Analytics otomatis untuk laporan sekolah: kalimat ringkas yang DISUSUN dari angka laporan dengan aturan
 * tetap (tanpa AI), supaya guru langsung tahu apa yang perlu ditindaklanjuti. Murni dan deterministik: angka yang sama
 * selalu menghasilkan kalimat yang sama, dan tiap kalimat hanya menyebut angka yang ada di laporan.
 */
export type JenisWawasan = "perhatian" | "info" | "positif";

export interface Wawasan {
  jenis: JenisWawasan;
  teks: string;
}

/** Selisih antar kelompok (poin persen) yang dianggap bermakna untuk disebut "terkuat/terlemah". */
export const SELISIH_KELOMPOK_BERMAKNA = 5;
/** Perubahan daya serap antar bulan (poin persen) yang dianggap naik/turun, bukan stabil. */
export const SELISIH_TREN_BERMAKNA = 3;
/** Jawaban minimal pada sebuah bulan/level agar boleh dipakai menyimpulkan tren/level. */
export const MIN_JAWABAN_TREN = 20;
export const MIN_JAWABAN_LEVEL = 10;
/** Selisih antar level kognitif (poin persen) yang dianggap bermakna. */
export const SELISIH_LEVEL_BERMAKNA = 10;
/** Cakupan indikator resmi di bawah ini dianggap rendah (laporan belum mewakili seluruh jawaban). */
export const AMBANG_CAKUPAN_RENDAH = 0.5;
/** Selisih terhadap pembanding (poin persen) yang dianggap sama (setara). */
export const TOLERANSI_PEMBANDING = 0.5;

export const NAMA_LEVEL: Record<string, string> = {
  L1: "Level 1 (Pengetahuan & Pemahaman)",
  L2: "Level 2 (Aplikasi)",
  L3: "Level 3 (Penalaran)",
};
const namaLevel = (level: string) => NAMA_LEVEL[level] ?? level;

const persen = (skor: number, maks: number) => (maks > 0 ? (skor / maks) * 100 : 0);
/** 3,2 (koma desimal Indonesia), tanpa tanda dan tanpa satuan. */
const poin = (n: number) => Math.abs(n).toFixed(1).replace(".", ",");
const sebut = (daftar: string[]) => (daftar.length <= 2 ? daftar.join(" dan ") : `${daftar.slice(0, -1).join(", ")}, dan ${daftar.at(-1)}`);

function bandingkan(selisih: number): "di atas" | "di bawah" | "setara dengan" {
  if (selisih >= TOLERANSI_PEMBANDING) return "di atas";
  if (selisih <= -TOLERANSI_PEMBANDING) return "di bawah";
  return "setara dengan";
}

function wawasanKelompok(lap: LaporanIndikatorSekolah, keluar: Wawasan[]) {
  const label = lap.label[0]!.toLowerCase();
  const ada = lap.kelompok.filter((k) => k.skorMaks > 0);
  if (ada.length < 2) return;
  const urut = [...ada].sort((a, b) => b.dayaSerap - a.dayaSerap);
  const terkuat = urut[0]!;
  const terlemah = urut.at(-1)!;
  if (terkuat.dayaSerap - terlemah.dayaSerap < SELISIH_KELOMPOK_BERMAKNA) return;
  keluar.push({
    jenis: "info",
    teks: `${lap.label[0]} terkuat: ${terkuat.nama} (${formatPersen(terkuat.dayaSerap, 0)}). ${lap.label[0]} yang paling perlu diperkuat: ${terlemah.nama} (${formatPersen(terlemah.dayaSerap, 0)}). Gunakan ${label} ini sebagai arah remedial.`,
  });
}

function wawasanNasional(lap: LaporanIndikatorSekolah, keluar: Wawasan[]) {
  const label = lap.label[0]!.toLowerCase();
  const bandingan = lap.kelompok.filter((k) => k.nasional !== null && k.vonis !== "data_kurang");
  if (bandingan.length === 0) return;
  const diAtas = bandingan.filter((k) => k.vonis === "di_atas");
  const perluPenguatan = bandingan.filter((k) => k.vonis === "perlu_penguatan");
  if (perluPenguatan.length > 0) {
    keluar.push({
      jenis: "perhatian",
      teks: `${perluPenguatan.length} dari ${bandingan.length} ${label} di bawah rerata nasional resmi: ${sebut(perluPenguatan.map((k) => k.nama))}.`,
    });
  } else if (diAtas.length > 0) {
    keluar.push({
      jenis: "positif",
      teks: `${diAtas.length} dari ${bandingan.length} ${label} di atas rerata nasional resmi dan tidak ada yang tertinggal.`,
    });
  }
  const terjauh = lap.diBawahNasional[0];
  if (terjauh && terjauh.nasional !== null) {
    keluar.push({
      jenis: "perhatian",
      teks: `${lap.diBawahNasional.length} indikator di bawah rerata nasional resmi. Selisih terbesar: "${terjauh.indikator}" (${formatPersen(terjauh.dayaSerap, 0)} vs nasional ${formatPersen(terjauh.nasional, 0)}, ${formatSelisih(terjauh.dayaSerap - terjauh.nasional)}).`,
    });
  }
}

function dayaSerapKeseluruhan(kelompok: KelompokIndikator<BarisIndikatorSekolah>[]): number {
  return persen(
    kelompok.reduce((a, k) => a + k.skor, 0),
    kelompok.reduce((a, k) => a + k.skorMaks, 0),
  );
}

function wawasanPembanding(lap: LaporanIndikatorSekolah, pembanding: PembandingWilayah | null | undefined, keluar: Wawasan[]) {
  if (!pembanding) return;
  if (!pembanding.cukup || pembanding.rerata === null) {
    keluar.push({
      jenis: "info",
      teks: `Pembanding ${pembanding.label} belum tersedia: baru ${pembanding.jumlahSekolah} sekolah pengguna AyoTKA yang punya data pada mapel ini (minimal ${MIN_SEKOLAH_PEMBANDING}). Coba cakupan yang lebih luas, misalnya provinsi atau nasional.`,
    });
    return;
  }
  const sendiri = dayaSerapKeseluruhan(lap.kelompok);
  const selisih = sendiri - pembanding.rerata;
  const arah = bandingkan(selisih);
  keluar.push({
    jenis: arah === "di bawah" ? "perhatian" : arah === "di atas" ? "positif" : "info",
    teks: `Daya serap sekolah ini ${formatPersen(sendiri, 1)} ${arah} rerata pengguna AyoTKA (${pembanding.label}) ${formatPersen(pembanding.rerata, 1)}${arah === "setara dengan" ? "" : ` (${formatSelisih(selisih)})`}, dari ${pembanding.jumlahSekolah} sekolah.`,
  });
  if (pembanding.posisi) {
    keluar.push({
      jenis: "info",
      teks: `Posisi sekolah ini: peringkat ${pembanding.posisi.peringkat} dari ${pembanding.posisi.dari} sekolah (daya serap lebih tinggi daripada ${formatPersen(pembanding.posisi.persentil, 0)} sekolah lain) pada ${pembanding.label}.`,
    });
  }
}

function wawasanSiswa(lap: LaporanIndikatorSekolah, keluar: Wawasan[]) {
  const total = lap.sebaran.baik + lap.sebaran.cukup + lap.sebaran.kurang;
  if (total === 0) return;
  if (lap.sebaran.kurang === 0) {
    keluar.push({ jenis: "positif", teks: `Tidak ada siswa dengan daya serap di bawah 50% (${total} siswa dihitung).` });
    return;
  }
  const awal = lap.prioritasRemedial[0];
  keluar.push({
    jenis: "perhatian",
    teks: `${lap.sebaran.kurang} dari ${total} siswa (${formatPersen((lap.sebaran.kurang / total) * 100, 0)}) berdaya serap di bawah 50% dan perlu remedial.${awal ? ` Mulai dari indikator: "${awal.indikator}" (${formatPersen(awal.dayaSerap, 0)}).` : ""}`,
  });
}

function wawasanTren(lap: LaporanIndikatorSekolah, keluar: Wawasan[]) {
  const bulan = lap.tren.filter((t) => t.jmlSoal >= MIN_JAWABAN_TREN);
  if (bulan.length < 2) return;
  const sebelum = bulan.at(-2)!;
  const terakhir = bulan.at(-1)!;
  const selisih = terakhir.dayaSerap - sebelum.dayaSerap;
  const rentang = `${labelPeriodeBulan(sebelum.periode)} ke ${labelPeriodeBulan(terakhir.periode)}`;
  if (Math.abs(selisih) < SELISIH_TREN_BERMAKNA) {
    keluar.push({ jenis: "info", teks: `Daya serap stabil dari ${rentang} (${formatPersen(sebelum.dayaSerap, 0)} ke ${formatPersen(terakhir.dayaSerap, 0)}).` });
  } else if (selisih > 0) {
    keluar.push({ jenis: "positif", teks: `Daya serap naik ${poin(selisih)} poin dari ${rentang} (${formatPersen(sebelum.dayaSerap, 0)} ke ${formatPersen(terakhir.dayaSerap, 0)}).` });
  } else {
    keluar.push({ jenis: "perhatian", teks: `Daya serap turun ${poin(selisih)} poin dari ${rentang} (${formatPersen(sebelum.dayaSerap, 0)} ke ${formatPersen(terakhir.dayaSerap, 0)}).` });
  }
}

function wawasanLevel(lap: LaporanIndikatorSekolah, keluar: Wawasan[]) {
  const level = lap.perLevel.filter((l) => l.jmlSoal >= MIN_JAWABAN_LEVEL);
  if (level.length < 2) return;
  const urut = [...level].sort((a, b) => a.dayaSerap - b.dayaSerap);
  const terlemah = urut[0]!;
  const terkuat = urut.at(-1)!;
  if (terkuat.dayaSerap - terlemah.dayaSerap < SELISIH_LEVEL_BERMAKNA) return;
  keluar.push({
    jenis: "info",
    teks: `Berdasarkan level kognitif, ${namaLevel(terlemah.level)} paling lemah (${formatPersen(terlemah.dayaSerap, 0)}) dan ${namaLevel(terkuat.level)} paling kuat (${formatPersen(terkuat.dayaSerap, 0)}). Latihan terarah pada level terlemah akan paling membantu.`,
  });
}

function wawasanCakupan(lap: LaporanIndikatorSekolah, keluar: Wawasan[]) {
  if (lap.jumlahJawaban === 0) return;
  const cakupan = lap.jawabanBerindikator / lap.jumlahJawaban;
  if (cakupan >= AMBANG_CAKUPAN_RENDAH) return;
  keluar.push({
    jenis: "info",
    teks: `Baru ${formatPersen(cakupan * 100, 0)} jawaban (${lap.jawabanBerindikator} dari ${lap.jumlahJawaban}) yang tertaut ke indikator resmi, jadi laporan ini belum mewakili seluruh hasil ujian.`,
  });
}

/** Susun wawasan otomatis. Urutan: pembanding, kelompok, nasional, siswa, tren, level, cakupan data. */
export function susunWawasan(lap: LaporanIndikatorSekolah, pembanding?: PembandingWilayah | null): Wawasan[] {
  const keluar: Wawasan[] = [];
  wawasanPembanding(lap, pembanding, keluar);
  wawasanKelompok(lap, keluar);
  wawasanNasional(lap, keluar);
  wawasanSiswa(lap, keluar);
  wawasanTren(lap, keluar);
  wawasanLevel(lap, keluar);
  wawasanCakupan(lap, keluar);
  return keluar;
}
