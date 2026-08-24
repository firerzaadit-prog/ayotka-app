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
  const client = new GoogleGenAI({ apiKey });

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

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const MODEL_NAME = MODEL;
