import { describe, expect, it } from "vitest";
import { ambilSkorTerbaikPerSiswaMapel, ringkasKesiapan } from "@/lib/analytics/kesiapan";

describe("ambilSkorTerbaikPerSiswaMapel", () => {
  it("ambil skor TERTINGGI per (siswa, mapel), bukan terakhir atau rata-rata", () => {
    const result = ambilSkorTerbaikPerSiswaMapel([
      { studentId: "s1", subjectNama: "Matematika", skorAkhir: 40 },
      { studentId: "s1", subjectNama: "Matematika", skorAkhir: 80 },
      { studentId: "s1", subjectNama: "Matematika", skorAkhir: 60 },
    ]);
    expect(result).toEqual([{ subjectNama: "Matematika", skorAkhir: 80 }]);
  });

  it("mapel berbeda dari siswa yang sama tetap terpisah", () => {
    const result = ambilSkorTerbaikPerSiswaMapel([
      { studentId: "s1", subjectNama: "Matematika", skorAkhir: 70 },
      { studentId: "s1", subjectNama: "Bahasa Indonesia", skorAkhir: 85 },
    ]);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ subjectNama: "Matematika", skorAkhir: 70 });
    expect(result).toContainEqual({ subjectNama: "Bahasa Indonesia", skorAkhir: 85 });
  });

  it("siswa berbeda dihitung terpisah (tidak tercampur)", () => {
    const result = ambilSkorTerbaikPerSiswaMapel([
      { studentId: "s1", subjectNama: "Matematika", skorAkhir: 40 },
      { studentId: "s2", subjectNama: "Matematika", skorAkhir: 90 },
    ]);
    expect(result).toHaveLength(2);
  });
});

describe("ringkasKesiapan", () => {
  it("mapel di luar cakupan (mis. Seni Budaya) diabaikan, bukan bikin error", () => {
    const result = ringkasKesiapan([{ subjectNama: "Seni Budaya", skorAkhir: 90 }]);
    expect(result.gabungan.total).toBe(0);
    expect(result.gabungan.persentaseSiap).toBe(0);
  });

  it("gabungan mencampur kedua mapel, rincian per mapel tetap terpisah", () => {
    const result = ringkasKesiapan([
      { subjectNama: "Matematika", skorAkhir: 20 }, // kurang
      { subjectNama: "Matematika", skorAkhir: 70 }, // baik
      { subjectNama: "Bahasa Indonesia", skorAkhir: 96 }, // istimewa
    ]);

    // Gabungan: total 3 data poin dari kedua mapel dicampur.
    expect(result.gabungan.total).toBe(3);
    expect(result.gabungan.kurang).toBe(1);
    expect(result.gabungan.baik).toBe(1);
    expect(result.gabungan.istimewa).toBe(1);
    // Siap = memadai+baik+istimewa = 2 dari 3.
    expect(result.gabungan.persentaseSiap).toBeCloseTo((2 / 3) * 100);

    const matematika = result.perMapel.find((m) => m.subjectNama === "Matematika")!;
    expect(matematika.breakdown.total).toBe(2);
    expect(matematika.breakdown.kurang).toBe(1);
    expect(matematika.breakdown.baik).toBe(1);
    expect(matematika.breakdown.persentaseSiap).toBeCloseTo(50);

    const bindo = result.perMapel.find((m) => m.subjectNama === "Bahasa Indonesia")!;
    expect(bindo.breakdown.total).toBe(1);
    expect(bindo.breakdown.istimewa).toBe(1);
    expect(bindo.breakdown.persentaseSiap).toBe(100);
  });

  it("IPA & Bahasa Inggris kini ikut masuk gabungan dan perMapel, sama seperti Matematika/Bahasa Indonesia", () => {
    const result = ringkasKesiapan([
      { subjectNama: "IPA", skorAkhir: 96 }, // istimewa
      { subjectNama: "Bahasa Inggris", skorAkhir: 20 }, // kurang
    ]);

    expect(result.gabungan.total).toBe(2);
    expect(result.gabungan.istimewa).toBe(1);
    expect(result.gabungan.kurang).toBe(1);

    const ipa = result.perMapel.find((m) => m.subjectNama === "IPA")!;
    expect(ipa.breakdown.total).toBe(1);
    expect(ipa.breakdown.istimewa).toBe(1);

    const inggris = result.perMapel.find((m) => m.subjectNama === "Bahasa Inggris")!;
    expect(inggris.breakdown.total).toBe(1);
    expect(inggris.breakdown.kurang).toBe(1);
  });

  it("perMapel selalu mengembalikan keempat mapel walau sebagian belum ada data (total 0, bukan hilang dari daftar)", () => {
    const result = ringkasKesiapan([{ subjectNama: "Matematika", skorAkhir: 80 }]);
    expect(result.perMapel).toHaveLength(4);
    const bindo = result.perMapel.find((m) => m.subjectNama === "Bahasa Indonesia")!;
    expect(bindo.breakdown.total).toBe(0);
    expect(bindo.breakdown.persentaseSiap).toBe(0);
  });

  it("total kosong tidak pernah bagi-nol (persentaseSiap = 0, bukan NaN)", () => {
    const result = ringkasKesiapan([]);
    expect(result.gabungan.persentaseSiap).toBe(0);
    expect(Number.isNaN(result.gabungan.persentaseSiap)).toBe(false);
  });
});
