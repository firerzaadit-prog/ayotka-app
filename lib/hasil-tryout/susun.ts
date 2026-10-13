import { hitungPersentil } from "@/lib/analytics/statistik";
import { bulatSatu } from "@/lib/hasil-tryout/format";
import { tentukanJenisTryOut, URUTAN_JENIS, type FilterJenis, type JenisTryOut } from "@/lib/hasil-tryout/jenis";

/**
 * Bagian murni (tanpa database) laporan hasil try out untuk admin sekolah: rapor per siswa, peringkat siswa, daftar
 * paket yang paling banyak dikerjakan, dan performa satu paket (siapa yang sudah dan belum mengerjakan beserta
 * peringkatnya). Pemuat datanya ada di lib/hasil-tryout/muat.ts; aturannya dikumpulkan di sini supaya bisa diuji tuntas.
 *
 * Aturan pokok:
 * - Satu "try out" = satu siswa mengerjakan satu paket lewat satu jalur: mandiri (pilih sendiri) atau satu penugasan
 *   tertentu. Hasil resminya = percobaan PERTAMA yang sudah selesai (selesai atau waktu habis) pada try out itu, sama dengan
 *   aturan rapor dan analitik sekolah (percobaan ulang tidak mengubah nilai maupun peringkat, tetapi tetap ada di riwayat siswa).
 * - Jenis try out (mandiri, sekolah, nasional) mengikuti lib/hasil-tryout/jenis.ts.
 * - Peringkat bergaya olahraga: nilai kembar (pada ketelitian satu desimal, seperti yang tampil) berbagi peringkat dan
 *   peringkat berikutnya melompat (1, 2, 2, 4).
 */

export const STATUS_PERCOBAAN_SELESAI = ["selesai", "kedaluwarsa"] as const;

export type PercobaanMentah = {
  id: string;
  studentId: string;
  packageId: string;
  assignmentId: string | null;
  status: string;
  skorAkhir: number | null;
  mulaiAt: Date;
  selesaiAt: Date | null;
};

export type SiswaInfo = {
  id: string;
  nama: string;
  nisn: string | null;
  claimStatus: "belum_klaim" | "sudah_klaim";
  /** Terisi = alumni (sudah ditandai lulus). */
  lulusAt: Date | null;
};

export type PaketInfo = {
  id: string;
  nama: string;
  kategori: "mandiri" | "nasional";
  ownerType: "pusat" | "sekolah";
  jenjang: string;
  subjectId: string;
  mapel: string;
};

/** Hasil resmi satu siswa pada satu try out. */
export type HasilTryOut = {
  attemptId: string;
  studentId: string;
  nama: string;
  nisn: string | null;
  alumni: boolean;
  claimStatus: "belum_klaim" | "sudah_klaim";
  packageId: string;
  paketNama: string;
  mapelId: string;
  mapel: string;
  jenjang: string;
  jenis: JenisTryOut;
  assignmentId: string | null;
  status: "selesai" | "kedaluwarsa";
  /** Null bila percobaan tak punya nilai (jarang): tampil "-" dan tidak ikut rata-rata maupun peringkat. */
  skor: number | null;
  mulaiAt: Date;
  selesaiAt: Date | null;
  durasiMenit: number | null;
};

const waktu = (d: Date) => d.getTime();

function selesaiMenit(mulai: Date, selesai: Date | null): number | null {
  if (!selesai) return null;
  return Math.max(0, Math.round((waktu(selesai) - waktu(mulai)) / 60_000));
}

const urutNama = (a: { nama: string }, b: { nama: string }) => a.nama.localeCompare(b.nama, "id", { sensitivity: "base" });

/**
 * Hasil resmi tiap try out dari semua percobaan yang masuk: percobaan yang sudah selesai dikelompokkan per (siswa, paket,
 * penugasan atau mandiri); yang paling awal (waktu mulai, lalu id) di tiap kelompok menjadi hasil resminya. Percobaan yang
 * masih berjalan atau dijeda tidak dihitung. Siswa atau paket yang tidak ada di peta dilewati (data tak lengkap).
 */
