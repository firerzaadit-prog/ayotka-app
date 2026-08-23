/**
 * Tiket 2.7 — validator kesetaraan kisi-kisi (blueprint). Fungsi murni,
 * dipanggil saat tombol Publish ditekan (lihat app/api/packages/[id]/publish).
 * Bagian 4 brief: "jumlah soal per kompetensi, per tingkat kesulitan, dan
 * per format sudah sesuai kisi-kisi. Kalau belum, tampilkan selisihnya."
 */

export type BlueprintRequirement = {
  kompetensiId: string;
  kompetensiKode: string;
  tingkatKesulitan: string;
  formatSoal: string;
  jumlahSoal: number;
};

export type QuestionForValidation = {
  kompetensiId: string;
  tingkatKesulitan: string;
  format: string;
};

export type BlueprintGap = {
  kompetensiKode: string;
  tingkatKesulitan: string;
  formatSoal: string;
  dibutuhkan: number;
  tersedia: number;
  selisih: number;
};

export type BlueprintValidationResult = {
  compliant: boolean;
  gaps: BlueprintGap[];
};

export function validateBlueprintCompliance(
  requirements: BlueprintRequirement[],
  questions: QuestionForValidation[],
): BlueprintValidationResult {
  const gaps: BlueprintGap[] = [];

  for (const req of requirements) {
    const tersedia = questions.filter(
      (q) =>
        q.kompetensiId === req.kompetensiId &&
        q.tingkatKesulitan === req.tingkatKesulitan &&
        q.format === req.formatSoal,
    ).length;

    if (tersedia < req.jumlahSoal) {
      gaps.push({
        kompetensiKode: req.kompetensiKode,
        tingkatKesulitan: req.tingkatKesulitan,
        formatSoal: req.formatSoal,
        dibutuhkan: req.jumlahSoal,
        tersedia,
        selisih: req.jumlahSoal - tersedia,
      });
    }
  }

  return { compliant: gaps.length === 0, gaps };
}

export function formatBlueprintGapMessage(gaps: BlueprintGap[]): string {
  return gaps
    .map(
      (g) =>
        `kurang ${g.selisih} soal ${g.tingkatKesulitan} pada kompetensi ${g.kompetensiKode} (format ${g.formatSoal})`,
    )
    .join("; ");
}
