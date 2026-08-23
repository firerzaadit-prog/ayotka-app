import { describe, expect, it } from "vitest";
import { validateBlueprintCompliance, formatBlueprintGapMessage } from "@/lib/blueprint/validate";

const KOMPETENSI_X = "kompetensi-x";
const KOMPETENSI_Y = "kompetensi-y";

describe("validateBlueprintCompliance (Tiket 2.7)", () => {
  it("compliant kalau jumlah soal per kompetensi/kesulitan/format sudah cukup", () => {
    const requirements = [
      { kompetensiId: KOMPETENSI_X, kompetensiKode: "X", tingkatKesulitan: "mudah", formatSoal: "pg", jumlahSoal: 2 },
    ];
    const questions = [
      { kompetensiId: KOMPETENSI_X, tingkatKesulitan: "mudah", format: "pg" },
      { kompetensiId: KOMPETENSI_X, tingkatKesulitan: "mudah", format: "pg" },
    ];

    const result = validateBlueprintCompliance(requirements, questions);
    expect(result.compliant).toBe(true);
    expect(result.gaps).toHaveLength(0);
  });

  it("melaporkan selisih persis saat soal kurang", () => {
    const requirements = [
      { kompetensiId: KOMPETENSI_Y, kompetensiKode: "Y", tingkatKesulitan: "sulit", formatSoal: "pg", jumlahSoal: 3 },
    ];
    const questions = [{ kompetensiId: KOMPETENSI_Y, tingkatKesulitan: "sulit", format: "pg" }];

    const result = validateBlueprintCompliance(requirements, questions);
    expect(result.compliant).toBe(false);
    expect(result.gaps).toEqual([
      {
        kompetensiKode: "Y",
        tingkatKesulitan: "sulit",
        formatSoal: "pg",
        dibutuhkan: 3,
        tersedia: 1,
        selisih: 2,
      },
    ]);
    expect(formatBlueprintGapMessage(result.gaps)).toBe(
      "kurang 2 soal sulit pada kompetensi Y (format pg)",
    );
  });

  it("tidak menghitung soal kompetensi/kesulitan/format lain yang tidak cocok", () => {
    const requirements = [
      { kompetensiId: KOMPETENSI_X, kompetensiKode: "X", tingkatKesulitan: "mudah", formatSoal: "pg", jumlahSoal: 1 },
    ];
    const questions = [
      { kompetensiId: KOMPETENSI_X, tingkatKesulitan: "sedang", format: "pg" },
      { kompetensiId: KOMPETENSI_Y, tingkatKesulitan: "mudah", format: "pg" },
      { kompetensiId: KOMPETENSI_X, tingkatKesulitan: "mudah", format: "pg_kompleks" },
    ];

    const result = validateBlueprintCompliance(requirements, questions);
    expect(result.compliant).toBe(false);
    expect(result.gaps[0]?.tersedia).toBe(0);
  });
});
