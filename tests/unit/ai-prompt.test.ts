import { describe, expect, it } from "vitest";
import { buildAnalisisPrompt } from "@/lib/ai/prompt";
import { analisisSchema } from "@/lib/ai/schema";

describe("buildAnalisisPrompt", () => {
  const input = {
    namaSiswa: "Budi Santoso",
    paketNama: "Paket Matematika Kelas 8",
    skorAkhir: 85,
    kompetensi: [
      { kode: "K1", deskripsi: "Operasi bilangan bulat", jmlBenar: 4, jmlSoal: 5, persentase: 80 },
    ],
    levelKognitif: [{ level: "L1", jmlBenar: 3, jmlSoal: 3 }],
    format: [{ format: "pg", jmlBenar: 4, jmlSoal: 5 }],
    salahDijawab: [
      {
        teksSoal: "Soal cerita panjang tentang bilangan bulat",
        kompetensi: "K1",
        levelBloom: "L3",
      },
    ],
  };

  it("menyertakan semua angka yang diberikan persis apa adanya", () => {
    const prompt = buildAnalisisPrompt(input);
    expect(prompt).toContain("Budi Santoso");
    expect(prompt).toContain("Nilai akhir: 85");
    expect(prompt).toContain("K1 (Operasi bilangan bulat): 4/5 benar (80%)");
    expect(prompt).toContain("L1: 3/3 benar");
  });

  it("secara eksplisit melarang AI menghitung ulang atau menyebut ranking", () => {
    const prompt = buildAnalisisPrompt(input);
    expect(prompt.toLowerCase()).toContain("jangan menghitung ulang");
    expect(prompt.toLowerCase()).toContain("ranking");
  });

  it("tetap menghasilkan prompt valid walau tidak ada data kompetensi", () => {
    const prompt = buildAnalisisPrompt({ ...input, kompetensi: [], levelKognitif: [], format: [] });
    expect(prompt).toContain("(tidak ada data)");
  });
});

describe("analisisSchema", () => {
  const valid = {
    ringkasan: "Kamu sudah cukup baik di sebagian besar kompetensi.",
    petaKompetensi: [{ kode: "K1", narasi: "Sudah kuat di operasi bilangan bulat." }],
    levelKognitif: "Kuat di L1-L2, masih perlu latihan di L3.",
    polaKesalahan: "Beberapa kesalahan pada soal cerita panjang.",
    rekomendasi: ["Latihan soal cerita bilangan bulat"],
  };

  it("menerima struktur yang lengkap dan sesuai", () => {
    expect(analisisSchema.safeParse(valid).success).toBe(true);
  });

  it("menolak respons kosong", () => {
    expect(analisisSchema.safeParse({}).success).toBe(false);
  });

  it("menolak kalau petaKompetensi bukan array atau kosong", () => {
    expect(analisisSchema.safeParse({ ...valid, petaKompetensi: [] }).success).toBe(false);
    expect(analisisSchema.safeParse({ ...valid, petaKompetensi: "bukan array" }).success).toBe(false);
  });

  it("menolak rekomendasi lebih dari 5 atau kosong", () => {
    expect(analisisSchema.safeParse({ ...valid, rekomendasi: [] }).success).toBe(false);
    expect(
      analisisSchema.safeParse({ ...valid, rekomendasi: ["a", "b", "c", "d", "e", "f"] }).success,
    ).toBe(false);
  });
});