export function susunHasilTryOut(
  percobaan: PercobaanMentah[],
  siswa: Map<string, SiswaInfo>,
  paket: Map<string, PaketInfo>,
): HasilTryOut[] {
  const pertama = new Map<string, PercobaanMentah>();
  for (const p of percobaan) {
    if (p.status !== "selesai" && p.status !== "kedaluwarsa") continue;
    const kunci = `${p.studentId}|${p.packageId}|${p.assignmentId ?? ""}`;
    const ada = pertama.get(kunci);
    if (!ada || waktu(p.mulaiAt) < waktu(ada.mulaiAt) || (waktu(p.mulaiAt) === waktu(ada.mulaiAt) && p.id < ada.id)) {
      pertama.set(kunci, p);
    }
  }

  const hasil: HasilTryOut[] = [];
  for (const p of pertama.values()) {
    const s = siswa.get(p.studentId);
    const k = paket.get(p.packageId);
    if (!s || !k) continue;
    hasil.push({
      attemptId: p.id,
      studentId: s.id,
      nama: s.nama,
      nisn: s.nisn,
      alumni: s.lulusAt != null,
      claimStatus: s.claimStatus,
      packageId: k.id,
      paketNama: k.nama,
      mapelId: k.subjectId,
      mapel: k.mapel,
      jenjang: k.jenjang,
      jenis: tentukanJenisTryOut({ kategori: k.kategori, assignmentId: p.assignmentId, ownerType: k.ownerType }),
      assignmentId: p.assignmentId,
      status: p.status as "selesai" | "kedaluwarsa",
      skor: p.skorAkhir,
      mulaiAt: p.mulaiAt,
      selesaiAt: p.selesaiAt,
      durasiMenit: selesaiMenit(p.mulaiAt, p.selesaiAt),
    });
  }
  return hasil;
}

// ---------------------------------------------------------------------------------------------------------------------
// Penyaringan dan pengurutan
// ---------------------------------------------------------------------------------------------------------------------

export type SaringHasil = {
  jenis?: FilterJenis | null;
  mapelId?: string | null;
  paketId?: string | null;
  /** Batas waktu MULAI percobaan resmi, sama-sama inklusif. */
  dari?: Date | null;
  sampai?: Date | null;
  /** "tanpa" = alumni tidak ikut; bawaan "ikut". */
  alumni?: "ikut" | "tanpa" | null;
  /** Pencarian nama atau NISN (potongan, tanpa membedakan huruf besar kecil). */
  cari?: string | null;
};

const rapikanCari = (teks: string) => teks.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

export function saringHasil(hasil: HasilTryOut[], f: SaringHasil): HasilTryOut[] {
  const cari = f.cari ? rapikanCari(f.cari) : "";
  return hasil.filter((h) => {
    if (f.jenis && f.jenis !== "semua" && h.jenis !== f.jenis) return false;
    if (f.mapelId && h.mapelId !== f.mapelId) return false;
    if (f.paketId && h.packageId !== f.paketId) return false;
    if (f.dari && waktu(h.mulaiAt) < waktu(f.dari)) return false;
    if (f.sampai && waktu(h.mulaiAt) > waktu(f.sampai)) return false;
    if (f.alumni === "tanpa" && h.alumni) return false;
    if (cari && !rapikanCari(h.nama).includes(cari) && !(h.nisn ?? "").toLowerCase().includes(cari)) return false;
    return true;
  });
}

export type UrutanRapor = "terbaru" | "nilai_tertinggi" | "nilai_terendah" | "nama";

export const URUTAN_RAPOR_TERSEDIA: readonly UrutanRapor[] = ["terbaru", "nilai_tertinggi", "nilai_terendah", "nama"];

export const LABEL_URUTAN_RAPOR: Record<UrutanRapor, string> = {
  terbaru: "Terbaru",
  nilai_tertinggi: "Nilai tertinggi",
  nilai_terendah: "Nilai terendah",
  nama: "Nama siswa (A-Z)",
};

/** Urutan daftar rapor. Nilai kosong selalu di akhir; seri diurutkan terbaru lalu nama supaya hasilnya stabil. */
export function urutkanHasil(hasil: HasilTryOut[], urut: UrutanRapor): HasilTryOut[] {
  const salinan = [...hasil];
  const terbaru = (a: HasilTryOut, b: HasilTryOut) => waktu(b.mulaiAt) - waktu(a.mulaiAt) || urutNama(a, b) || a.attemptId.localeCompare(b.attemptId);
  const menurutNilai = (arah: "turun" | "naik") => (a: HasilTryOut, b: HasilTryOut) => {
    if (a.skor == null && b.skor == null) return terbaru(a, b);
    if (a.skor == null) return 1;
    if (b.skor == null) return -1;
    const selisih = bulatSatu(a.skor) - bulatSatu(b.skor);
    return (arah === "turun" ? -selisih : selisih) || terbaru(a, b);
  };
  if (urut === "nama") return salinan.sort((a, b) => urutNama(a, b) || terbaru(a, b));
  if (urut === "nilai_tertinggi") return salinan.sort(menurutNilai("turun"));
  if (urut === "nilai_terendah") return salinan.sort(menurutNilai("naik"));
  return salinan.sort(terbaru);
}

