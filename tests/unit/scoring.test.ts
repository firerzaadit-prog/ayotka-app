import { describe, expect, it } from "vitest";
import {
  aggregateCompetency,
  computeSkorAkhir,
  isSubjectKesiapanDidukung,
  klasifikasiKesiapan,
  scorePg,
  scorePgKategori,
  scorePgKompleks,
  scoreQuestion,
} from "@/lib/exam/scoring";

describe("scorePg", () => {
  const options = [
    { id: "a", isCorrect: false },
    { id: "b", isCorrect: true },
    { id: "c", isCorrect: false },
  ];

  it("benar kalau memilih opsi kunci", () => {
    expect(scorePg({ option_id: "b" }, options)).toBe(true);
  });

  it("salah kalau memilih opsi lain", () => {
    expect(scorePg({ option_id: "a" }, options)).toBe(false);
  });

  it("salah kalau tidak menjawab", () => {
    expect(scorePg(null, options)).toBe(false);
    expect(scorePg(undefined, options)).toBe(false);
  });
});

describe("scorePgKompleks (all-or-nothing)", () => {
  const options = [
    { id: "a", isCorrect: true },
    { id: "b", isCorrect: true },
    { id: "c", isCorrect: false },
    { id: "d", isCorrect: false },
  ];

  it("benar kalau semua kunci terpilih persis, tanpa opsi salah", () => {
    expect(scorePgKompleks({ option_ids: ["a", "b"] }, options)).toBe(true);
  });

  it("urutan pemilihan tidak masalah", () => {
    expect(scorePgKompleks({ option_ids: ["b", "a"] }, options)).toBe(true);
  });

  it("salah kalau cuma sebagian kunci terpilih (3 dari 4 benar tetap 0)", () => {
    expect(scorePgKompleks({ option_ids: ["a"] }, options)).toBe(false);
  });

  it("salah kalau ada opsi salah yang ikut terpilih", () => {
    expect(scorePgKompleks({ option_ids: ["a", "b", "c"] }, options)).toBe(false);
  });

  it("salah kalau tidak menjawab", () => {
    expect(scorePgKompleks({ option_ids: [] }, options)).toBe(false);
    expect(scorePgKompleks(null, options)).toBe(false);
  });
});

describe("scorePgKategori (maks 3 baris, satu salah = 0)", () => {
  const statements = [
    { id: "s1", correctCategoryId: "benar" },
    { id: "s2", correctCategoryId: "salah" },
    { id: "s3", correctCategoryId: "benar" },
  ];

  it("benar kalau semua baris cocok", () => {
    expect(
      scorePgKategori({ s1: "benar", s2: "salah", s3: "benar" }, statements),
    ).toBe(true);
  });

  it("salah kalau satu saja baris tidak cocok", () => {
    expect(
      scorePgKategori({ s1: "benar", s2: "benar", s3: "benar" }, statements),
    ).toBe(false);
  });

  it("salah kalau ada baris belum dijawab", () => {
    expect(scorePgKategori({ s1: "benar", s3: "benar" }, statements)).toBe(false);
  });
});

describe("scoreQuestion", () => {
  it("skor penuh (bobot) kalau benar, 0 kalau salah - tidak pernah pecahan", () => {
    const question = {
      format: "pg" as const,
      bobot: 5,
      options: [
        { id: "a", isCorrect: true },
        { id: "b", isCorrect: false },
      ],
      statements: [],
    };
    expect(scoreQuestion(question, { option_id: "a" })).toEqual({
      isCorrect: true,
      skor: 5,
      skorMaks: 5,
    });
    expect(scoreQuestion(question, { option_id: "b" })).toEqual({
      isCorrect: false,
      skor: 0,
      skorMaks: 5,
    });
  });
});

describe("computeSkorAkhir", () => {
  it("menghitung persentase dari skor diperoleh vs maksimum", () => {
    expect(computeSkorAkhir(7, 10)).toBeCloseTo(70);
    expect(computeSkorAkhir(0, 10)).toBe(0);
    expect(computeSkorAkhir(10, 10)).toBe(100);
  });

  it("tidak pernah minus atau bagi nol", () => {
    expect(computeSkorAkhir(0, 0)).toBe(0);
  });
});

