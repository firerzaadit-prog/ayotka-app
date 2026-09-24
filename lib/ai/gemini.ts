import "server-only";
import { GoogleGenAI, ApiError } from "@google/genai";
import { geminiResponseSchema, analisisSchema, type AnalisisAi } from "@/lib/ai/schema";

import { getResolvedAiConfig } from "@/lib/settings/app-settings";

// Google cukup sering pensiunkan model lama untuk pengguna baru.
// Sekarang bisa diubah langsung oleh Admin Pusat di dashboard atau lewat env var.
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
 * tidak valid - percobaan terakhir yang tetap gagal dilempar ke
 * pemanggil apa adanya supaya lib/ai/analyze.ts bisa menampilkan fallback
 * yang jujur, BUKAN ditelan diam-diam jadi hasil kosong.
 */
export async function generateAnalisis(prompt: string): Promise<AnalisisAi> {
  const { apiKey, model } = await getResolvedAiConfig();
  if (!apiKey) {
    throw new Error(
      "API Key Google Gemini belum diisi. Silakan masukkan di menu Admin Pusat > Pengaturan Sistem atau di Environment Variables.",
    );
  }

  const client = new GoogleGenAI({ apiKey, vertexai: false });

  let lastError: unknown = new Error("Gagal memanggil AI.");
  // Keluaran terstruktur (responseSchema) lebih berat bagi Gemini dan terbukti
  // bisa terus-menerus 503 saat model padat, padahal permintaan tanpa skema
  // tetap dilayani. Percobaan pertama memakai skema; kalau kena error server
  // (5xx), percobaan berikutnya turun ke mode JSON biasa - prompt sudah
  // menjelaskan 5 field-nya dan analisisSchema (Zod) di bawah tetap memvalidasi
  // ulang, jadi kualitas/keamanan hasil tidak berkurang.
  let pakaiSkema = true;

  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: model || "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          ...(pakaiSkema ? { responseSchema: geminiResponseSchema } : {}),
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
      if (err instanceof ApiError && err.status >= 500) pakaiSkema = false;
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
  if (lastError instanceof ApiError && lastError.status === 404) {
    throw new Error(
      `Model AI "${model}" tidak ditemukan/sudah pensiun di Gemini (404) - Google kadang ` +
        `mengganti model lama tanpa pemberitahuan. Cek pesan asli di bawah untuk nama model ` +
        `pengganti yang disarankan Google, lalu set env var AI_MODEL atau di menu Pengaturan Sistem (tidak perlu ` +
        `ubah kode). Pesan asli: ${lastError.message}`,
    );
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const MODEL_NAME = process.env.AI_MODEL || "gemini-3.6-flash";
