import { describe, expect, it } from "vitest";
import { DEFAULT_FROM_ADDRESS, normalizeFromAddress, resolveFromAddress } from "@/lib/email/from-address";

describe("normalizeFromAddress", () => {
  it("membuang kutip pembungkus (penyebab error 422 Resend di produksi)", () => {
    expect(normalizeFromAddress('"AyoTKA <noreply@ayotka.id>"')).toBe("AyoTKA <noreply@ayotka.id>");
    expect(normalizeFromAddress("'noreply@ayotka.id'")).toBe("noreply@ayotka.id");
  });

  it("menerima kedua format yang diminta Resend", () => {
    expect(normalizeFromAddress("noreply@ayotka.id")).toBe("noreply@ayotka.id");
    expect(normalizeFromAddress("AyoTKA <noreply@ayotka.id>")).toBe("AyoTKA <noreply@ayotka.id>");
  });

  it("menolak bentuk yang salah", () => {
    expect(normalizeFromAddress("AyoTKA noreply@ayotka.id")).toBeNull();
    expect(normalizeFromAddress("bukan email")).toBeNull();
    expect(normalizeFromAddress("<noreply@ayotka.id>")).toBeNull();
    expect(normalizeFromAddress("")).toBeNull();
    expect(normalizeFromAddress(null)).toBeNull();
  });
});

describe("resolveFromAddress", () => {
  it("memakai kandidat valid pertama", () => {
    expect(resolveFromAddress('"rusak', "Tim <a@b.co>", "c@d.co")).toBe("Tim <a@b.co>");
  });
  it("jatuh ke bawaan bila semua kandidat rusak", () => {
    expect(resolveFromAddress("x", undefined)).toBe(DEFAULT_FROM_ADDRESS);
  });
});
