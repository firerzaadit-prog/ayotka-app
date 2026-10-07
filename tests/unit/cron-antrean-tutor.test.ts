import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  processAiQueue: vi.fn(),
  tutupPercobaanKedaluwarsa: vi.fn(),
  bersihkanRiwayatKedaluwarsa: vi.fn(),
}));

vi.mock("@/lib/ai/queue-worker", () => ({ processAiQueue: m.processAiQueue }));
vi.mock("@/lib/exam/tutup-kedaluwarsa", () => ({ tutupPercobaanKedaluwarsa: m.tutupPercobaanKedaluwarsa }));
vi.mock("@/lib/tutor/penyimpanan", () => ({ bersihkanRiwayatKedaluwarsa: m.bersihkanRiwayatKedaluwarsa }));

import { GET } from "@/app/api/cron/proses-antrean-ai/route";

const req = (auth?: string) =>
  new Request("https://ayotka.id/api/cron/proses-antrean-ai", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  vi.resetAllMocks();
  process.env.CRON_SECRET = "rahasia-cron";
  m.processAiQueue.mockResolvedValue({ diklaim: 1, selesai: 1, gagal: 0, dilewati: 0 });
  m.tutupPercobaanKedaluwarsa.mockResolvedValue({ diperiksa: 0, ditutup: [], gagal: [] });
  m.bersihkanRiwayatKedaluwarsa.mockResolvedValue(3);
});

describe("cron antrean AI - pembersihan riwayat Tutor 7 hari", () => {
  it("tanpa atau dengan rahasia salah -> 401 dan tidak ada yang dijalankan (termasuk penghapusan)", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer salah"))).status).toBe(401);
    expect(m.bersihkanRiwayatKedaluwarsa).not.toHaveBeenCalled();
    expect(m.processAiQueue).not.toHaveBeenCalled();
  });

  it("tanpa CRON_SECRET di server -> 401 (tidak pernah terbuka untuk umum)", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req("Bearer undefined"))).status).toBe(401);
    expect(m.bersihkanRiwayatKedaluwarsa).not.toHaveBeenCalled();
  });

  it("sah: menghapus riwayat kedaluwarsa, melaporkan jumlahnya, dan antrean AI tetap diproses", async () => {
    const res = await GET(req("Bearer rahasia-cron"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(m.bersihkanRiwayatKedaluwarsa).toHaveBeenCalledTimes(1);
    expect(body.riwayatTutorDihapus).toBe(3);
    expect(body.selesai).toBe(1);
    expect(m.processAiQueue).toHaveBeenCalledTimes(1);
  });

  it("pembersihan gagal tidak menghalangi antrean AI: tetap 200, jumlah 0", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.bersihkanRiwayatKedaluwarsa.mockRejectedValue(new Error("db sesaat bermasalah"));
    const res = await GET(req("Bearer rahasia-cron"));
    expect(res.status).toBe(200);
    expect((await res.json()).riwayatTutorDihapus).toBe(0);
    expect(m.processAiQueue).toHaveBeenCalledTimes(1);
  });

  it("penyapuan percobaan kedaluwarsa gagal tidak menghalangi pembersihan riwayat", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.tutupPercobaanKedaluwarsa.mockRejectedValue(new Error("gagal"));
    await GET(req("Bearer rahasia-cron"));
    expect(m.bersihkanRiwayatKedaluwarsa).toHaveBeenCalledTimes(1);
  });
});
