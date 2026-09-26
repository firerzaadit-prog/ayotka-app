export type JawabanJson = { option_id: string } | { option_ids: string[] } | Record<string, string>;

type SoalUntukCek = {
  format: string;
  options: { id: string }[];
  statements: { id: string }[];
  categories: { id: string }[];
};

/**
 * ID pilihan/pernyataan/kategori dalam jawaban siswa wajib milik soalnya dan
 * cocok dengan formatnya (PG: option_id, PG Kompleks: option_ids, PG Kategori:
 * { pernyataanId: kategoriId }). Objek kosong diterima untuk semua format:
 * dikirim halaman ujian saat soal yang belum dijawab ditandai ragu-ragu.
 */
export function jawabanCocokDenganSoal(jawaban: JawabanJson, soal: SoalUntukCek): boolean {
  const optionIds = new Set(soal.options.map((o) => o.id));
  if ("option_id" in jawaban && typeof jawaban.option_id === "string") {
    return soal.format === "pg" && optionIds.has(jawaban.option_id);
  }
  if ("option_ids" in jawaban && Array.isArray(jawaban.option_ids)) {
    return (
      soal.format === "pg_kompleks" &&
      new Set(jawaban.option_ids).size === jawaban.option_ids.length &&
      jawaban.option_ids.every((id) => optionIds.has(id))
    );
  }
  const entries = Object.entries(jawaban as Record<string, string>);
  if (entries.length === 0) return true;
  const statementIds = new Set(soal.statements.map((s) => s.id));
  const categoryIds = new Set(soal.categories.map((c) => c.id));
  return (
    soal.format === "pg_kategori" &&
    entries.every(([statementId, categoryId]) => statementIds.has(statementId) && categoryIds.has(categoryId))
  );
}