export type HalamanHasil<T> = { baris: T[]; halaman: number; ukuran: number; total: number; totalHalaman: number };

/** Potong satu halaman; nomor halaman di luar rentang dirapatkan ke halaman terdekat yang ada. */
export function ambilHalaman<T>(daftar: T[], halaman: number, ukuran: number): HalamanHasil<T> {
  const aman = Math.max(1, Math.floor(ukuran) || 1);
  const totalHalaman = Math.max(1, Math.ceil(daftar.length / aman));
  const h = Math.min(totalHalaman, Math.max(1, Math.floor(halaman) || 1));
  return { baris: daftar.slice((h - 1) * aman, h * aman), halaman: h, ukuran: aman, total: daftar.length, totalHalaman };
}

// ---------------------------------------------------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------------------------------------------------

export type JumlahPerJenis = Record<FilterJenis, number>;

/** Jumlah hasil per jenis; "semua" = jumlah seluruhnya. */
export function hitungPerJenis(hasil: HasilTryOut[]): JumlahPerJenis {
  const jumlah: JumlahPerJenis = { semua: hasil.length, mandiri: 0, sekolah: 0, nasional: 0 };
  for (const h of hasil) jumlah[h.jenis]++;
  return jumlah;
}

const rata = (angka: number[]): number | null => (angka.length === 0 ? null : angka.reduce((s, n) => s + n, 0) / angka.length);

export type RingkasanHasil = { jumlahHasil: number; jumlahSiswa: number; rataRata: number | null };

export function ringkasHasil(hasil: HasilTryOut[]): RingkasanHasil {
  const bernilai = hasil.filter((h) => h.skor != null).map((h) => h.skor!);
  const r = rata(bernilai);
  return { jumlahHasil: hasil.length, jumlahSiswa: new Set(hasil.map((h) => h.studentId)).size, rataRata: r === null ? null : bulatSatu(r) };
}

