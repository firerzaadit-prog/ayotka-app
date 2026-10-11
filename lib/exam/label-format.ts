/**
 * Nama format soal yang ditampilkan ke siswa di halaman ujian. Kode internal (pg, pg_kompleks, pg_kategori; di dokumen
 * sumber PG, PGK_MCMA, PGK_KATEGORI) tidak boleh bocor ke antarmuka siswa. Istilahnya sama dengan panduan impor Excel.
 */
export function labelFormatSoal(format: string): string {
  switch (format) {
    case "pg":
      return "Pilihan Ganda";
    case "pg_kompleks":
      return "Pilihan Ganda Kompleks";
    case "pg_kategori":
      return "Pilihan Ganda Kategori";
    default:
      return "Soal";
  }
}
