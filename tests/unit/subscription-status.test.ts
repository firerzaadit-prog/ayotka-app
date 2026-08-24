import { describe, expect, it, vi } from "vitest";

// lib/billing/subscription-status.ts sengaja pakai "server-only" - itu murni
// guard build-time Next.js, tidak relevan di runner Node vitest (lihat pola
// yang sama di tests/unit/gemini-retry.test.ts).
vi.mock("server-only", () => ({}));

const { effectiveSubscriptionStatus, hasFullAccess } = await import(
  "@/lib/billing/subscription-status"
);

const DAY_MS = 24 * 60 * 60 * 1000;

describe("effectiveSubscriptionStatus (Tiket 6.5/6.6, Bagian 7.1 brief: masa tenggang 3 hari)", () => {
  it("status batal selalu efektif batal, walau berakhir_at masih jauh di masa depan", () => {
    const status = effectiveSubscriptionStatus({
      status: "batal",
      berakhirAt: new Date(Date.now() + 30 * DAY_MS),
    });
    expect(status).toBe("batal");
  });

  it("aktif selama belum lewat berakhir_at", () => {
    const status = effectiveSubscriptionStatus({
      status: "aktif",
      berakhirAt: new Date(Date.now() + DAY_MS),
    });
    expect(status).toBe("aktif");
  });

  it("masuk masa tenggang begitu berakhir_at baru saja lewat", () => {
    const status = effectiveSubscriptionStatus({
      status: "aktif",
      berakhirAt: new Date(Date.now() - 1000),
    });
    expect(status).toBe("tenggang");
  });

  it("masih tenggang di hari ke-3 setelah kedaluwarsa (belum genap 3 hari)", () => {
    const status = effectiveSubscriptionStatus({
      status: "aktif",
      berakhirAt: new Date(Date.now() - 3 * DAY_MS + 60_000),
    });
    expect(status).toBe("tenggang");
  });

  it("jadi kedaluwarsa (mode terbatas) setelah masa tenggang 3 hari lewat - status DB belum sempat diupdate cron", () => {
    const status = effectiveSubscriptionStatus({
      status: "aktif",
      berakhirAt: new Date(Date.now() - 3 * DAY_MS - 60_000),
    });
    expect(status).toBe("kedaluwarsa");
  });

  it("hasFullAccess: true untuk aktif & tenggang, false untuk kedaluwarsa & batal", () => {
    expect(hasFullAccess("aktif")).toBe(true);
    expect(hasFullAccess("tenggang")).toBe(true);
    expect(hasFullAccess("kedaluwarsa")).toBe(false);
    expect(hasFullAccess("batal")).toBe(false);
  });
});
