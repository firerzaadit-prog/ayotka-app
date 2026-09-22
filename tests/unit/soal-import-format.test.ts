import { describe, expect, it } from "vitest";
import {
  translateBentukSoal,
  translateJenjang,
  translateLevelKognitif,
  translateStimulusTipe,
  translateTingkatKesulitan,
} from "@/lib/soal-import/format-translator";

describe("translateBentukSoal", () => {
  it("memetakan tiga bentuk soal soal.ayotka.id ke format ayotka-app", () => {
    expect(translateBentukSoal("PG")).toBe("pg");
    expect(translateBentukSoal("PGK_MCMA")).toBe("pg_kompleks");
    expect(translateBentukSoal("PGK_KATEGORI")).toBe("pg_kategori");
  });

  it("melempar error untuk nilai yang tidak dikenal", () => {
    expect(() => translateBentukSoal("ESSAY")).toThrow(/tidak dikenal/);
  });
});

describe("translateTingkatKesulitan", () => {
  it("memetakan rendah/sedang/tinggi ke mudah/sedang/sulit", () => {
    expect(translateTingkatKesulitan("rendah")).toBe("mudah");
    expect(translateTingkatKesulitan("sedang")).toBe("sedang");
    expect(translateTingkatKesulitan("tinggi")).toBe("sulit");
  });

  it("melempar error untuk nilai yang tidak dikenal", () => {
    expect(() => translateTingkatKesulitan("mudah")).toThrow(/tidak dikenal/);
  });
});

describe("translateJenjang", () => {
  it("memetakan varian SD & SMP soal.ayotka.id ke Jenjang ayotka-app", () => {
    expect(translateJenjang("SD/MI")).toBe("SD");
    expect(translateJenjang("SD")).toBe("SD");
    expect(translateJenjang("SMP/MTs")).toBe("SMP");
    expect(translateJenjang("SMP")).toBe("SMP");
  });

  it("melempar error untuk jenjang di luar cakupan TKA (SMA/SMK)", () => {
    expect(() => translateJenjang("SMA/MA")).toThrow(/tidak didukung/);
    expect(() => translateJenjang("SMK/MAK")).toThrow(/tidak didukung/);
  });
});

describe("translateStimulusTipe", () => {
  it("meloloskan teks & data apa adanya", () => {
    expect(translateStimulusTipe("teks")).toBe("teks");
    expect(translateStimulusTipe("data")).toBe("data");
  });

  it("melempar error untuk nilai yang tidak dikenal", () => {
    expect(() => translateStimulusTipe("gambar")).toThrow(/tidak dikenal/);
  });
});

describe("translateLevelKognitif", () => {
  it("mengembalikan null untuk input null", () => {
    expect(translateLevelKognitif(null)).toBeNull();
  });

  it("mengenali tiga label kognitif standar, dengan atau tanpa prefix angka", () => {
    expect(translateLevelKognitif("Pengetahuan dan Pemahaman")).toBe("L1");
    expect(translateLevelKognitif("1. Pengetahuan dan Pemahaman")).toBe("L1");
    expect(translateLevelKognitif("Aplikasi")).toBe("L2");
    expect(translateLevelKognitif("2. Aplikasi")).toBe("L2");
    expect(translateLevelKognitif("Penalaran")).toBe("L3");
    expect(translateLevelKognitif("3. Penalaran")).toBe("L3");
  });

  // Nilai-nilai ini benar-benar ada di data produksi soal.ayotka.id (dicek
  // langsung ke database) - label kompetensi atau tingkat kesulitan yang
  // nyasar ke kolom level_kognitif. Harus null (belum bisa ditentukan),
  // bukan ditebak jadi salah satu dari L1/L2/L3.
  it("mengembalikan null untuk nilai nyasar yang benar-benar ditemukan di data produksi", () => {
    expect(translateLevelKognitif("Evaluasi dan Apresiasi")).toBeNull();
    expect(translateLevelKognitif("Pemahaman Inferensial")).toBeNull();
    expect(translateLevelKognitif("Pemahaman Tekstual")).toBeNull();
    expect(translateLevelKognitif("Pemahaman")).toBeNull();
    expect(translateLevelKognitif("sedang")).toBeNull();
    expect(translateLevelKognitif("Rendah")).toBeNull();
  });
});
