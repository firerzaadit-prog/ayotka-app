import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => ({
  resend: { apiKey: "re_kunci_rahasia_uji_1234567890", fromEmail: "AyoTKA <noreply@ayotka.id>", source: "database" as const },
  mailketing: { apiToken: "", fromEmail: "", source: "none" as "none" | "env" },
}));
vi.mock("@/lib/settings/app-settings", () => ({
  getResolvedResendConfig: vi.fn(async () => cfg.resend),
  getResolvedMailketingConfig: vi.fn(async () => cfg.mailketing),
}));

import { gabungKode, kodeGalatMailketing, kodeGalatResend } from "@/lib/email/kode-galat";
import { kirimEmail } from "@/lib/email/kirim";
import { pesanEmailBelumTerkirim } from "@/lib/email/konfirmasi";
import { sendViaMailketingApi } from "@/lib/email/mailketing";
import { sendViaResendApi } from "@/lib/email/resend";

const input = { to: "siswa.rahasia@example.com", subject: "Tes", html: "<p>Tes</p>" };
const TANPA_JEDA = { retryDelaysMs: [0, 0] };
const fetchMock = vi.fn();
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  cfg.resend.apiKey = "re_kunci_rahasia_uji_1234567890";
  cfg.mailketing = { apiToken: "", fromEmail: "", source: "none" };
});
afterEach(() => vi.unstubAllGlobals());

describe("kode penyebab (fungsi murni)", () => {
  it("Resend: kuota, kode HTTP, kunci kosong, jaringan, lainnya", () => {
    expect(kodeGalatResend({ error: "x", kuotaHabis: true, status: 429 })).toBe("resend-kuota");
    expect(kodeGalatResend({ error: "x", status: 401 })).toBe("resend-401");
    expect(kodeGalatResend({ error: "x", status: 403 })).toBe("resend-403");
    expect(kodeGalatResend({ error: "x", status: 503 })).toBe("resend-503");
    expect(kodeGalatResend({ error: "RESEND_API_KEY belum diisi di Pengaturan Sistem atau .env" })).toBe("resend-kunci-kosong");
    expect(kodeGalatResend({ error: "Resend tidak terjangkau: fetch failed" })).toBe("resend-jaringan");
    expect(kodeGalatResend({ error: "entah" })).toBe("resend-gagal");
  });

  it("Mailketing: kode HTTP, token kosong, jaringan, lainnya", () => {
    expect(kodeGalatMailketing({ error: "x", status: 402 })).toBe("mailketing-402");
    expect(kodeGalatMailketing({ error: "Token Mailketing belum diisi di Pengaturan Sistem atau .env" })).toBe("mailketing-token-kosong");
    expect(kodeGalatMailketing({ error: "Mailketing tidak terjangkau: x" })).toBe("mailketing-jaringan");
    expect(kodeGalatMailketing({ error: "entah" })).toBe("mailketing-gagal");
  });

  it("gabungKode membuang yang kosong", () => {
    expect(gabungKode("resend-401", "mailketing-nonaktif")).toBe("resend-401 + mailketing-nonaktif");
    expect(gabungKode("resend-422", null, undefined, "")).toBe("resend-422");
    expect(gabungKode()).toBe("");
  });
});

describe("kode cocok dengan pesan galat NYATA dari pengirim (jika teks pesan diubah, tes ini gagal)", () => {
  it("Resend: kunci kosong, jaringan putus, 401, 403, kuota habis", async () => {
    cfg.resend.apiKey = "";
    const kosong = await sendViaResendApi(input, TANPA_JEDA);
    expect(!kosong.ok && kodeGalatResend(kosong)).toBe("resend-kunci-kosong");

    cfg.resend.apiKey = "re_kunci_rahasia_uji_1234567890";
    fetchMock.mockRejectedValue(new Error("fetch failed"));
    const jaringan = await sendViaResendApi(input, TANPA_JEDA);
    expect(!jaringan.ok && kodeGalatResend(jaringan)).toBe("resend-jaringan");

    fetchMock.mockReset().mockResolvedValue(json(401, { name: "validation_error", message: "API key is invalid" }));
    const u401 = await sendViaResendApi(input, TANPA_JEDA);
    expect(!u401.ok && kodeGalatResend(u401)).toBe("resend-401");

    fetchMock.mockReset().mockResolvedValue(json(403, { name: "validation_error", message: "The ayotka.id domain is not verified" }));
    const u403 = await sendViaResendApi(input, TANPA_JEDA);
    expect(!u403.ok && kodeGalatResend(u403)).toBe("resend-403");

    fetchMock.mockReset().mockResolvedValue(json(429, { name: "daily_quota_exceeded", message: "quota" }));
    const kuota = await sendViaResendApi(input, TANPA_JEDA);
    expect(!kuota.ok && kodeGalatResend(kuota)).toBe("resend-kuota");
  });

  it("Mailketing: token kosong, jaringan putus, 402", async () => {
    const kosong = await sendViaMailketingApi(input);
    expect(!kosong.ok && kodeGalatMailketing(kosong)).toBe("mailketing-token-kosong");

    cfg.mailketing = { apiToken: "token-mk-rahasia-uji", fromEmail: "", source: "env" };
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const jaringan = await sendViaMailketingApi(input);
    expect(!jaringan.ok && kodeGalatMailketing(jaringan)).toBe("mailketing-jaringan");

    fetchMock.mockReset().mockResolvedValue(json(402, { success: false, message: "Insufficient credits" }));
    const habis = await sendViaMailketingApi(input);
    expect(!habis.ok && kodeGalatMailketing(habis)).toBe("mailketing-402");
  });
});

