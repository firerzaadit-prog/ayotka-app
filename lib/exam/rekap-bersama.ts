/**
 * Rekap hasil satu penugasan "Try Out Bersama": satu baris per siswa peserta, peringkat, statistik, dan siapa yang
 * belum mengerjakan. Murni (tanpa database) supaya aturannya bisa diuji tuntas; rute yang memuat datanya ada di
 * app/api/admin-sekolah/assignments/[id]/rekap.
 *
 * Aturan:
 * - Nilai RESMI seorang siswa = percobaan PERTAMA-nya pada penugasan ini (urut mulaiAt), sama dengan aturan rapor
 *   attempt pertama. Percobaan berikutnya (kalau paketnya mengizinkan mengulang) tidak mengubah nilai maupun
 *   peringkat, tetapi TIDAK disembunyikan: semuanya tercantum di `percobaan` (riwayat lengkap) dan `jumlahPercobaan`.
 * - Peringkat memakai gaya olahraga: nilai kembar berbagi peringkat dan peringkat berikutnya melompat (1, 2, 2, 4).
 * - Statistik (rata-rata, tertinggi, terendah, median, sebaran) hanya dari siswa yang percobaan resminya sudah
 *   berakhir (selesai atau waktu habis) dan punya nilai. Yang masih mengerjakan atau belum mulai tidak dihitung.
 */

export type StatusAttemptRekap = "berjalan" | "paused" | "selesai" | "kedaluwarsa";

export type PesertaRekap = {
  studentId: string;
  nama: string;
  nisn: string | null;
  claimStatus: "belum_klaim" | "sudah_klaim";
};

export type AttemptRekap = {
  id: string;
  studentId: string;
  status: StatusAttemptRekap;
  skorAkhir: number | null;
  mulaiAt: Date | string;
  selesaiAt: Date | string | null;
  tabSwitchCount: number;
};

export type StatusPeserta = "selesai" | "waktu_habis" | "mengerjakan" | "dijeda" | "belum";

export const LABEL_STATUS_PESERTA: Record<StatusPeserta, string> = {
  selesai: "Selesai",
  waktu_habis: "Waktu habis",
  mengerjakan: "Sedang mengerjakan",
  dijeda: "Dijeda",
  belum: "Belum mengerjakan",
};

/** Satu percobaan siswa pada penugasan ini (SEMUA percobaan ditampilkan; hanya yang pertama yang menjadi nilai resmi). */
export type RincianPercobaan = {
  attemptId: string;
  /** Percobaan ke-N menurut waktu mulai (mulai dari 1). */
  nomor: number;
  /** Percobaan pertama = nilai resmi untuk rekap dan peringkat. */
  resmi: boolean;
  status: Exclude<StatusPeserta, "belum">;
  /** Hanya bila percobaan sudah berakhir (selesai atau waktu habis). */
  skor: number | null;
  durasiMenit: number | null;
  mulaiAt: Date | string;
  selesaiAt: Date | string | null;
  tabSwitchCount: number;
};

export type BarisRekap = PesertaRekap & {
  status: StatusPeserta;
  /** Percobaan resmi (yang pertama); null bila belum pernah mulai. */
  attemptId: string | null;
  /** Nilai percobaan resmi, hanya bila sudah berakhir. */
  skor: number | null;
  peringkat: number | null;
  durasiMenit: number | null;
  tabSwitchCount: number;
  /** Jumlah semua percobaan siswa ini pada penugasan (resmi + pengulangan). */
  jumlahPercobaan: number;
  /** SEMUA percobaan siswa ini, dari yang pertama; kosong bila belum pernah mulai. */
  percobaan: RincianPercobaan[];
};

export type SebaranNilai = { label: string; dari: number; sampai: number; jumlah: number };

export type StatistikRekap = {
  jumlahPeserta: number;
  /** Percobaan resmi sudah berakhir (selesai atau waktu habis). */
  jumlahSelesai: number;
  /** Sedang mengerjakan atau dijeda. */
  jumlahSedang: number;
  jumlahBelum: number;
  /** Persen peserta yang sudah memulai (selesai + sedang), 0 bila tidak ada peserta. */
  partisipasiPersen: number;
  jumlahBernilai: number;
  rataRata: number | null;
  tertinggi: number | null;
  terendah: number | null;
  median: number | null;
  sebaran: SebaranNilai[];
};

export type HasilRekap = { baris: BarisRekap[]; statistik: StatistikRekap };

const waktu = (v: Date | string) => (v instanceof Date ? v : new Date(v)).getTime();

/** Pembulatan satu desimal tanpa galat biner (mis. 72.45 -> 72.5). */
const satuDesimal = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;

const BATAS_SEBARAN = [0, 20, 40, 60, 80, 100] as const;

function sebaranKosong(): SebaranNilai[] {
  return BATAS_SEBARAN.slice(0, -1).map((dari, i) => {
    const sampai = BATAS_SEBARAN[i + 1]!;
    return { label: `${dari} – ${sampai}`, dari, sampai, jumlah: 0 };
  });
}

