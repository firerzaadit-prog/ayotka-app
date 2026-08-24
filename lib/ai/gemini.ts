import "server-only";
import { GoogleGenAI, ApiError } from "@google/genai";
import { geminiResponseSchema, analisisSchema, type AnalisisAi } from "@/lib/ai/schema";

const MODEL = "gemini-2.5-flash";
const BACKOFF_MS = [10_000, 20_000, 40_000];

class InvalidAiResponseError extends Error {}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriable(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 429 || err.status >= 500;
  return err instanceof InvalidAiResponseError;
}

/**
 * Tiket 5.4 (Brief Bagian 8.1 aturan wajib 3 & 4): retry dengan backoff
 * 10s/20s/40s kalau API kena limit/error server ATAU responsnya kosong/
 * tidak valid (garbled JSON dsb bisa saja cuma hiccup sesaat, jadi tetap
 * layak dicoba ulang) - percobaan terakhir yang tetap gagal dilempar ke
 * pemanggil apa adanya supaya lib/ai/analyze.ts bisa menampilkan fallback
 * yang jujur, BUKAN ditelan diam-diam jadi hasil kosong.
 */
export async function generateAnalisis(prompt: string): Promise<AnalisisAi> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_API_KEY belum diisi di environment server.");
  }
  // vertexai eksplisit false: SDK ini juga bisa jalan lewat Vertex AI (butuh
  // kredensial OAuth/service account, bukan API key biasa), dan tanpa flag
  // ini dia menebak dari variabel lingkungan (GOOGLE_GENAI_USE_VERTEXAI dkk)
  // yang bisa saja kebetulan ada di server tanpa disadari - kalau kepilih
  // Vertex AI secara tidak sengaja, errornya persis "expected OAuth 2
  // access token" walau AI_API_KEY sudah benar diisi.
  const client = new GoogleGenAI({ apiKey, vertexai: false });

  let lastError: unknown = new Error("Gagal memanggil AI.");

  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: geminiResponseSchema,
        },
      });

      const text = response.text;
      if (!text) throw new InvalidAiResponseError("Respons AI kosong.");

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new InvalidAiResponseError("Respons AI bukan JSON valid.");
      }

      const result = analisisSchema.safeParse(parsed);
      if (!result.success) {
        throw new InvalidAiResponseError(`Respons AI tidak sesuai skema: ${result.error.message}`);
      }

      return result.data;
    } catch (err) {
      lastError = err;
      if (attempt < BACKOFF_MS.length && isRetriable(err)) {
        await sleep(BACKOFF_MS[attempt]!);
        continue;
      }
      break;
    }
  }

  if (lastError instanceof ApiError && lastError.status === 401) {
    throw new Error(
      `Gagal autentikasi ke Gemini (401) - cek lagi AI_API_KEY: pastikan diambil dari ` +
        `Google AI Studio (bukan Google Cloud Console biasa), tidak ada spasi/kutip nyasar ` +
        `di .env, dan server sudah di-restart setelah diisi. Pesan asli: ${lastError.message}`,
    );
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const MODEL_NAME = MODEL;
