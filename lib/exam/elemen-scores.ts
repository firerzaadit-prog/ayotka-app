export type ElemenScoreInput = {
  elemenId: string;
  elemenNama: string;
  elemenUrutan: number;
  jmlBenar: number;
  jmlSoal: number;
};

export type ElemenScore = { elemenNama: string; jmlBenar: number; jmlSoal: number; persentase: number };

/**
 * Agregasi competency_scores (per Kompetensi, butir halus) naik ke level
 * Elemen (mis. "Bilangan", "Aljabar", "Geometri dan Pengukuran" untuk
 * Matematika) - Bagian 8.7 brief: Peta Kompetensi ditampilkan per Elemen,
 * bukan per Kompetensi, supaya lebih ringkas dibaca siswa. Fungsi murni
 * (tanpa I/O) supaya gampang dites terpisah dari query Prisma.
 */
export function aggregateElemenScores(scores: ElemenScoreInput[]): ElemenScore[] {
  const map = new Map<string, { elemenNama: string; elemenUrutan: number; jmlBenar: number; jmlSoal: number }>();
  for (const s of scores) {
    const existing = map.get(s.elemenId) ?? {
      elemenNama: s.elemenNama,
      elemenUrutan: s.elemenUrutan,
      jmlBenar: 0,
      jmlSoal: 0,
    };
    existing.jmlBenar += s.jmlBenar;
    existing.jmlSoal += s.jmlSoal;
    map.set(s.elemenId, existing);
  }
  return Array.from(map.values())
    .sort((a, b) => a.elemenUrutan - b.elemenUrutan)
    .map((m) => ({
      elemenNama: m.elemenNama,
      jmlBenar: m.jmlBenar,
      jmlSoal: m.jmlSoal,
      persentase: m.jmlSoal > 0 ? (m.jmlBenar / m.jmlSoal) * 100 : 0,
    }));
}
