import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ cari: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { appSetting: { findUnique: m.cari } } }));

import {
  MAINTENANCE_CACHE_MS,
  bacaPengaturanMaintenance,
  resetCachePengaturanMaintenance,
} from "@/lib/maintenance/pengaturan";

beforeEach(() => {
  vi.resetAllMocks();
  resetCachePengaturanMaintenance();
});

describe("bacaPengaturanMaintenance (Prisma, menggantikan REST Supabase di proxy)", () => {
  it("membaca baris 'global': mode dan kunci bypass", async () => {
    m.cari.mockResolvedValue({ maintenanceMode: true, maintenanceBypassSecret: "rahasia" });
    const hasil = await bacaPengaturanMaintenance(1_000);
    expect(hasil).toEqual({ at: 1_000, mode: true, secret: "rahasia" });
    expect(m.cari).toHaveBeenCalledWith({
      where: { id: "global" },
      select: { maintenanceMode: true, maintenanceBypassSecret: true },
    });
  });

  it("baris belum ada atau kunci kosong -> mode mati dan tanpa kunci", async () => {
    m.cari.mockResolvedValueOnce(null);
    expect(await bacaPengaturanMaintenance(1_000)).toMatchObject({ mode: false, secret: null });
    resetCachePengaturanMaintenance();
    m.cari.mockResolvedValueOnce({ maintenanceMode: false, maintenanceBypassSecret: "" });
    expect(await bacaPengaturanMaintenance(2_000)).toMatchObject({ mode: false, secret: null });
  });

  it("di-cache selama jendelanya (satu query untuk banyak request), dibaca ulang sesudahnya", async () => {
    m.cari.mockResolvedValue({ maintenanceMode: false, maintenanceBypassSecret: null });
    await bacaPengaturanMaintenance(0);
    await bacaPengaturanMaintenance(MAINTENANCE_CACHE_MS - 1);
    expect(m.cari).toHaveBeenCalledTimes(1);

    m.cari.mockResolvedValue({ maintenanceMode: true, maintenanceBypassSecret: null });
    const baru = await bacaPengaturanMaintenance(MAINTENANCE_CACHE_MS);
    expect(m.cari).toHaveBeenCalledTimes(2);
    expect(baru?.mode).toBe(true);
  });

  it("query gagal sesaat: memakai nilai terakhir yang diketahui, bukan melempar galat ke request", async () => {
    m.cari.mockResolvedValueOnce({ maintenanceMode: true, maintenanceBypassSecret: "k" });
    await bacaPengaturanMaintenance(0);
    m.cari.mockRejectedValueOnce(new Error("koneksi putus"));
    const hasil = await bacaPengaturanMaintenance(MAINTENANCE_CACHE_MS + 5);
    expect(hasil).toMatchObject({ mode: true, secret: "k" });
  });

  it("query gagal dan belum pernah berhasil: null (proxy menganggap tidak sedang maintenance)", async () => {
    m.cari.mockRejectedValue(new Error("db mati"));
    await expect(bacaPengaturanMaintenance(0)).resolves.toBeNull();
  });
});
