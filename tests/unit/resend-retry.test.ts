import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/settings/app-settings", () => ({
  getResolvedResendConfig: vi.fn(async () => ({
    apiKey: "re_test_key",
    fromEmail: "AyoTKA <noreply@ayotka.id>",
    source: "env",
  })),
}));

import { getResolvedResendConfig } from "@/lib/settings/app-settings";
import { sendViaResendApi } from "@/lib/email/resend";

const input = { to: "siswa@example.com", subject: "Tes", html: "<p>Tes</p>" };
const TANPA_JEDA = { retryDelaysMs: [0, 0] };

function respons(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendViaResendApi", () => {
  it("berhasil di percobaan pertama tanpa retry", async () => {
    fetchMock.mockResolvedValueOnce(respons(200, { id: "x" }));

    await expect(sendViaResendApi(input, TANPA_JEDA)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("mencoba ulang saat kena batas kecepatan 429 biasa lalu berhasil", async () => {
    fetchMock
      .mockResolvedValueOnce(respons(429, { name: "rate_limit_exceeded" }))
      .mockResolvedValueOnce(respons(200));

    await expect(sendViaResendApi(input, TANPA_JEDA)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("mencoba ulang saat jaringan putus lalu berhasil", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET")).mockResolvedValueOnce(respons(200));

    await expect(sendViaResendApi(input, TANPA_JEDA)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("menyerah setelah 3 percobaan kalau Resend terus 5xx", async () => {
    fetchMock.mockResolvedValue(respons(503, { message: "down" }));

    const hasil = await sendViaResendApi(input, TANPA_JEDA);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.kuotaHabis).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("kuota harian habis (429 *_quota_exceeded) TIDAK dicoba ulang dan ditandai kuotaHabis", async () => {
    fetchMock.mockResolvedValue(respons(429, { name: "daily_quota_exceeded" }));

    const hasil = await sendViaResendApi(input, TANPA_JEDA);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.kuotaHabis).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("error klien non-429 (mis. 422 alamat tidak valid) TIDAK dicoba ulang", async () => {
    fetchMock.mockResolvedValue(respons(422, { message: "invalid to" }));

    const hasil = await sendViaResendApi(input, TANPA_JEDA);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.kuotaHabis).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tanpa API key langsung gagal tanpa memanggil Resend", async () => {
    vi.mocked(getResolvedResendConfig).mockResolvedValueOnce({ apiKey: "", fromEmail: "", source: "none" });

    const hasil = await sendViaResendApi(input, TANPA_JEDA);
    expect(hasil.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
