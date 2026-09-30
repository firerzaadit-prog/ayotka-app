import { describe, expect, it } from "vitest";
import { aggregateElemenScores } from "@/lib/exam/elemen-scores";
import { competencyTier } from "@/lib/exam/competency-color";

describe("aggregateElemenScores", () => {
  it("menjumlahkan beberapa kompetensi dalam satu elemen yang sama", () => {
    const result = aggregateElemenScores([
      { elemenId: "e1", elemenNama: "Bilangan", elemenUrutan: 1, jmlBenar: 2, jmlSoal: 3 },
      { elemenId: "e1", elemenNama: "Bilangan", elemenUrutan: 1, jmlBenar: 1, jmlSoal: 2 },
    ]);
    expect(result).toEqual([{ elemenNama: "Bilangan", jmlBenar: 3, jmlSoal: 5, persentase: 60 }]);
  });

  it("mengurutkan hasil berdasarkan elemenUrutan, bukan urutan input", () => {
    const result = aggregateElemenScores([
      { elemenId: "e2", elemenNama: "Geometri", elemenUrutan: 2, jmlBenar: 1, jmlSoal: 1 },
      { elemenId: "e1", elemenNama: "Bilangan", elemenUrutan: 1, jmlBenar: 1, jmlSoal: 1 },
    ]);
    expect(result.map((r) => r.elemenNama)).toEqual(["Bilangan", "Geometri"]);
  });

  it("mengembalikan array kosong kalau tidak ada skor kompetensi", () => {
    expect(aggregateElemenScores([])).toEqual([]);
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
