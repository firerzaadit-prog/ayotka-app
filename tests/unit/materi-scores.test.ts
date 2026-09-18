import { describe, expect, it } from "vitest";
import { aggregateMateriScores } from "@/lib/exam/materi-scores";
import { competencyTier } from "@/lib/exam/competency-color";

describe("aggregateMateriScores", () => {
  it("menjumlahkan beberapa kompetensi dalam satu materi yang sama", () => {
    const result = aggregateMateriScores([
      { materiId: "m1", materiNama: "Bilangan", materiUrutan: 1, jmlBenar: 2, jmlSoal: 3 },
      { materiId: "m1", materiNama: "Bilangan", materiUrutan: 1, jmlBenar: 1, jmlSoal: 2 },
    ]);
    expect(result).toEqual([{ materiNama: "Bilangan", jmlBenar: 3, jmlSoal: 5, persentase: 60 }]);
  });

  it("mengurutkan hasil berdasarkan materiUrutan, bukan urutan input", () => {
    const result = aggregateMateriScores([
      { materiId: "m2", materiNama: "Geometri", materiUrutan: 2, jmlBenar: 1, jmlSoal: 1 },
      { materiId: "m1", materiNama: "Bilangan", materiUrutan: 1, jmlBenar: 1, jmlSoal: 1 },
    ]);
    expect(result.map((r) => r.materiNama)).toEqual(["Bilangan", "Geometri"]);
  });

  it("mengembalikan array kosong kalau tidak ada skor kompetensi", () => {
    expect(aggregateMateriScores([])).toEqual([]);
  });
});

describe("competencyTier", () => {
  it("70% ke atas adalah baik", () => {
    expect(competencyTier(70)).toBe("baik");
    expect(competencyTier(100)).toBe("baik");
  });

  it("50-69% adalah cukup", () => {
    expect(competencyTier(69)).toBe("cukup");
    expect(competencyTier(50)).toBe("cukup");
  });

  it("di bawah 50% adalah kurang", () => {
    expect(competencyTier(49)).toBe("kurang");
    expect(competencyTier(0)).toBe("kurang");
  });
});