describe("kirimEmail menyertakan kode penyebab", () => {
  it("Resend ditolak 401 dan Mailketing tidak dikonfigurasi -> 'resend-401 + mailketing-nonaktif'", async () => {
    fetchMock.mockResolvedValue(json(401, { name: "validation_error", message: "API key is invalid" }));
    const hasil = await kirimEmail(input);
    expect(hasil).toMatchObject({ ok: false, kode: "resend-401 + mailketing-nonaktif", kuotaHabis: false });
  });

  it("dua-duanya gagal -> kedua kode disebut", async () => {
    cfg.mailketing = { apiToken: "token-mk-rahasia-uji", fromEmail: "", source: "env" };
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("resend.com") ? json(403, { name: "validation_error", message: "domain" }) : json(402, { success: false, message: "Insufficient credits" }),
    );
    const hasil = await kirimEmail(input);
    expect(hasil).toMatchObject({ ok: false, kode: "resend-403 + mailketing-402" });
  });

  it("alamat penerima ditolak (422): hanya kode Resend, Mailketing tidak dicoba dan tidak disebut", async () => {
    cfg.mailketing = { apiToken: "token-mk-rahasia-uji", fromEmail: "", source: "env" };
    fetchMock.mockResolvedValue(json(422, { name: "validation_error", message: "Invalid `to` field" }));
    const hasil = await kirimEmail(input);
    expect(hasil).toMatchObject({ ok: false, kode: "resend-422" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("kunci kosong dan tanpa cadangan -> 'resend-kunci-kosong + mailketing-nonaktif'", async () => {
    cfg.resend.apiKey = "";
    expect(await kirimEmail(input)).toMatchObject({ ok: false, kode: "resend-kunci-kosong + mailketing-nonaktif" });
  });

  it("kode tidak pernah memuat kunci, token, alamat penerima, atau isi respons penyedia", async () => {
    cfg.mailketing = { apiToken: "token-mk-rahasia-uji", fromEmail: "", source: "env" };
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("resend.com")
        ? json(401, { name: "validation_error", message: "key re_kunci_rahasia_uji_1234567890 untuk siswa.rahasia@example.com tidak valid" })
        : json(500, { success: false, message: "token-mk-rahasia-uji siswa.rahasia@example.com" }),
    );
    const hasil = await kirimEmail(input);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) {
      expect(hasil.kode).toBe("resend-401 + mailketing-500");
      for (const rahasia of ["re_kunci", "token-mk", "siswa.rahasia", "@example.com", "tidak valid"]) expect(hasil.kode).not.toContain(rahasia);
    }
  });
});

describe("pesanEmailBelumTerkirim", () => {
  it("tanpa kode: pesan lama persis; dengan kode: kode ditambahkan di ujung (kedua varian)", () => {
    expect(pesanEmailBelumTerkirim(false)).toBe(
      'Akunmu sudah dibuat, tapi email konfirmasi belum berhasil terkirim. Klik "Kirim ulang email konfirmasi" di bawah untuk mencoba lagi.',
    );
    expect(pesanEmailBelumTerkirim(false, "resend-401 + mailketing-nonaktif")).toMatch(/untuk mencoba lagi\. \(Kode: resend-401 \+ mailketing-nonaktif\)$/);
    expect(pesanEmailBelumTerkirim(true, "resend-kuota")).toMatch(/beberapa menit lagi\. \(Kode: resend-kuota\)$/);
    expect(pesanEmailBelumTerkirim(true)).not.toContain("Kode");
  });
});
