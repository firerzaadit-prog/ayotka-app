import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  loadOwnedAttempt: vi.fn(),
  checkRateLimit: vi.fn(),
  hitungOpsi: vi.fn(),
  tryStartProcessing: vi.fn(),
  prosesSatuAnalisis: vi.fn(),
  logAudit: vi.fn(),
  updateMany: vi.fn(),
  sesudahRespons: [] as Array<() => Promise<void>>,
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => Promise<void>) => {
    m.sesudahRespons.push(fn);
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { attempt: { updateMany: m.updateMany } } }));
vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/exam/attempt-access", () => ({ loadOwnedAttempt: m.loadOwnedAttempt }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.checkRateLimit }));
vi.mock("@/lib/billing/la-susulan", () => ({ hitungOpsiLaSusulan: m.hitungOpsi }));
vi.mock("@/lib/ai/analysis-guard", () => ({ tryStartProcessing: m.tryStartProcessing }));
vi.mock("@/lib/ai/queue-worker", () => ({ prosesSatuAnalisis: m.prosesSatuAnalisis }));

import { GET, POST } from "@/app/api/siswa/attempts/[id]/learning-analytics/route";

const ATTEMPT = { id: "att-1", studentId: "siswa-1", status: "selesai" };
const params = { params: Promise.resolve({ id: "att-1" }) };
const req = () => new Request("https://ayotka.id/api/siswa/attempts/att-1/learning-analytics", { method: "POST" });

const SALDO_CUKUP = { tersedia: true, pendanaan: "saldo", harga: 9000, saldo: 20000, cukup: true, kurang: 0 };
const SALDO_KURANG = { tersedia: true, pendanaan: "saldo", harga: 9000, saldo: 4000, cukup: false, kurang: 5000 };
const KUOTA_OK = { tersedia: true, pendanaan: "kuota", kuotaSisa: 1, batasTercapai: false, batasMaks: 3 };

beforeEach(() => {
  vi.resetAllMocks();
  m.sesudahRespons.length = 0;
  m.requireRole.mockResolvedValue({ id: "user-1", role: "siswa" });
  m.loadOwnedAttempt.mockResolvedValue(ATTEMPT);
  m.checkRateLimit.mockReturnValue(true);
  m.hitungOpsi.mockResolvedValue(SALDO_CUKUP);
  m.tryStartProcessing.mockResolvedValue(true);
  m.prosesSatuAnalisis.mockResolvedValue("selesai");
  m.updateMany.mockResolvedValue({ count: 1 });
});

describe("GET opsi Learning Analytics susulan", () => {
  it("bukan siswa -> 403", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await GET(req(), params)).status).toBe(403);
  });

  it("percobaan milik siswa lain / tidak ada -> 404, opsi tidak dihitung", async () => {
    m.loadOwnedAttempt.mockResolvedValue(null);
    expect((await GET(req(), params)).status).toBe(404);
    expect(m.hitungOpsi).not.toHaveBeenCalled();
  });

  it("mengembalikan opsi dengan Cache-Control no-store", async () => {
    const res = await GET(req(), params);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.json()).opsi).toEqual(SALDO_CUKUP);
  });
});

