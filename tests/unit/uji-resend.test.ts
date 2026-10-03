import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  resolveResend: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/settings/app-settings", () => ({
  getResolvedAiConfig: vi.fn(),
  getResolvedMidtransConfig: vi.fn(),
  getResolvedResendConfig: m.resolveResend,
  getResolvedMailketingConfig: vi.fn(),
}));
vi.mock("@google/genai", () => ({ GoogleGenAI: class {} }));

import { tafsirkanHasilUjiResend } from "@/lib/email/uji-resend";
import { POST } from "@/app/api/admin-pusat/pengaturan/test/route";

const RESTRICTED = '{"statusCode":401,"message":"This API key is restricted to only send emails","name":"restricted_api_key"}';

describe("tafsirkanHasilUjiResend", () => {
  it("401 restricted_api_key = kunci dikenali (hanya boleh kirim email): dianggap berhasil", () => {
    const hasil = tafsirkanHasilUjiResend(401, RESTRICTED);
    expect(hasil.ok).toBe(true);
    if (hasil.ok) {
      expect(hasil.message).toMatch(/hanya berizin mengirim email/);
      expect(hasil.message).toMatch(/Lupa Password/);
    }
  });

  it.each([
    ["kunci salah (galat validasi)", 401, '{"statusCode":401,"message":"API key is invalid","name":"validation_error"}'],
    ["kunci tidak ada", 400, '{"name":"missing_api_key"}'],
    ["nama restricted tetapi status bukan 401", 403, RESTRICTED],
    ["badan bukan JSON", 401, "<html>Unauthorized</html>"],
    ["badan kosong", 401, ""],
    ["JSON tanpa nama", 401, "{}"],
    ["JSON null", 401, "null"],
    ["gangguan server", 500, '{"name":"internal_server_error"}'],
  ])("%s tetap dianggap gagal", (_nama, status, badan) => {
    expect(tafsirkanHasilUjiResend(status, badan)).toEqual({ ok: false });
  });
});

describe("POST /api/admin-pusat/pengaturan/test (target resend)", () => {
  const post = (body: unknown) =>
    POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) }) as never);
  const jawab = (status: number, badan: string) =>
    vi.fn(async () => new Response(badan, { status, statusText: "Ditolak" }));

  beforeEach(() => {
    vi.resetAllMocks();
    m.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
    m.resolveResend.mockResolvedValue({ apiKey: "re_dari_pengaturan", fromEmail: "x", source: "env" });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("kunci hanya-kirim-email: berhasil (ok true) dengan penjelasan, bukan galat", async () => {
    vi.stubGlobal("fetch", jawab(401, RESTRICTED));
    const res = await post({ target: "resend", apiKey: "re_kunci_terbatas" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.message).toMatch(/akses terbatas/);
  });

  it("kunci akses penuh: tetap berhasil seperti sebelumnya", async () => {
    vi.stubGlobal("fetch", jawab(200, '{"data":[]}'));
    const json = await (await post({ target: "resend", apiKey: "re_penuh" })).json();
    expect(json).toMatchObject({ ok: true, message: expect.stringMatching(/Berhasil/) });
  });

  it("kunci yang benar-benar salah: tetap gagal (400) dengan pesan dari Resend", async () => {
    vi.stubGlobal("fetch", jawab(401, '{"statusCode":401,"message":"API key is invalid","name":"validation_error"}'));
    const res = await post({ target: "resend", apiKey: "re_salah" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/status 401.*API key is invalid/);
  });

  it("tanpa kunci di isian maupun pengaturan: 400, dan tidak memanggil Resend", async () => {
    m.resolveResend.mockResolvedValue({ apiKey: "", fromEmail: "x", source: "none" });
    const fetchTiruan = jawab(200, "{}");
    vi.stubGlobal("fetch", fetchTiruan);
    const res = await post({ target: "resend", apiKey: "" });
    expect(res.status).toBe(400);
    expect(fetchTiruan).not.toHaveBeenCalled();
  });

  it("memakai kunci dari pengaturan bila isian berupa topeng (kunci tersimpan)", async () => {
    const fetchTiruan = jawab(200, "{}");
    vi.stubGlobal("fetch", fetchTiruan);
    await post({ target: "resend", apiKey: "••••••••••" });
    expect((fetchTiruan.mock.calls[0] as unknown as [string, { headers: { Authorization: string } }])[1].headers.Authorization).toBe(
      "Bearer re_dari_pengaturan",
    );
  });

  it("403 kalau bukan admin pusat", async () => {
    m.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await post({ target: "resend" })).status).toBe(403);
  });
});