function statusDariAttempt(a: AttemptRekap): StatusPeserta {
  if (a.status === "selesai") return "selesai";
  if (a.status === "kedaluwarsa") return "waktu_habis";
  if (a.status === "paused") return "dijeda";
  return "mengerjakan";
}

function urutNama(a: { nama: string }, b: { nama: string }): number {
  return a.nama.localeCompare(b.nama, "id", { sensitivity: "base" });
}

export function susunRekapBersama(peserta: PesertaRekap[], attempts: AttemptRekap[]): HasilRekap {
  const perSiswa = new Map<string, AttemptRekap[]>();
  for (const a of attempts) {
    const daftar = perSiswa.get(a.studentId) ?? [];
    daftar.push(a);
    perSiswa.set(a.studentId, daftar);
  }

  const baris: BarisRekap[] = peserta.map((p) => {
    const semua = [...(perSiswa.get(p.studentId) ?? [])].sort((x, y) => waktu(x.mulaiAt) - waktu(y.mulaiAt));
    const percobaan = semua.map((a, i): RincianPercobaan => {
      const status = statusDariAttempt(a) as RincianPercobaan["status"];
      const berakhir = status === "selesai" || status === "waktu_habis";
      return {
        attemptId: a.id,
        nomor: i + 1,
        resmi: i === 0,
        status,
        skor: berakhir && a.skorAkhir != null ? a.skorAkhir : null,
        durasiMenit: berakhir && a.selesaiAt ? Math.max(0, Math.round((waktu(a.selesaiAt) - waktu(a.mulaiAt)) / 60_000)) : null,
        mulaiAt: a.mulaiAt,
        selesaiAt: a.selesaiAt,
        tabSwitchCount: a.tabSwitchCount,
      };
    });
    const resmi = percobaan[0];
    if (!resmi) {
      return { ...p, status: "belum", attemptId: null, skor: null, peringkat: null, durasiMenit: null, tabSwitchCount: 0, jumlahPercobaan: 0, percobaan: [] };
    }
    return {
      ...p,
      status: resmi.status,
      attemptId: resmi.attemptId,
      skor: resmi.skor,
      peringkat: null,
      durasiMenit: resmi.durasiMenit,
      tabSwitchCount: resmi.tabSwitchCount,
      jumlahPercobaan: percobaan.length,
      percobaan,
    };
  });

  const bernilai = baris
    .filter((b) => b.skor !== null)
    .sort((a, b) => {
      if (b.skor! !== a.skor!) return b.skor! - a.skor!;
      // Nilai sama: yang lebih cepat di atas (hanya untuk urutan tampil; peringkatnya tetap sama).
      const da = a.durasiMenit ?? Number.POSITIVE_INFINITY;
      const db = b.durasiMenit ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return urutNama(a, b);
    });
  bernilai.forEach((b, i) => {
    const sebelumnya = bernilai[i - 1];
    b.peringkat = sebelumnya && sebelumnya.skor === b.skor ? sebelumnya.peringkat : i + 1;
  });

  // Sudah mulai tetapi belum punya nilai (masih mengerjakan, dijeda, atau berakhir tanpa nilai), lalu yang belum mulai.
  const tanpaNilai = baris.filter((b) => b.skor === null && b.status !== "belum").sort(urutNama);
  const belum = baris.filter((b) => b.status === "belum").sort(urutNama);
  const urut = [...bernilai, ...tanpaNilai, ...belum];

  const nilai = bernilai.map((b) => b.skor!);
  const sebaran = sebaranKosong();
  for (const n of nilai) {
    const indeks = Math.min(sebaran.length - 1, Math.max(0, Math.floor(n / 20)));
    sebaran[indeks]!.jumlah++;
  }
  const urutNilai = [...nilai].sort((a, b) => a - b);
  const tengah = Math.floor(urutNilai.length / 2);
  const median =
    urutNilai.length === 0 ? null : urutNilai.length % 2 === 1 ? urutNilai[tengah]! : (urutNilai[tengah - 1]! + urutNilai[tengah]!) / 2;

  const jumlahSelesai = baris.filter((b) => b.status === "selesai" || b.status === "waktu_habis").length;
  const jumlahSedang = baris.filter((b) => b.status === "mengerjakan" || b.status === "dijeda").length;
  const jumlahBelum = belum.length;

  return {
    baris: urut,
    statistik: {
      jumlahPeserta: baris.length,
      jumlahSelesai,
      jumlahSedang,
      jumlahBelum,
      partisipasiPersen: baris.length === 0 ? 0 : Math.round(((jumlahSelesai + jumlahSedang) / baris.length) * 100),
      jumlahBernilai: nilai.length,
      rataRata: nilai.length === 0 ? null : satuDesimal(nilai.reduce((s, n) => s + n, 0) / nilai.length),
      tertinggi: nilai.length === 0 ? null : Math.max(...nilai),
      terendah: nilai.length === 0 ? null : Math.min(...nilai),
      median: median === null ? null : satuDesimal(median),
      sebaran,
    },
  };
}
