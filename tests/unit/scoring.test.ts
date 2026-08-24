import { describe, expect, it } from "vitest";
import {
  aggregateCompetency,
  computeSkorAkhir,
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
