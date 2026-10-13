import type { JenisTryOut } from "@/lib/exam/jenis-tryout";
import { tanggalWIB } from "@/lib/utils/datetime";

/**
 * Nama berkas rapor PDF yang aman untuk header Content-Disposition: hanya huruf, angka, dan tanda hubung ASCII (nama
 * siswa bisa memuat tanda kutip atau huruf non-Latin yang membuat header tidak sah), diikuti jenis Try Out dan tanggal
 * ujian, mis. "Rapor-Budi-Santoso-Try-Out-Nasional-2026-10-12.pdf". Murni; dipakai route rapor.
 */
const JENIS: Record<JenisTryOut, string> = { mandiri: "Try-Out-Mandiri", sekolah: "Try-Out-Sekolah", nasional: "Try-Out-Nasional" };

export function namaBerkasRapor(namaSiswa: string, jenis: JenisTryOut | null, mulai: Date | null | undefined): string {
  const nama =
    namaSiswa
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "Siswa";
  const bagian = ["Rapor", nama];
  if (jenis) bagian.push(JENIS[jenis]);
  if (mulai && !Number.isNaN(mulai.getTime())) bagian.push(tanggalWIB(mulai));
  return `${bagian.join("-")}.pdf`;
}
