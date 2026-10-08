import "server-only";
import { prisma } from "@/lib/db/prisma";
import { GoogleGenAI, ApiError } from "@google/genai";
import { getResolvedAiConfig } from "@/lib/settings/app-settings";
import { geminiSekolahResponseSchema, analisisSekolahSchema, type AnalisisAiSekolah } from "@/lib/ai/schema";
import { buildAnalisisSekolahPrompt } from "@/lib/ai/prompt-sekolah";
import { PROMPT_VERSION } from "@/lib/ai/version";
import type { LaporanIndikatorSekolah } from "@/lib/indikator/daya-serap";

const BACKOFF_MS = [10_000, 20_000, 40_000];
export const MODEL_NAME = process.env.AI_MODEL || "gemini-3.6-flash";

class InvalidAiResponseError extends Error {}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriable(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 429 || err.status >= 500;
  return err instanceof InvalidAiResponseError;
}

export async function generateSekolahAnalisis(
  kunci: string,
  schoolId: string,
  dataLaporan: {
    sekolah: { nama: string };
    mapel: { nama: string };
    jumlahSiswaMengerjakan: number;
    jumlahPaket: number;
    laporan: LaporanIndikatorSekolah | null;
    wawasan?: { jenis: "info" | "perhatian" | "positif"; teks: string }[];
  },
  periodeLabel: string
): Promise<AnalisisAiSekolah> {
  if (!dataLaporan.laporan) {
    throw new Error("Laporan kosong, tidak ada data untuk dianalisis.");
  }

  const { apiKey, model } = await getResolvedAiConfig();
  if (!apiKey) {
    throw new Error("API Key Google Gemini belum diisi.");
  }

  const client = new GoogleGenAI({ apiKey, vertexai: false });

  const prompt = buildAnalisisSekolahPrompt({
    namaSekolah: dataLaporan.sekolah.nama,
    namaMapel: dataLaporan.mapel.nama,
    jumlahSiswaMengerjakan: dataLaporan.jumlahSiswaMengerjakan,
    jumlahPaket: dataLaporan.jumlahPaket,
    periodeLabel,
    laporan: dataLaporan.laporan,
    wawasan: dataLaporan.wawasan ?? [],
  });

  let lastError: unknown = new Error("Gagal memanggil AI.");
  let pakaiSkema = true;

  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: model || MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          ...(pakaiSkema ? { responseSchema: geminiSekolahResponseSchema } : {}),
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

      const result = analisisSekolahSchema.safeParse(parsed);
      if (!result.success) {
        throw new InvalidAiResponseError(`Respons AI tidak sesuai skema: ${result.error.message}`);
      }

      const hasil = result.data;

      // Simpan ke DB
      await prisma.aiAnalysisSekolah.upsert({
        where: { kunci },
        create: {
          schoolId,
          kunci,
          versiPrompt: PROMPT_VERSION,
          model: model || MODEL_NAME,
          ringkasan: hasil.ringkasan,
          detailJson: hasil,
        },
        update: {
          versiPrompt: PROMPT_VERSION,
          model: model || MODEL_NAME,
          ringkasan: hasil.ringkasan,
          detailJson: hasil,
          generatedAt: new Date(),
        },
      });

      return hasil;
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

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
