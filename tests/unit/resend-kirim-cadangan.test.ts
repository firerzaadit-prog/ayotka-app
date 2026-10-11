import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => ({
  nilai: {} as Record<string, unknown>,
}));
vi.mock("@/lib/settings/app-settings", () => ({
  getResolvedResendConfig: vi.fn(async () => cfg.nilai),
}));

import { sendViaResendApi } from "@/lib/email/resend";
import { kodeGalatResend } from "@/lib/email/kode-galat";

const input = { to: "siswa.rahasia@example.com", subject: "Tes", html: "<p>Tes</p>" };
const TANPA_JEDA = { retryDelaysMs: [0, 0] };
const fetchMock = vi.fn();
const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const auth = (panggilan: number) => (fetchMock.mock.calls[panggilan]![1].headers as Record<string, string>).Authorization;

beforeEach(() => {
  fetchMock.mockReset();
  warn.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  cfg.nilai = { apiKey: "re_kunci_database", fromEmail: "AyoTKA <noreply@ayotka.id>", source: "database", kunciCadanganEnv: "re_kunci_env" };
});
afterEach(() => vi.unstubAllGlobals());

describe("sendViaResendApi: kunci database ditolak -> coba kunci .env", () => {
  it.each([401, 403])("HTTP %i pada kunci database, kunci .env berhasil -> email terkirim, dan admin diingatkan lewat log", async (status) => {
    fetchMock
      .mockResolvedValueOnce(json(status, { name: "validation_error", message: "API key is invalid" }))
      .mockResolvedValueOnce(json(200, { id: "x" }));
    await expect(sendViaResendApi(input, TANPA_JEDA)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(auth(0)).toBe("Bearer re_kunci_database");
    expect(auth(1)).toBe("Bearer re_kunci_env");
    const log = warn.mock.calls.map((c) => String(c[0])).join(" | ");
    expect(log).toMatch(/Perbarui kunci Resend di Pengaturan Sistem/);
  });

  it("isi email dan pengirim sama persis pada percobaan dengan kunci cadangan", async () => {
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(200, {}));
    await sendViaResendApi(input, TANPA_JEDA);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual(JSON.parse(fetchMock.mock.calls[0]![1].body));
  });

  it("kedua kunci ditolak -> gagal, dan yang dilaporkan galat kunci UTAMA (database), bukan kunci .env", async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { message: "galat-kunci-database" }))
      .mockResolvedValueOnce(json(403, { message: "galat-kunci-env" }));
    const hasil = await sendViaResendApi(input, TANPA_JEDA);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) {
      expect(hasil.status).toBe(401);
      expect(hasil.error).toContain("galat-kunci-database");
      expect(hasil.error).not.toContain("galat-kunci-env");
      expect(kodeGalatResend(hasil)).toBe("resend-401");
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("alamat penerima ditolak (422) bukan masalah kunci: kunci .env TIDAK dicoba", async () => {
    fetchMock.mockResolvedValue(json(422, { message: "invalid to" }));
    const hasil = await sendViaResendApi(input, TANPA_JEDA);
    expect(hasil.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gangguan Resend (5xx berulang) bukan masalah kunci: dicoba ulang dengan kunci yang sama, lalu menyerah tanpa kunci .env", async () => {
    fetchMock.mockResolvedValue(json(503, { message: "down" }));
    const hasil = await sendViaResendApi(input, TANPA_JEDA);
    expect(hasil.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 3; i++) expect(auth(i)).toBe("Bearer re_kunci_database");
  });

  it("kuota harian habis bukan masalah kunci: kunci .env TIDAK dicoba", async () => {
    fetchMock.mockResolvedValue(json(429, { name: "daily_quota_exceeded" }));
    const hasil = await sendViaResendApi(input, TANPA_JEDA);
    expect(!hasil.ok && hasil.kuotaHabis).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tanpa kunci cadangan (kunci .env kosong/sama), 401 langsung gagal dengan satu panggilan", async () => {
    cfg.nilai = { apiKey: "re_kunci_database", fromEmail: "AyoTKA <noreply@ayotka.id>", source: "database" };
    fetchMock.mockResolvedValue(json(401, {}));
    const hasil = await sendViaResendApi(input, TANPA_JEDA);
    expect(!hasil.ok && hasil.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("kunci utama berhasil -> hanya satu panggilan, kunci .env tidak disentuh", async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    await expect(sendViaResendApi(input, TANPA_JEDA)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("log tidak pernah memuat kunci, alamat penerima, atau isi respons Resend", async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { message: "kunci re_kunci_database tidak valid untuk siswa.rahasia@example.com BODI-RAHASIA-A" }))
      .mockResolvedValueOnce(json(401, { message: "re_kunci_env juga ditolak BODI-RAHASIA-B" }));
    await sendViaResendApi(input, TANPA_JEDA);
    const log = warn.mock.calls.map((c) => c.map(String).join(" ")).join(" | ");
    expect(log.length).toBeGreaterThan(0);
    for (const rahasia of ["re_kunci_database", "re_kunci_env", "siswa.rahasia", "BODI-RAHASIA-A", "BODI-RAHASIA-B"]) expect(log).not.toContain(rahasia);
  });
});

describe("sendViaResendApi: kunci tidak ada", () => {
  it("kunci database tersimpan tetapi tidak terbaca dan .env kosong -> pesan khusus dan kode 'resend-kunci-db-tak-terbaca', tanpa memanggil Resend", async () => {
    cfg.nilai = { apiKey: "", fromEmail: "", source: "none", kunciDatabaseTakTerbaca: true };
    const hasil = await sendViaResendApi(input, TANPA_JEDA);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) {
      expect(hasil.error).toMatch(/tidak bisa dibaca/);
      expect(kodeGalatResend(hasil)).toBe("resend-kunci-db-tak-terbaca");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("memang belum diisi -> pesan lama dan kode 'resend-kunci-kosong'", async () => {
    cfg.nilai = { apiKey: "", fromEmail: "", source: "none" };
    const hasil = await sendViaResendApi(input, TANPA_JEDA);
    expect(!hasil.ok && hasil.error).toMatch(/belum diisi/);
    expect(!hasil.ok && kodeGalatResend(hasil)).toBe("resend-kunci-kosong");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