describe("POST Learning Analytics susulan - penolakan", () => {
  it("bukan siswa -> 403 dan tidak ada yang ditulis", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await POST(req(), params)).status).toBe(403);
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("percobaan bukan milik siswa ini -> 404", async () => {
    m.loadOwnedAttempt.mockResolvedValue(null);
    expect((await POST(req(), params)).status).toBe(404);
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.tryStartProcessing).not.toHaveBeenCalled();
  });

  it("terlalu sering -> 429 sebelum menghitung apa pun", async () => {
    m.checkRateLimit.mockReturnValue(false);
    expect((await POST(req(), params)).status).toBe(429);
    expect(m.hitungOpsi).not.toHaveBeenCalled();
  });

  it("batas dibatasi per percobaan", async () => {
    await POST(req(), params);
    expect(m.checkRateLimit).toHaveBeenCalledWith("la-susulan:att-1", 5, 60_000);
  });

  it("ujian belum selesai -> 409 BELUM_SELESAI", async () => {
    m.hitungOpsi.mockResolvedValue({ tersedia: false, alasan: "belum_selesai" });
    const res = await POST(req(), params);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("BELUM_SELESAI");
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("Try Out Nasional -> 409 NASIONAL", async () => {
    m.hitungOpsi.mockResolvedValue({ tersedia: false, alasan: "nasional" });
    const res = await POST(req(), params);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("NASIONAL");
  });

  it("saldo kurang -> 402 dengan harga, saldo, kurang; TIDAK menandai, mengklaim, atau memproses apa pun", async () => {
    m.hitungOpsi.mockResolvedValue(SALDO_KURANG);
    const res = await POST(req(), params);
    const body = await res.json();
    expect(res.status).toBe(402);
    expect(body).toMatchObject({ code: "SALDO_TIDAK_CUKUP", harga: 9000, saldo: 4000, kurang: 5000 });
    expect(body.error).toMatch(/Rp\s*4\.000/);
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.tryStartProcessing).not.toHaveBeenCalled();
    expect(m.sesudahRespons).toHaveLength(0);
  });

  it("batas jatah tercapai -> 409 BATAS_TERCAPAI tanpa memproses", async () => {
    m.hitungOpsi.mockResolvedValue({ ...KUOTA_OK, batasTercapai: true });
    const res = await POST(req(), params);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("BATAS_TERCAPAI");
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.sesudahRespons).toHaveLength(0);
  });
});

describe("POST Learning Analytics susulan - idempoten", () => {
  it("analisis sudah ada -> 200 ready, tidak memproses ulang dan tidak memotong apa pun", async () => {
    m.hitungOpsi.mockResolvedValue({ tersedia: false, alasan: "sudah_ada" });
    const res = await POST(req(), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ready" });
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.sesudahRespons).toHaveLength(0);
  });

  it("sedang diproses (klik ganda / tab kedua) -> 200 processing tanpa memproses lagi", async () => {
    m.hitungOpsi.mockResolvedValue({ tersedia: false, alasan: "sedang_diproses" });
    const res = await POST(req(), params);
    expect(await res.json()).toEqual({ status: "processing" });
    expect(m.sesudahRespons).toHaveLength(0);
  });

  it("dua permintaan serentak: yang kalah klaim tidak memproses (satu pemrosesan per percobaan)", async () => {
    m.tryStartProcessing.mockResolvedValue(false);
    const res = await POST(req(), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "processing" });
    expect(m.sesudahRespons).toHaveLength(0);
  });
});

describe("POST Learning Analytics susulan - berhasil dimulai", () => {
  it.each([
    ["saldo cukup", SALDO_CUKUP],
    ["jatah paket tersedia", KUOTA_OK],
  ])("%s: menandai, mengklaim, lalu memproses SETELAH respons", async (_nama, opsi) => {
    m.hitungOpsi.mockResolvedValue(opsi);
    const res = await POST(req(), params);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "processing" });
    // ditandai memakai Learning Analytics, hanya bila masih false (aman dari klik ganda)
    expect(m.updateMany).toHaveBeenCalledWith({ where: { id: "att-1", analisisAiDiminta: false }, data: { analisisAiDiminta: true } });
    expect(m.tryStartProcessing).toHaveBeenCalledWith("att-1");
    // urutan: tandai dulu, baru klaim
    expect(m.updateMany.mock.invocationCallOrder[0]).toBeLessThan(m.tryStartProcessing.mock.invocationCallOrder[0]!);
    // pemrosesan (yang mendebit saldo) dijadwalkan sesudah respons, belum dijalankan di dalam permintaan
    expect(m.prosesSatuAnalisis).not.toHaveBeenCalled();
    expect(m.sesudahRespons).toHaveLength(1);
    await m.sesudahRespons[0]!();
    expect(m.prosesSatuAnalisis).toHaveBeenCalledWith("att-1");
  });

  it("saldo TIDAK didebit di rute ini (pendebitan hanya di pemroses)", async () => {
    // rute ini bahkan tidak mengimpor modul saldo; yang diuji: tidak ada tulis apa pun selain penanda
    await POST(req(), params);
    expect(m.updateMany).toHaveBeenCalledTimes(1);
  });

  it("mencatat jejak audit tanpa menyertakan angka saldo", async () => {
    await POST(req(), params);
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", entitas: "attempts", entitasId: "att-1", after: { learningAnalyticsSusulan: true, pendanaan: "saldo" } }),
    );
  });
});
