import type { Prisma } from "@prisma/client";
import { LABEL_JENIS_TRYOUT, tentukanJenisTryOut, type JenisTryOut } from "@/lib/exam/jenis-tryout";

/**
 * Jenis try out dalam laporan admin sekolah (rapor, peringkat, performa paket, dan filter kategori analitik). SATU aturan
 * untuk semuanya, sama dengan label di kepala rapor PDF (tentukanJenisTryOut):
 * - Nasional  : paket berkategori nasional (dijalankan admin pusat);
 * - Sekolah   : percobaan yang terhubung ke penugasan sekolah (menu "Try Out Sekolah"), atau paket milik sekolah;
 * - Mandiri   : selain itu (siswa memilih sendiri paket pusat).
 *
 * Jenis melekat pada PERCOBAAN, bukan hanya paketnya: admin sekolah menjadwalkan paket pusat (paket buatan sekolah sudah
 * tidak dipakai), jadi memakai kepemilikan paket saja membuat "Try Out Sekolah" hampir selalu kosong.
 */
export type { JenisTryOut };
export { LABEL_JENIS_TRYOUT, tentukanJenisTryOut };

export type FilterJenis = "semua" | JenisTryOut;

/** Urutan tampil tetap: Mandiri, Sekolah, Nasional. */
export const URUTAN_JENIS: readonly JenisTryOut[] = ["mandiri", "sekolah", "nasional"];

export const LABEL_FILTER_JENIS: Record<FilterJenis, string> = { semua: "Semua", ...LABEL_JENIS_TRYOUT };

/** Penjelasan singkat tiap jenis untuk admin sekolah (ditampilkan di bawah pilihan jenis). */
export const KETERANGAN_JENIS: Record<FilterJenis, string> = {
  semua: "Semua jenis try out yang pernah dikerjakan siswa sekolahmu.",
  mandiri: "Latihan yang dikerjakan siswa sendiri kapan saja dari daftar Try Out.",
  sekolah: "Try out yang kamu jadwalkan lewat menu Try Out Sekolah.",
  nasional: "Try out serentak yang dijalankan admin pusat.",
};

/** Nilai ?jenis= dari alamat. Kosong berarti "semua"; nilai selain empat pilihan yang dikenal -> null (ditolak 400). */
export function bacaFilterJenis(nilai: string | null | undefined): FilterJenis | null {
  if (nilai == null || nilai === "") return "semua";
  return nilai === "semua" || nilai === "mandiri" || nilai === "sekolah" || nilai === "nasional" ? nilai : null;
}

/**
 * Padanan tentukanJenisTryOut sebagai filter database untuk query Attempt (dipakai analitik sekolah, yang menyaring di
 * database). Diuji setara dengan tentukanJenisTryOut pada semua kombinasi kategori x penugasan x pemilik paket.
 * Hasilnya memakai AND supaya aman digabung dengan syarat `package` lain di query yang sama.
 */
export function whereJenisPercobaan(jenis: FilterJenis | null | undefined): Prisma.AttemptWhereInput {
  switch (jenis) {
    case "nasional":
      return { AND: [{ package: { kategori: "nasional" } }] };
    case "sekolah":
      return {
        AND: [
          { package: { kategori: { not: "nasional" } } },
          { OR: [{ assignmentId: { not: null } }, { package: { ownerType: "sekolah" } }] },
        ],
      };
    case "mandiri":
      return { AND: [{ assignmentId: null }, { package: { kategori: { not: "nasional" }, ownerType: { not: "sekolah" } } }] };
    default:
      return {};
  }
}
