import { describe, expect, it } from "vitest";
import { labelFormatSoal } from "@/lib/exam/label-format";

describe("labelFormatSoal (label format soal untuk siswa)", () => {
  it("memakai istilah Indonesia yang sama dengan panduan impor Excel", () => {
    expect(labelFormatSoal("pg")).toBe("Pilihan Ganda");
    expect(labelFormatSoal("pg_kompleks")).toBe("Pilihan Ganda Kompleks");
    expect(labelFormatSoal("pg_kategori")).toBe("Pilihan Ganda Kategori");
  });

  it("kode internal tidak pernah bocor ke siswa, termasuk untuk format yang tidak dikenal", () => {
    for (const f of ["pg", "pg_kompleks", "pg_kategori", "format_baru", ""]) {
      expect(labelFormatSoal(f), f).not.toMatch(/PGK|MCMA|KATEGORI|_/);
    }
    expect(labelFormatSoal("format_baru")).toBe("Soal");
  });
});
