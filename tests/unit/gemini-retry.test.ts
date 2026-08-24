import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// lib/ai/gemini.ts sengaja pakai "server-only" (Brief Bagian 8.1: API key AI
// tidak boleh ada di kode browser) - itu murni guard build-time Next.js,
// tidak relevan di runner Node vitest, jadi di-stub supaya file ini bisa
// diuji langsung tanpa melemahkan proteksinya di build sungguhan.
vi.mock("server-only", () => ({}));

const generateContentMock = vi.fn();
const constructorOptionsSpy = vi.fn();

vi.mock("@google/genai", () => {
  class ApiError extends Error {
    status: number;
    constructor(opts: { message: string; status: number }) {
      super(opts.message);
      this.status = opts.status;
    }
  }
  class GoogleGenAI {
    models = { generateContent: generateContentMock };
    constructor(options: unknown) {
      constructorOptionsSpy(options);
    }
  }
  return { GoogleGenAI, ApiError, Type: { OBJECT: "OBJECT", STRING: "STRING", ARRAY: "ARRAY" } };
});

const validPayload = {
  ringkasan: "Ringkasan.",
  petaKompetensi: [{ kode: "K1", narasi: "narasi" }],
  levelKognitif: "narasi level",
  polaKesalahan: "narasi pola",
  rekomendasi: ["belajar lagi"],
};

/**
 * Retry/backoff (Brief Bagian 8.1 aturan wajib 3&4) diuji dengan fake timer
 * supaya tidak benar-benar menunggu 10s/20s/40s - yang diuji adalah
 * JUMLAH percobaan & kapan berhenti retry, bukan waktu aslinya.
 */
describe("generateAnalisis retry/backoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("AI_API_KEY", "test-key");
    generateContentMock.mockReset();
    constructorOptionsSpy.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("berhasil di percobaan pertama tanpa retry", async () => {
    const { generateAnalisis } = await import("@/lib/ai/gemini");
    generateContentMock.mockResolvedValueOnce({ text: JSON.stringify(validPayload) });

    const result = await generateAnalisis("prompt");
    expect(result.ringkasan).toBe("Ringkasan.");
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("retry setelah error 429 lalu berhasil", async () => {
    const { generateAnalisis } = await import("@/lib/ai/gemini");
    const { ApiError } = await import("@google/genai");
    generateContentMock
      .mockRejectedValueOnce(new ApiError({ message: "rate limited", status: 429 }))
      .mockResolvedValueOnce({ text: JSON.stringify(validPayload) });

    const promise = generateAnalisis("prompt");
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result.ringkasan).toBe("Ringkasan.");
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it("retry kalau respons kosong/tidak valid, bukan diterima diam-diam", async () => {
    const { generateAnalisis } = await import("@/lib/ai/gemini");
    generateContentMock
      .mockResolvedValueOnce({ text: "" })
      .mockResolvedValueOnce({ text: "bukan json" })
      .mockResolvedValueOnce({ text: JSON.stringify(validPayload) });

    const promise = generateAnalisis("prompt");
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await promise;

    expect(result.ringkasan).toBe("Ringkasan.");
    expect(generateContentMock).toHaveBeenCalledTimes(3);
  });

  it("berhenti setelah 3x retry (4 percobaan total) dan melempar error, bukan hasil kosong", async () => {
    const { generateAnalisis } = await import("@/lib/ai/gemini");
    const { ApiError } = await import("@google/genai");
    generateContentMock.mockRejectedValue(new ApiError({ message: "server error", status: 500 }));

    const promise = generateAnalisis("prompt");
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(20_000);
    await vi.advanceTimersByTimeAsync(40_000);

    await expect(promise).rejects.toThrow();
    expect(generateContentMock).toHaveBeenCalledTimes(4);
  });

  it("tidak retry untuk error non-retriable (mis. 400 bad request)", async () => {
    const { generateAnalisis } = await import("@/lib/ai/gemini");
    const { ApiError } = await import("@google/genai");
    generateContentMock.mockRejectedValue(new ApiError({ message: "bad request", status: 400 }));

    await expect(generateAnalisis("prompt")).rejects.toThrow();
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("selalu memaksa mode Gemini Developer API (vertexai: false), tidak ikut tebakan dari env ambient", async () => {
    const { generateAnalisis } = await import("@/lib/ai/gemini");
    generateContentMock.mockResolvedValueOnce({ text: JSON.stringify(validPayload) });

    await generateAnalisis("prompt");

    expect(constructorOptionsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-key", vertexai: false }),
    );
  });

  it("401 dari Gemini dikasih petunjuk troubleshooting yang jelas, bukan cuma JSON mentah", async () => {
    const { generateAnalisis } = await import("@/lib/ai/gemini");
    const { ApiError } = await import("@google/genai");
    generateContentMock.mockRejectedValue(
      new ApiError({ message: "Request had invalid authentication credentials.", status: 401 }),
    );

    await expect(generateAnalisis("prompt")).rejects.toThrow(/AI_API_KEY|Google AI Studio/);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });
});