/** Pilihan untuk filter: mata pelajaran dan paket yang ada pada hasil, urut nama. */
export function daftarPilihan(hasil: HasilTryOut[]): {
  mapel: Array<{ id: string; nama: string }>;
  paket: Array<{ id: string; nama: string; mapelId: string; jenis: JenisTryOut[] }>;
} {
  const mapel = new Map<string, string>();
  const paket = new Map<string, { id: string; nama: string; mapelId: string; jenis: Set<JenisTryOut> }>();
  for (const h of hasil) {
    mapel.set(h.mapelId, h.mapel);
    const p = paket.get(h.packageId) ?? { id: h.packageId, nama: h.paketNama, mapelId: h.mapelId, jenis: new Set<JenisTryOut>() };
    p.jenis.add(h.jenis);
    paket.set(h.packageId, p);
  }
  return {
    mapel: [...mapel].map(([id, nama]) => ({ id, nama })).sort(urutNama),
    paket: [...paket.values()]
      .map((p) => ({ id: p.id, nama: p.nama, mapelId: p.mapelId, jenis: URUTAN_JENIS.filter((j) => p.jenis.has(j)) as JenisTryOut[] }))
      .sort(urutNama),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Peringkat siswa
// ---------------------------------------------------------------------------------------------------------------------

/** Peringkat bergaya olahraga untuk daftar yang SUDAH terurut menurun menurut `nilai` (dibandingkan pada satu desimal). */
export function berikanPeringkat<T>(terurut: T[], nilai: (t: T) => number): number[] {
  const hasil: number[] = [];
  terurut.forEach((t, i) => {
    const sebelumnya = terurut[i - 1];
    hasil.push(sebelumnya !== undefined && bulatSatu(nilai(sebelumnya)) === bulatSatu(nilai(t)) ? hasil[i - 1]! : i + 1);
  });
  return hasil;
}

export type BarisPeringkatSiswa = {
  peringkat: number;
  studentId: string;
  nama: string;
  nisn: string | null;
  alumni: boolean;
  jumlahTryOut: number;
  rataRata: number;
  tertinggi: number;
  terendah: number;
  terakhirAt: Date;
  perJenis: Record<JenisTryOut, number>;
};

/**
 * Peringkat siswa secara keseluruhan: rata-rata nilai dari hasil resmi semua try out yang dikerjakan (yang bernilai),
 * dari tertinggi ke terendah. Seri pada rata-rata (satu desimal) berbagi peringkat; urutan di dalam seri: lebih banyak
 * try out dulu, lalu nama. `minimalTryOut` menyaring siswa yang try out-nya masih sedikit (bawaan 1 = semua).
 */
export function susunPeringkatSiswa(hasil: HasilTryOut[], minimalTryOut = 1): BarisPeringkatSiswa[] {
  const perSiswa = new Map<string, HasilTryOut[]>();
  for (const h of hasil) {
    if (h.skor == null) continue;
    const daftar = perSiswa.get(h.studentId) ?? [];
    daftar.push(h);
    perSiswa.set(h.studentId, daftar);
  }

  const baris = [...perSiswa.values()]
    .filter((daftar) => daftar.length >= Math.max(1, minimalTryOut))
    .map((daftar) => {
      const nilai = daftar.map((h) => h.skor!);
      const perJenis: Record<JenisTryOut, number> = { mandiri: 0, sekolah: 0, nasional: 0 };
      for (const h of daftar) perJenis[h.jenis]++;
      const terakhir = daftar.reduce((m, h) => (waktu(h.mulaiAt) > waktu(m) ? h.mulaiAt : m), daftar[0]!.mulaiAt);
      const awal = daftar[0]!;
      return {
        studentId: awal.studentId,
        nama: awal.nama,
        nisn: awal.nisn,
        alumni: awal.alumni,
        jumlahTryOut: daftar.length,
        rataRata: rata(nilai)!,
        tertinggi: Math.max(...nilai),
        terendah: Math.min(...nilai),
        terakhirAt: terakhir,
        perJenis,
      };
    })
    .sort((a, b) => bulatSatu(b.rataRata) - bulatSatu(a.rataRata) || b.jumlahTryOut - a.jumlahTryOut || urutNama(a, b) || a.studentId.localeCompare(b.studentId));

  const peringkat = berikanPeringkat(baris, (b) => b.rataRata);
  return baris.map((b, i) => ({ ...b, rataRata: bulatSatu(b.rataRata), peringkat: peringkat[i]! }));
}

// ---------------------------------------------------------------------------------------------------------------------
// Paket yang paling banyak dikerjakan
// ---------------------------------------------------------------------------------------------------------------------

export type BarisPaket = {
  packageId: string;
  nama: string;
  mapelId: string;
  mapel: string;
  jenjang: string;
  /** Jumlah hasil resmi per jenis (satu siswa bisa punya satu per jenis pada paket yang sama). */
  perJenis: Record<JenisTryOut, number>;
  jumlahHasil: number;
  /** Siswa berbeda yang sudah mengerjakan (alumni ikut). */
  jumlahSiswa: number;
  /** Siswa aktif (belum lulus) yang sudah mengerjakan. */
  jumlahSiswaAktif: number;
  /** Seluruh siswa aktif sekolah yang jenjangnya sama dengan paket: pembagi partisipasi. */
  siswaAktifJenjang: number;
  /** jumlahSiswaAktif / siswaAktifJenjang (persen bulat); null bila tidak ada siswa aktif sejenjang. */
  partisipasiPersen: number | null;
  rataRata: number | null;
  tertinggi: number | null;
  terendah: number | null;
  terakhirAt: Date;
};

export type UrutanPaket = "terbanyak" | "rata_rata" | "terbaru" | "nama";

export const URUTAN_PAKET_TERSEDIA: readonly UrutanPaket[] = ["terbanyak", "rata_rata", "terbaru", "nama"];

export const LABEL_URUTAN_PAKET: Record<UrutanPaket, string> = {
  terbanyak: "Paling banyak dikerjakan",
  rata_rata: "Rata-rata nilai tertinggi",
  terbaru: "Terakhir dikerjakan",
  nama: "Nama paket (A-Z)",
};

export function susunDaftarPaket(
  hasil: HasilTryOut[],
  siswaAktifPerJenjang: Record<string, number>,
  urut: UrutanPaket = "terbanyak",
): BarisPaket[] {
  const perPaket = new Map<string, HasilTryOut[]>();
  for (const h of hasil) {
    const daftar = perPaket.get(h.packageId) ?? [];
    daftar.push(h);
    perPaket.set(h.packageId, daftar);
  }

  const baris: BarisPaket[] = [...perPaket.values()].map((daftar) => {
    const awal = daftar[0]!;
    const nilai = daftar.filter((h) => h.skor != null).map((h) => h.skor!);
    const perJenis: Record<JenisTryOut, number> = { mandiri: 0, sekolah: 0, nasional: 0 };
    for (const h of daftar) perJenis[h.jenis]++;
    const siswa = new Set(daftar.map((h) => h.studentId));
    const siswaAktif = new Set(daftar.filter((h) => !h.alumni).map((h) => h.studentId));
    const aktifJenjang = siswaAktifPerJenjang[awal.jenjang] ?? 0;
    const r = rata(nilai);
    return {
      packageId: awal.packageId,
      nama: awal.paketNama,
      mapelId: awal.mapelId,
      mapel: awal.mapel,
      jenjang: awal.jenjang,
      perJenis,
      jumlahHasil: daftar.length,
      jumlahSiswa: siswa.size,
      jumlahSiswaAktif: siswaAktif.size,
      siswaAktifJenjang: aktifJenjang,
      partisipasiPersen: aktifJenjang > 0 ? Math.min(100, Math.round((siswaAktif.size / aktifJenjang) * 100)) : null,
      rataRata: r === null ? null : bulatSatu(r),
      tertinggi: nilai.length ? Math.max(...nilai) : null,
      terendah: nilai.length ? Math.min(...nilai) : null,
      terakhirAt: daftar.reduce((m, h) => (waktu(h.mulaiAt) > waktu(m) ? h.mulaiAt : m), awal.mulaiAt),
    };
  });

  const terbaru = (a: BarisPaket, b: BarisPaket) => waktu(b.terakhirAt) - waktu(a.terakhirAt);
  const nama = (a: BarisPaket, b: BarisPaket) => urutNama(a, b) || a.packageId.localeCompare(b.packageId);
  const kosongDiAkhir = (a: number | null, b: number | null): number | null => (a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : null);
  return baris.sort((a, b) => {
    if (urut === "nama") return nama(a, b);
    if (urut === "terbaru") return terbaru(a, b) || nama(a, b);
    if (urut === "rata_rata") {
      const k = kosongDiAkhir(a.rataRata, b.rataRata);
      return (k ?? b.rataRata! - a.rataRata!) || b.jumlahSiswa - a.jumlahSiswa || nama(a, b);
    }
    return b.jumlahSiswa - a.jumlahSiswa || b.jumlahHasil - a.jumlahHasil || terbaru(a, b) || nama(a, b);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Performa satu paket: sudah / belum mengerjakan dan peringkatnya
// ---------------------------------------------------------------------------------------------------------------------

export type BarisHasilPaket = HasilTryOut & { peringkat: number | null };

export type BarisBelum = {
  studentId: string;
  nama: string;
  nisn: string | null;
  claimStatus: "belum_klaim" | "sudah_klaim";
  /** "sedang_mengerjakan": ada percobaan yang masih berjalan atau dijeda. */
  status: "belum_mulai" | "sedang_mengerjakan";
};

export type SebaranNilai = { label: string; dari: number; sampai: number; jumlah: number };

export type StatistikPaket = {
  /** Siswa aktif sekolah dengan jenjang paket ini: pembagi partisipasi. */
  siswaAktif: number;
  /** Siswa berbeda yang sudah mengerjakan (alumni ikut). */
  sudahMengerjakan: number;
  /** Di antaranya siswa aktif. */
  sudahMengerjakanAktif: number;
  belumMengerjakan: number;
  sedangMengerjakan: number;
  /** sudahMengerjakanAktif / siswaAktif (persen bulat); 0 bila tak ada siswa aktif. */
  partisipasiPersen: number;
  jumlahBernilai: number;
  rataRata: number | null;
  median: number | null;
  tertinggi: number | null;
  terendah: number | null;
  sebaran: SebaranNilai[];
};

export type DetailPaket = { statistik: StatistikPaket; hasil: BarisHasilPaket[]; belum: BarisBelum[] };

const BATAS_SEBARAN = [0, 20, 40, 60, 80, 100] as const;

export function susunSebaran(nilai: number[]): SebaranNilai[] {
  const sebaran = BATAS_SEBARAN.slice(0, -1).map((dari, i) => ({ label: `${dari} – ${BATAS_SEBARAN[i + 1]}`, dari, sampai: BATAS_SEBARAN[i + 1]!, jumlah: 0 }));
  for (const n of nilai) sebaran[Math.min(sebaran.length - 1, Math.max(0, Math.floor(n / 20)))]!.jumlah++;
  return sebaran;
}

/**
 * Performa satu paket. `hasilPaket`: hasil resmi pada paket itu (sudah disaring jenisnya bila perlu). `siswaAktif`: siswa
 * aktif sekolah yang BOLEH mengerjakan paket ini (jenjang sama): yang belum punya hasil menjadi daftar "belum
 * mengerjakan". `sedangMengerjakan`: id siswa yang punya percobaan berjalan atau dijeda pada paket ini.
 * Peringkat: nilai tertinggi dulu; seri berbagi peringkat; yang lebih cepat selesai tampil lebih dulu di dalam seri.
 */
export function susunDetailPaket(opsi: {
  hasilPaket: HasilTryOut[];
  siswaAktif: SiswaInfo[];
  sedangMengerjakan: ReadonlySet<string>;
}): DetailPaket {
  const { hasilPaket, siswaAktif, sedangMengerjakan } = opsi;

  const bernilai = hasilPaket
    .filter((h) => h.skor != null)
    .sort((a, b) => {
      const selisih = bulatSatu(b.skor!) - bulatSatu(a.skor!);
      if (selisih !== 0) return selisih;
      const da = a.durasiMenit ?? Number.POSITIVE_INFINITY;
      const db = b.durasiMenit ?? Number.POSITIVE_INFINITY;
      return da - db || urutNama(a, b) || a.attemptId.localeCompare(b.attemptId);
    });
  const peringkat = berikanPeringkat(bernilai, (h) => h.skor!);
  const tanpaNilai = hasilPaket.filter((h) => h.skor == null).sort((a, b) => urutNama(a, b) || a.attemptId.localeCompare(b.attemptId));
  const hasil: BarisHasilPaket[] = [...bernilai.map((h, i) => ({ ...h, peringkat: peringkat[i]! })), ...tanpaNilai.map((h) => ({ ...h, peringkat: null }))];

  const sudahId = new Set(hasilPaket.map((h) => h.studentId));
  const belum: BarisBelum[] = siswaAktif
    .filter((s) => s.lulusAt == null && !sudahId.has(s.id))
    .map((s) => ({
      studentId: s.id,
      nama: s.nama,
      nisn: s.nisn,
      claimStatus: s.claimStatus,
      status: sedangMengerjakan.has(s.id) ? ("sedang_mengerjakan" as const) : ("belum_mulai" as const),
    }))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "sedang_mengerjakan" ? -1 : 1) || urutNama(a, b) || a.studentId.localeCompare(b.studentId));

  const nilai = bernilai.map((h) => h.skor!);
  const urutNilai = [...nilai].sort((a, b) => a - b);
  const r = rata(nilai);
  const aktifSudah = new Set(hasilPaket.filter((h) => !h.alumni).map((h) => h.studentId)).size;
  const siswaAktifJumlah = siswaAktif.filter((s) => s.lulusAt == null).length;

  return {
    statistik: {
      siswaAktif: siswaAktifJumlah,
      sudahMengerjakan: sudahId.size,
      sudahMengerjakanAktif: aktifSudah,
      belumMengerjakan: belum.length,
      sedangMengerjakan: belum.filter((b) => b.status === "sedang_mengerjakan").length,
      partisipasiPersen: siswaAktifJumlah === 0 ? 0 : Math.min(100, Math.round((aktifSudah / siswaAktifJumlah) * 100)),
      jumlahBernilai: nilai.length,
      rataRata: r === null ? null : bulatSatu(r),
      median: nilai.length === 0 ? null : bulatSatu(hitungPersentil(urutNilai, 50)),
      tertinggi: nilai.length ? Math.max(...nilai) : null,
      terendah: nilai.length ? Math.min(...nilai) : null,
      sebaran: susunSebaran(nilai),
    },
    hasil,
    belum,
  };
}
