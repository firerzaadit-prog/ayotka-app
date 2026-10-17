import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ requireRole: vi.fn(), resolved: vi.fn(), kirimLewatSmtp: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/settings/app-settings", () => ({
  getResolvedAiConfig: vi.fn(),
  getResolvedMidtransConfig: vi.fn(),
  getResolvedResendConfig: vi.fn(),
  getResolvedMailketingConfig: vi.fn(),
  getResolvedSmtpConfig: m.resolved,
}));
vi.mock("@/lib/email/mailer", () => ({ kirimLewatSmtp: m.kirimLewatSmtp }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class {} }));

import { POST } from "@/app/api/admin-pusat/pengaturan/test/route";

const kirim = (body: unknown) =>
  POST(new Request("http://localhost/api/admin-pusat/pengaturan/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) as never);
const isi = async (res: Response) => (await res.json()) as { ok: boolean; message?: string; error?: string };

const TERSIMPAN = { host: "smtp.gmail.com", port: 465, user: "tim@gmail.com", pass: "sandi-tersimpan", source: "database" as const };

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "pusat-1", email: "owner@ayotka.id", role: "admin_pusat" });
  m.resolved.mockResolvedValue(TERSIMPAN);
  m.kirimLewatSmtp.mockResolvedValue({ ok: true });
});

describe("POST /api/admin-pusat/pengaturan/test (target smtp)", () => {
  it("bukan admin pusat: 403 dan tidak ada email", async () => {
    m.requireRole.mockRejectedValue(new Error("x"));
    expect((await kirim({ target: "smtp" })).status).toBe(403);
    expect(m.kirimLewatSmtp).not.toHaveBeenCalled();
  });

  it("memakai isian di layar (yang belum disimpan); email uji dikirim ke alamat admin pusat yang login", async () => {
    const res = await kirim({ target: "smtp", smtpHost: "smtp.contoh.id", smtpPort: 587, smtpUser: "a@contoh.id", smtpPass: "sandi-baru" });
    const badan = await isi(res);
    expect(res.status).toBe(200);
    expect(badan.ok).toBe(true);
    expect(badan.message).toContain("owner@ayotka.id");
    expect(badan.message).toContain("smtp.contoh.id:587");
    expect(m.kirimLewatSmtp).toHaveBeenCalledWith(expect.objectContaining({ to: "owner@ayotka.id", subject: "Uji email AyoTKA" }), {
      host: "smtp.contoh.id",
      port: 587,
      user: "a@contoh.id",
      pass: "sandi-baru",
    });
  });

  it("kata sandi kosong atau tersamarkan di layar: dipakai kata sandi tersimpan (bukan teks samaran)", async () => {
    for (const pass of ["", "••••••••", "abcd••••wxyz"]) {
      m.kirimLewatSmtp.mockClear();
      await kirim({ target: "smtp", smtpHost: "smtp.gmail.com", smtpPort: 465, smtpUser: "tim@gmail.com", smtpPass: pass });
      expect(m.kirimLewatSmtp.mock.calls[0]![1], JSON.stringify(pass)).toMatchObject({ pass: "sandi-tersimpan" });
    }
  });

  it("kolom kosong semuanya: memakai pengaturan tersimpan; `to` yang sah dipakai, yang tidak sah diabaikan", async () => {
    await kirim({ target: "smtp", to: "lain@contoh.id" });
    expect(m.kirimLewatSmtp.mock.calls[0]![0]).toMatchObject({ to: "lain@contoh.id" });
    expect(m.kirimLewatSmtp.mock.calls[0]![1]).toEqual({ host: "smtp.gmail.com", port: 465, user: "tim@gmail.com", pass: "sandi-tersimpan" });
    await kirim({ target: "smtp", to: "bukan email" });
    expect(m.kirimLewatSmtp.mock.calls[1]![0]).toMatchObject({ to: "owner@ayotka.id" });
  });

  it("isian belum lengkap dan tidak ada pengaturan tersimpan: 400 dengan petunjuk Gmail, tanpa mengirim", async () => {
    m.resolved.mockResolvedValue({ host: "", port: 587, user: "", pass: "", source: "none" });
    const res = await kirim({ target: "smtp", smtpHost: "smtp.gmail.com" });
    expect(res.status).toBe(400);
    expect((await isi(res)).error).toContain("App Password");
    expect(m.kirimLewatSmtp).not.toHaveBeenCalled();
  });

  it("server SMTP menolak: 400 membawa penjelasan Indonesia dari mailer", async () => {
    m.kirimLewatSmtp.mockResolvedValue({ ok: false, kode: "login_ditolak", error: "Login SMTP ditolak. Untuk Gmail: pakai App Password." });
    const res = await kirim({ target: "smtp" });
    expect(res.status).toBe(400);
    expect(await isi(res)).toMatchObject({ ok: false, error: "Login SMTP ditolak. Untuk Gmail: pakai App Password." });
  });
});
