export type MateriScoreInput = {
  materiId: string;
  materiNama: string;
  materiUrutan: number;
  jmlBenar: number;
  jmlSoal: number;
};

export type MateriScore = { materiNama: string; jmlBenar: number; jmlSoal: number; persentase: number };

/**
 * Agregasi competency_scores (per Kompetensi, butir halus) naik ke level
 * Materi (mis. "Bilangan", "Aljabar", "Geometri dan Pengukuran" untuk
 * Matematika) - Bagian 8.7 brief: Peta Kompetensi ditampilkan per Materi,
 * bukan per Kompetensi, supaya lebih ringkas dibaca siswa. Fungsi murni
 * (tanpa I/O) supaya gampang dites terpisah dari query Prisma.
 */
export function aggregateMateriScores(scores: MateriScoreInput[]): MateriScore[] {
  const map = new Map<string, { materiNama: string; materiUrutan: number; jmlBenar: number; jmlSoal: number }>();
  for (const s of scores) {
    const existing = map.get(s.materiId) ?? {
      materiNama: s.materiNama,
      materiUrutan: s.materiUrutan,
      jmlBenar: 0,
      jmlSoal: 0,
    };
    existing.jmlBenar += s.jmlBenar;
    existing.jmlSoal += s.jmlSoal;
    map.set(s.materiId, existing);
  }
  return Array.from(map.values())
    .sort((a, b) => a.materiUrutan - b.materiUrutan)
    .map((m) => ({
      materiNama: m.materiNama,
      jmlBenar: m.jmlBenar,
      jmlSoal: m.jmlSoal,
      persentase: m.jmlSoal > 0 ? (m.jmlBenar / m.jmlSoal) * 100 : 0,
    }));
}
