import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  logAudit: vi.fn(),
  rate: vi.fn(),
  sinkron: vi.fn(),
  getGambarPaket: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { penanda: "prisma-tiruan" } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rate }));
vi.mock("@/lib/soal-import/sinkron-media", () => ({ sinkronkanMediaSoal: m.sinkron }));
vi.mock("@/lib/soal-import/source-db", () => ({ getGambarPaket: m.getGambarPaket }));

import { POST } from "@/app/api/admin-pusat/soal-import/sinkron-media/route";

const LAPORAN = (jalankan: boolean) => ({
  jalankan,
  paket: [],
  total: { paket: 2, soal: 60, diperbarui: 4, sudahGanda: 1, sumberSatuGambar: 3, perluDicek: 0 },
});
const minta = (isi?: unknown) =>
  POST(
    new Request("https://ayotka.id/api/admin-pusat/soal-import/sinkron-media", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: isi === undefined ? undefined : typeof isi === "string" ? isi : JSON.stringify(isi),
    }),
  );

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "admin-1", role: "admin_pusat" });
  m.rate.mockReturnValue(true);
  m.sinkron.mockImplementation(async (_db: unknown, _ambil: unknown, opsi: { jalankan: boolean }) => LAPORAN(opsi.jalankan));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/admin-pusat/soal-import/sinkron-media", () => {
  it("hanya admin pusat: selain itu 403 dan tidak ada yang dibaca atau ditulis", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await minta({ jalankan: true });
    expect(res.status).toBe(403);
    expect(m.requireRole).toHaveBeenCalledWith("admin_pusat");
    expect(m.sinkron).not.toHaveBeenCalled();
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("dibatasi lajunya per pengguna -> 429", async () => {
    m.rate.mockReturnValue(false);
    const res = await minta({ jalankan: true });
    expect(res.status).toBe(429);
    expect(m.rate.mock.calls[0]![0]).toBe("soal-sinkron-media:admin-1");
    expect(m.sinkron).not.toHaveBeenCalled();
  });

  it("tanpa tubuh / tubuh rusak / jalankan bukan boolean true = SIMULASI saja, tanpa catatan audit", async () => {
    for (const isi of [undefined, "bukan json", {}, { jalankan: false }, { jalankan: "true" }, { jalankan: 1 }, null]) {
      m.sinkron.mockClear();
      m.logAudit.mockClear();
      const res = await minta(isi);
      expect(res.status, JSON.stringify(isi)).toBe(200);
      expect(m.sinkron.mock.calls[0]![2], JSON.stringify(isi)).toEqual({ jalankan: false });
      expect((await res.json()).laporan.jalankan).toBe(false);
      expect(m.logAudit).not.toHaveBeenCalled();
    }
  });

  it("jalankan: true = menulis, dengan prisma dan pembaca sumber yang benar, dan dicatat di audit log", async () => {
    const res = await minta({ jalankan: true });
    expect(res.status).toBe(200);
    expect((await res.json()).laporan).toEqual(LAPORAN(true));
    const [db, ambil, opsi] = m.sinkron.mock.calls[0]!;
    expect(db).toEqual({ penanda: "prisma-tiruan" });
    expect(ambil).toBe(m.getGambarPaket);
    expect(opsi).toEqual({ jalankan: true });
    expect(m.logAudit).toHaveBeenCalledTimes(1);
    expect(m.logAudit).toHaveBeenCalledWith({
      userId: "admin-1",
      aksi: "update",
      entitas: "questions",
      entitasId: "sinkron-media",
      after: LAPORAN(true).total,
      ip: "1.2.3.4",
    });
  });

  it("galat saat memproses: 500 dengan pesan umum (tanpa detail teknis), dan TIDAK ada catatan audit", async () => {
    m.sinkron.mockRejectedValue(new Error("password authentication failed for user ayotka_app_reader"));
    const res = await minta({ jalankan: true });
    expect(res.status).toBe(500);
    const badan = await res.json();
    expect(badan).toEqual({ error: "Gagal memeriksa gambar soal. Coba lagi sebentar lagi." });
    expect(JSON.stringify(badan)).not.toContain("password");
    expect(m.logAudit).not.toHaveBeenCalled();
  });
});