describe("aggregateCompetency", () => {
  it("agregat dari total skor diperoleh / total skor maksimum, bukan sekadar jumlah benar", () => {
    const result = aggregateCompetency([
      { kompetensiId: "k1", skor: 5, skorMaks: 5 },
      { kompetensiId: "k1", skor: 0, skorMaks: 5 },
      { kompetensiId: "k2", skor: 3, skorMaks: 3 },
    ]);

    const k1 = result.find((r) => r.kompetensiId === "k1")!;
    expect(k1.jmlSoal).toBe(2);
    expect(k1.jmlBenar).toBe(1);
    expect(k1.persentase).toBeCloseTo(50);

    const k2 = result.find((r) => r.kompetensiId === "k2")!;
    expect(k2.persentase).toBeCloseTo(100);
  });
});

describe("isSubjectKesiapanDidukung", () => {
  it("Matematika, Bahasa Indonesia, IPA, dan Bahasa Inggris punya standar kesiapan", () => {
    expect(isSubjectKesiapanDidukung("Matematika")).toBe(true);
    expect(isSubjectKesiapanDidukung("Bahasa Indonesia")).toBe(true);
    expect(isSubjectKesiapanDidukung("IPA")).toBe(true);
    expect(isSubjectKesiapanDidukung("Bahasa Inggris")).toBe(true);
  });

  it("mapel di luar keempat itu tidak didukung", () => {
    expect(isSubjectKesiapanDidukung("Seni Budaya")).toBe(false);
  });
});

describe("klasifikasiKesiapan", () => {
  it("null untuk mapel yang belum punya standar kesiapan", () => {
    expect(klasifikasiKesiapan("Seni Budaya", 90)).toBeNull();
  });

  describe("Matematika (Kurang <33,33 / Memadai 33,33-<56,67 / Baik >=56,67 / Istimewa >=95)", () => {
    it("Kurang", () => {
      expect(klasifikasiKesiapan("Matematika", 0)).toBe("kurang");
      expect(klasifikasiKesiapan("Matematika", 33.32)).toBe("kurang");
    });
    it("Memadai, termasuk batas bawah tepat 33,33", () => {
      expect(klasifikasiKesiapan("Matematika", 33.33)).toBe("memadai");
      expect(klasifikasiKesiapan("Matematika", 56.66)).toBe("memadai");
    });
    it("Baik, termasuk batas bawah tepat 56,67", () => {
      expect(klasifikasiKesiapan("Matematika", 56.67)).toBe("baik");
      expect(klasifikasiKesiapan("Matematika", 94.99)).toBe("baik");
    });
    it("Istimewa mulai tepat 95, mengalahkan Baik meski sama-sama di atas ambang Baik", () => {
      expect(klasifikasiKesiapan("Matematika", 95)).toBe("istimewa");
      expect(klasifikasiKesiapan("Matematika", 100)).toBe("istimewa");
    });
  });

  describe("Bahasa Indonesia (Kurang <50 / Memadai 50-<76,67 / Baik >=76,67 / Istimewa >=95)", () => {
    it("Kurang", () => {
      expect(klasifikasiKesiapan("Bahasa Indonesia", 49.99)).toBe("kurang");
    });
    it("Memadai, termasuk batas bawah tepat 50", () => {
      expect(klasifikasiKesiapan("Bahasa Indonesia", 50)).toBe("memadai");
      expect(klasifikasiKesiapan("Bahasa Indonesia", 76.66)).toBe("memadai");
    });
    it("Baik, termasuk batas bawah tepat 76,67", () => {
      expect(klasifikasiKesiapan("Bahasa Indonesia", 76.67)).toBe("baik");
    });
    it("Istimewa mulai tepat 95", () => {
      expect(klasifikasiKesiapan("Bahasa Indonesia", 95)).toBe("istimewa");
    });
  });

  describe("IPA & Bahasa Inggris (SMP) memakai standar Bahasa Indonesia SMP persis sama", () => {
    it.each(["IPA", "Bahasa Inggris"] as const)("%s", (subjectNama) => {
      expect(klasifikasiKesiapan(subjectNama, 49.99)).toBe("kurang");
      expect(klasifikasiKesiapan(subjectNama, 50)).toBe("memadai");
      expect(klasifikasiKesiapan(subjectNama, 76.66)).toBe("memadai");
      expect(klasifikasiKesiapan(subjectNama, 76.67)).toBe("baik");
      expect(klasifikasiKesiapan(subjectNama, 95)).toBe("istimewa");
    });
  });
});
