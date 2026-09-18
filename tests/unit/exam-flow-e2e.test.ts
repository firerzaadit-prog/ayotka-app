import { describe, expect, it, vi } from "vitest";

// Mock server-only so Vitest runs server logic without throwing
vi.mock("server-only", () => ({}));

import {
  scorePg,
  scorePgKompleks,
  scorePgKategori,
  scoreQuestion,
  computeSkorAkhir,
  aggregateCompetency,
} from "@/lib/exam/scoring";
import { aggregateMateriScores } from "@/lib/exam/materi-scores";
import { buildAnalisisPrompt } from "@/lib/ai/prompt";
import { analisisSchema } from "@/lib/ai/schema";

describe("Alur Pengerjaan, Skoring, Peta Kompetensi, dan Analisis AI Ujian Siswa", () => {
  describe("1. Mesin Skoring Jawaban Siswa (PG, PG Kompleks, PG Kategori)", () => {
    it("menilai benar untuk soal PG jika option_id cocok dengan kunci", () => {
      const options = [
        { id: "opt-1", isCorrect: false },
        { id: "opt-2", isCorrect: true },
        { id: "opt-3", isCorrect: false },
      ];
      expect(scorePg({ option_id: "opt-2" }, options)).toBe(true);
      expect(scorePg({ option_id: "opt-1" }, options)).toBe(false);
      expect(scorePg(null, options)).toBe(false);

      const res = scoreQuestion(
        { format: "pg", bobot: 4, options, statements: [] },
        { option_id: "opt-2" },
      );
      expect(res).toEqual({ isCorrect: true, skor: 4, skorMaks: 4 });
    });

    it("menilai benar untuk soal PG Kompleks jika semua kunci dipilih dan tidak ada opsi salah", () => {
      const options = [
        { id: "opt-1", isCorrect: true },
        { id: "opt-2", isCorrect: false },
        { id: "opt-3", isCorrect: true },
      ];
      expect(scorePgKompleks({ option_ids: ["opt-1", "opt-3"] }, options)).toBe(true);
      expect(scorePgKompleks({ option_ids: ["opt-1"] }, options)).toBe(false); // kurang satu
      expect(scorePgKompleks({ option_ids: ["opt-1", "opt-2", "opt-3"] }, options)).toBe(false); // kelebihan opsi salah
    });

    it("menilai benar untuk soal PG Kategori jika semua baris pernyataan sesuai kategori yang benar", () => {
      const statements = [
        { id: "stmt-1", correctCategoryId: "cat-benar" },
        { id: "stmt-2", correctCategoryId: "cat-salah" },
      ];
      expect(
        scorePgKategori(
          { "stmt-1": "cat-benar", "stmt-2": "cat-salah" },
          statements,
        ),
      ).toBe(true);

      expect(
        scorePgKategori(
          { "stmt-1": "cat-benar", "stmt-2": "cat-benar" },
          statements,
        ),
      ).toBe(false);
    });

    it("menghitung skor akhir skala 0-100 secara akurat", () => {
      // 10 soal bobot 4 masing-masing = skorMaksTotal 40. Jika benar 7 soal = 28 -> skorAkhir 70
      expect(computeSkorAkhir(28, 40)).toBe(70);
      expect(computeSkorAkhir(0, 40)).toBe(0);
      expect(computeSkorAkhir(40, 40)).toBe(100);
    });
  });

  describe("2. Peta Kompetensi dan Agregasi Materi", () => {
    it("mengagregasi skor per kompetensi", () => {
      const answers = [
        { kompetensiId: "k-1", skor: 4, skorMaks: 4 },
        { kompetensiId: "k-1", skor: 0, skorMaks: 4 },
        { kompetensiId: "k-2", skor: 5, skorMaks: 5 },
      ];
      const aggregated = aggregateCompetency(answers);
      expect(aggregated).toHaveLength(2);

      const k1 = aggregated.find((a) => a.kompetensiId === "k-1");
      expect(k1).toEqual({
        kompetensiId: "k-1",
        jmlBenar: 1,
        jmlSoal: 2,
        persentase: 50,
      });

      const k2 = aggregated.find((a) => a.kompetensiId === "k-2");
      expect(k2).toEqual({
        kompetensiId: "k-2",
        jmlBenar: 1,
        jmlSoal: 1,
        persentase: 100,
      });
    });

    it("mengagregasi skor kompetensi menjadi Peta Kompetensi per Materi untuk grafik UI", () => {
      const materiInputs = [
        { materiId: "m-1", materiNama: "Aljabar", materiUrutan: 1, jmlBenar: 2, jmlSoal: 3 },
        { materiId: "m-1", materiNama: "Aljabar", materiUrutan: 1, jmlBenar: 1, jmlSoal: 1 },
        { materiId: "m-2", materiNama: "Geometri", materiUrutan: 2, jmlBenar: 0, jmlSoal: 2 },
      ];
      const materiScores = aggregateMateriScores(materiInputs);
      expect(materiScores).toEqual([
        {
          materiNama: "Aljabar",
          jmlBenar: 3,
          jmlSoal: 4,
          persentase: 75,
        },
        {
          materiNama: "Geometri",
          jmlBenar: 0,
          jmlSoal: 2,
          persentase: 0,
        },
      ]);
    });
  });

  describe("3. Format Pembahasan dan AI Learning Analytics", () => {
    it("membuat prompt analisis AI dengan konteks lengkap soal, jawaban siswa, kunci, dan pembahasan", () => {
      const prompt = buildAnalisisPrompt({
        namaSiswa: "Ahmad Siswa",
        paketNama: "Try Out Matematika Mandiri",
        skorAkhir: 75,
        kerangkaAsesmen: null,
        kompetensi: [
          {
            kode: "MAT.01",
            deskripsi: "Operasi Pecahan",
            materiNama: "Bilangan",
            subMateriNama: "Pecahan",
            jmlBenar: 3,
            jmlSoal: 4,
            persentase: 75,
          },
        ],
        levelKognitif: [{ level: "L2", jmlBenar: 3, jmlSoal: 4 }],
        format: [{ format: "pg", jmlBenar: 3, jmlSoal: 4 }],
        soal: [
          {
            nomor: 1,
            benar: false,
            teksSoal: "Berapakah 1/2 + 1/4?",
            kompetensi: "MAT.01",
            materiNama: "Bilangan",
            subMateriNama: "Pecahan",
            levelBloom: "L2",
            jawabanSiswa: "2/6",
            kunciJawaban: "3/4",
            pembahasan: "Samakan penyebut menjadi 4: 2/4 + 1/4 = 3/4.",
          },
        ],
      });

      expect(prompt).toContain("Ahmad Siswa");
      expect(prompt).toContain("Try Out Matematika Mandiri");
      expect(prompt).toContain("Berapakah 1/2 + 1/4?");
      expect(prompt).toContain("2/6");
      expect(prompt).toContain("3/4");
      expect(prompt).toContain("Samakan penyebut menjadi 4");
    });

    it("memvalidasi schema output AI (ringkasan, petaKompetensi, kelebihanSiswa, kekuranganSiswa, rekomendasi)", () => {
      const sampleAiResponse = {
        ringkasan: "Siswa telah memahami konsep dasar operasi pecahan namun perlu cermat dalam menyamakan penyebut.",
        petaKompetensi: [
          { kode: "MAT.01", narasi: "Penguasaan pecahan sudah mencapai 75%." },
        ],
        kelebihanSiswa: "Level penerapan (L2) cukup baik dengan ketepatan 75%, pemahaman rumus sangat kokoh.",
        kekuranganSiswa: "Siswa cenderung terburu-buru saat menyamakan penyebut pada pecahan berbeda.",
        rekomendasi: [
          "Latihan menyamakan penyebut menggunakan KPK.",
          "Kerjakan soal latihan pecahan setara.",
        ],
      };

      const parsed = analisisSchema.safeParse(sampleAiResponse);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.ringkasan).toBeDefined();
        expect(parsed.data.petaKompetensi).toHaveLength(1);
        expect(parsed.data.petaKompetensi[0]!.kode).toBe("MAT.01");
        expect(parsed.data.kelebihanSiswa).toContain("Level penerapan");
        expect(parsed.data.kekuranganSiswa).toContain("terburu-buru");
        expect(parsed.data.rekomendasi).toHaveLength(2);
      }
    });
  });
});
