import { describe, expect, it } from "vitest";
import { hasReachedAutoAnalysisQuota, normalisasiModeAnalisis } from "@/lib/ai/auto-trigger-quota";

describe("hasReachedAutoAnalysisQuota", () => {
  it("belum mencapai jatah kalau usedCount masih di bawah max", () => {
    expect(hasReachedAutoAnalysisQuota(0, 3)).toBe(false);
    expect(hasReachedAutoAnalysisQuota(2, 3)).toBe(false);
  });

  it("mencapai jatah begitu usedCount menyentuh max (bukan cuma melebihi)", () => {
    expect(hasReachedAutoAnalysisQuota(3, 3)).toBe(true);
  });

  it("tetap mencapai jatah kalau usedCount sudah melebihi max", () => {
    expect(hasReachedAutoAnalysisQuota(5, 3)).toBe(true);
  });

  it("max 0 berarti pemicu otomatis selalu dianggap sudah habis jatah", () => {
    expect(hasReachedAutoAnalysisQuota(0, 0)).toBe(true);
  });
});

describe("normalisasiModeAnalisis", () => {
  it("hanya string persis 'antrean' yang mengaktifkan mode antrean", () => {
    expect(normalisasiModeAnalisis("antrean")).toBe("antrean");
  });

  it("'langsung' tetap langsung", () => {
    expect(normalisasiModeAnalisis("langsung")).toBe("langsung");
  });

  it("nilai kosong, salah ketik, atau tipe lain jatuh ke 'langsung' (mode aman: tidak menggantung menunggu cron)", () => {
    expect(normalisasiModeAnalisis(undefined)).toBe("langsung");
    expect(normalisasiModeAnalisis(null)).toBe("langsung");
    expect(normalisasiModeAnalisis("")).toBe("langsung");
    expect(normalisasiModeAnalisis("Antrean")).toBe("langsung");
    expect(normalisasiModeAnalisis(true)).toBe("langsung");
  });
});
