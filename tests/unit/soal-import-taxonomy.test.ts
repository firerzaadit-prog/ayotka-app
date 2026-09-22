import { describe, expect, it } from "vitest";
import { getTaxonomyMatchKey } from "@/lib/soal-import/taxonomy-resolver";

describe("getTaxonomyMatchKey", () => {
  it("Bahasa Indonesia: dicocokkan lewat kompetensi, bukan elemen", () => {
    const key = getTaxonomyMatchKey("Bahasa Indonesia", {
      elemen: "Membaca dan Memirsa",
      subElemen: null,
      kompetensi: "Pemahaman Tekstual",
    });
    expect(key).toBe("Pemahaman Tekstual");
  });

  it("Bahasa Indonesia: null kalau kompetensi belum terisi di sumber", () => {
    const key = getTaxonomyMatchKey("Bahasa Indonesia", {
      elemen: "Membaca dan Memirsa",
      subElemen: null,
      kompetensi: null,
    });
    expect(key).toBeNull();
  });

  it("mapel selain Bahasa Indonesia (mis. Matematika): dicocokkan lewat elemen", () => {
    const key = getTaxonomyMatchKey("Matematika", {
      elemen: "Geometri dan Pengukuran",
      subElemen: null,
      kompetensi: null,
    });
    expect(key).toBe("Geometri dan Pengukuran");
  });
});
