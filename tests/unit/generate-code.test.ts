import { describe, expect, it } from "vitest";
import { generateReadableCode, generateTempPassword } from "@/lib/utils/generate-code";

describe("generateReadableCode", () => {
  it("menghasilkan kode sepanjang parameter length", () => {
    expect(generateReadableCode(6)).toHaveLength(6);
    expect(generateReadableCode(10)).toHaveLength(10);
  });

  it("tidak memakai karakter ambigu (0/O, 1/I)", () => {
    const codes = Array.from({ length: 200 }, () => generateReadableCode(8)).join("");
    expect(codes).not.toMatch(/[01OI]/);
  });
});

describe("generateTempPassword", () => {
  it("menghasilkan password minimal 16 karakter (syarat Bagian 5 brief)", () => {
    expect(generateTempPassword().length).toBeGreaterThanOrEqual(16);
  });
});
