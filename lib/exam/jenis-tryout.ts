import { formatWIBJam } from "@/lib/utils/datetime";

/**
 * Bagian murni (tanpa database) dari identitas rapor PDF: jenis Try Out, kode soal, dan rentang waktu pengerjaan.
 * Pemuat datanya ada di lib/exam/identitas-rapor.ts. Dipisah supaya pembuat PDF dan tes tidak ikut memuat koneksi database.
 */
export type JenisTryOut = "mandiri" | "sekolah" | "nasional";

export const LABEL_JENIS_TRYOUT: Record<JenisTryOut, string> = {
  mandiri: "Try Out Mandiri",
  sekolah: "Try Out Sekolah",
  nasional: "Try Out Nasional",
};

export type IdentitasRapor = {
  /** Asal sekolah siswa (sekolahnya, atau sekolah yang dipilih/ditulis saat mendaftar mandiri); null bila tidak ada. */
  asalSekolah: string | null;
  jenisTryOut: JenisTryOut;
  /** Mata pelajaran dan jenjang paket (mis. "Matematika" dan "SD"); null bila tidak terbaca. */
  mataPelajaran: string | null;
  jenjang: string | null;
  /** Kode paket soal: kode dari soal.ayotka.id bila paketnya diimpor dari sana, selain itu kode pendek dari ID paket. */
  kodeSoal: string;
  /** Awal pengerjaan (tanggal ujian) dan akhirnya (null bila belum tercatat). */
  mulaiAt: Date;
  selesaiAt: Date | null;
};

/**
 * Jenis Try Out sebuah percobaan:
 * - "nasional": paket berkategori nasional (dijalankan admin pusat);
 * - "sekolah": ujian yang dijadwalkan sekolah (percobaan terhubung ke penugasan) atau paket milik sekolah;
 * - "mandiri": selain itu (paket pusat yang dipilih siswa sendiri).
 * Nasional didahulukan: penugasan nasional tetap berjenis nasional.
 */
export function tentukanJenisTryOut(input: {
  kategori: "mandiri" | "nasional";
  assignmentId: string | null | undefined;
  ownerType: "pusat" | "sekolah" | null | undefined;
}): JenisTryOut {
  if (input.kategori === "nasional") return "nasional";
  if (input.assignmentId || input.ownerType === "sekolah") return "sekolah";
  return "mandiri";
}

/**
 * Kode soal yang dicetak: kode paket dari soal.ayotka.id bila ada (dipangkas), selain itu "PKT-" + 8 huruf/angka pertama
 * dari ID paket (huruf besar) supaya tetap bisa dirujuk saat siswa atau admin menanyakan paket yang mana.
 */
export function kodeSoalPaket(packageId: string, kodeImpor: string | null | undefined): string {
  const impor = (kodeImpor ?? "").trim();
  if (impor) return impor;
  const pendek = packageId.replace(/[^0-9A-Za-z]/g, "").slice(0, 8).toUpperCase();
  return pendek ? `PKT-${pendek}` : "-";
}

/**
 * Rentang waktu pengerjaan dalam WIB, mis. "15.38 - 16.12 WIB (34 menit)". Tanpa waktu selesai: "mulai 15.38 WIB". Bila waktu
 * selesai tidak masuk akal (sebelum mulai) atau tanggal tidak sah, hanya jam mulai yang ditulis.
 */
export function rentangWaktuPengerjaan(mulai: Date, selesai: Date | null | undefined): string {
  if (Number.isNaN(mulai.getTime())) return "-";
  const jamMulai = formatWIBJam(mulai);
  if (!selesai || Number.isNaN(selesai.getTime()) || selesai.getTime() < mulai.getTime()) return `mulai ${jamMulai}`;
  const menit = Math.max(1, Math.round((selesai.getTime() - mulai.getTime()) / 60_000));
  return `${jamMulai.replace(/ WIB$/, "")} - ${formatWIBJam(selesai)} (${menit} menit)`;
}
