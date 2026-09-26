import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/utils/safe-next";
import { escapeHtml } from "@/lib/utils/escape-html";
import { jawabanCocokDenganSoal } from "@/lib/exam/jawaban-cocok";

describe("safeNext - tujuan redirect hanya path internal", () => {
  it("meneruskan path internal", () => {
    expect(safeNext("/siswa/dashboard")).toBe("/siswa/dashboard");
    expect(safeNext("/reset-password?x=1")).toBe("/reset-password?x=1");
  });

  it("menolak alamat situs lain dan skrip", () => {
    for (const jahat of [
      "https://situs-palsu.com",
      "//situs-palsu.com",
      "/\\situs-palsu.com",
      "javascript:alert(1)",
      "/\t/situs-palsu.com",
      "/\n/situs-palsu.com",
      "situs-palsu.com",
    ]) {
      expect(safeNext(jahat)).toBe("/");
    }
  });

  it("memakai fallback kalau kosong atau ditolak", () => {
    expect(safeNext(null, "/login")).toBe("/login");
    expect(safeNext("", "/login")).toBe("/login");
    expect(safeNext("//x", "/login")).toBe("/login");
  });
});

describe("escapeHtml", () => {
  it("menetralkan tag dan kutip dari nama pengguna", () => {
    expect(escapeHtml(`<a href="x">Budi</a> & 'Ani'`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Budi&lt;/a&gt; &amp; &#39;Ani&#39;",
    );
  });
});

describe("jawabanCocokDenganSoal", () => {
  const pg = { format: "pg", options: [{ id: "a" }, { id: "b" }], statements: [], categories: [] };
  const kompleks = { ...pg, format: "pg_kompleks" };
  const kategori = {
    format: "pg_kategori",
    options: [],
    statements: [{ id: "s1" }, { id: "s2" }],
    categories: [{ id: "benar" }, { id: "salah" }],
  };

  it("menerima jawaban yang valid", () => {
    expect(jawabanCocokDenganSoal({ option_id: "a" }, pg)).toBe(true);
    expect(jawabanCocokDenganSoal({ option_ids: ["a", "b"] }, kompleks)).toBe(true);
    expect(jawabanCocokDenganSoal({ option_ids: [] }, kompleks)).toBe(true);
    expect(jawabanCocokDenganSoal({ s1: "benar", s2: "salah" }, kategori)).toBe(true);
  });

  it("menerima objek kosong untuk semua format (ragu-ragu sebelum menjawab)", () => {
    expect(jawabanCocokDenganSoal({}, pg)).toBe(true);
    expect(jawabanCocokDenganSoal({}, kompleks)).toBe(true);
    expect(jawabanCocokDenganSoal({}, kategori)).toBe(true);
  });

  it("menolak ID dari soal lain atau ID palsu", () => {
    expect(jawabanCocokDenganSoal({ option_id: "x" }, pg)).toBe(false);
    expect(jawabanCocokDenganSoal({ option_ids: ["a", "x"] }, kompleks)).toBe(false);
    expect(jawabanCocokDenganSoal({ s1: "palsu" }, kategori)).toBe(false);
    expect(jawabanCocokDenganSoal({ palsu: "benar" }, kategori)).toBe(false);
  });

  it("menolak bentuk jawaban yang tidak sesuai format", () => {
    expect(jawabanCocokDenganSoal({ option_ids: ["a"] }, pg)).toBe(false);
    expect(jawabanCocokDenganSoal({ option_id: "a" }, kompleks)).toBe(false);
    expect(jawabanCocokDenganSoal({ s1: "benar" }, pg)).toBe(false);
    expect(jawabanCocokDenganSoal({ option_ids: ["a", "a"] }, kompleks)).toBe(false);
  });
});
