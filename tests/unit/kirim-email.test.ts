import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email/resend", () => ({ sendViaResendApi: vi.fn() }));

import { sendViaResendApi } from "@/lib/email/resend";
import { kirimEmail } from "@/lib/email/kirim";
import { parseAlamatPengirim, sendViaMailketingApi } from "@/lib/email/mailketing";

const resendMock = vi.mocked(sendViaResendApi);
const input = { to: "siswa@example.com", subject: "Tes", html: "<p>Tes</p>" };
const fetchMock = vi.fn();

beforeEach(() => {
  resendMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("MAILKETING_API_TOKEN", "token-uji");
  vi.stubEnv("MAILKETING_FROM_EMAIL", "AyoTKA <noreply@ayotka.id>");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function mailketingOk(): Response {
  return new Response(JSON.stringify({ success: true, message: "Email queued successfully" }), { status: 200 });
}

describe("parseAlamatPengirim", () => {
  it("memecah 'Nama <alamat>' jadi nama dan alamat", () => {
    expect(parseAlamatPengirim("AyoTKA <noreply@ayotka.id>")).toEqual({ nama: "AyoTKA", email: "noreply@ayotka.id" });
  });
  it("mendukung nama bertanda kutip", () => {
    expect(parseAlamatPengirim('"Tim AyoTKA" <halo@ayotka.id>')).toEqual({ nama: "Tim AyoTKA", email: "halo@ayotka.id" });
  });
  it("alamat polos memakai nama default", () => {
    expect(parseAlamatPengirim("halo@ayotka.id")).toEqual({ nama: "AyoTKA", email: "halo@ayotka.id" });
  });
});

describe("sendViaMailketingApi", () => {
  it("mengirim field sesuai spesifikasi dan token di header", async () => {
    fetchMock.mockResolvedValueOnce(mailketingOk());

    await expect(sendViaMailketingApi(input)).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.mailketing.co.id/api/v2/send");
    expect(init.headers["X-Api-Token"]).toBe("token-uji");
    expect(JSON.parse(init.body)).toEqual({
      from_name: "AyoTKA",
      from_email: "noreply@ayotka.id",
      subject: "Tes",
      recipient: "siswa@example.com",
      content: "<p>Tes</p>",
    });
  });

  it("402 kredit habis dilaporkan sebagai gagal dengan status", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, message: "Insufficient credits" }), { status: 402 }));

    const hasil = await sendViaMailketingApi(input);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.status).toBe(402);
  });

  it("tanpa token langsung gagal tanpa memanggil jaringan", async () => {
    vi.stubEnv("MAILKETING_API_TOKEN", "");

    const hasil = await sendViaMailketingApi(input);
    expect(hasil.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("kirimEmail (Resend utama, Mailketing cadangan)", () => {
  it("Resend berhasil: Mailketing tidak disentuh", async () => {
    resendMock.mockResolvedValueOnce({ ok: true });

    await expect(kirimEmail(input)).resolves.toEqual({ ok: true, lewat: "resend" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("kuota Resend habis: otomatis lewat Mailketing", async () => {
    resendMock.mockResolvedValueOnce({ ok: false, error: "quota", kuotaHabis: true, status: 429 });
    fetchMock.mockResolvedValueOnce(mailketingOk());

    await expect(kirimEmail(input)).resolves.toEqual({ ok: true, lewat: "mailketing" });
  });

  it("gangguan Resend 5xx: otomatis lewat Mailketing", async () => {
    resendMock.mockResolvedValueOnce({ ok: false, error: "down", kuotaHabis: false, status: 503 });
    fetchMock.mockResolvedValueOnce(mailketingOk());

    await expect(kirimEmail(input)).resolves.toEqual({ ok: true, lewat: "mailketing" });
  });

  it("Resend tidak terjangkau (tanpa status): otomatis lewat Mailketing", async () => {
    resendMock.mockResolvedValueOnce({ ok: false, error: "ECONNRESET", kuotaHabis: false });
    fetchMock.mockResolvedValueOnce(mailketingOk());

    await expect(kirimEmail(input)).resolves.toEqual({ ok: true, lewat: "mailketing" });
  });

  it("alamat penerima ditolak Resend (422) TIDAK dicadangkan (hindari penalti bounce)", async () => {
    resendMock.mockResolvedValueOnce({ ok: false, error: "invalid to", kuotaHabis: false, status: 422 });

    const hasil = await kirimEmail(input);
    expect(hasil.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Mailketing belum dikonfigurasi: perilaku lama, cuma Resend", async () => {
    vi.stubEnv("MAILKETING_API_TOKEN", "");
    resendMock.mockResolvedValueOnce({ ok: false, error: "quota", kuotaHabis: true, status: 429 });

    const hasil = await kirimEmail(input);
    expect(hasil).toMatchObject({ ok: false, kuotaHabis: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dua-duanya gagal: melaporkan gagal dengan kedua alasan", async () => {
    resendMock.mockResolvedValueOnce({ ok: false, error: "quota", kuotaHabis: true, status: 429 });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, message: "Insufficient credits" }), { status: 402 }));

    const hasil = await kirimEmail(input);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) {
      expect(hasil.error).toContain("quota");
      expect(hasil.error).toContain("Insufficient credits");
    }
  });
});
