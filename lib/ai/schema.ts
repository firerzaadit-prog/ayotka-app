import { Type, type Schema } from "@google/genai";
import { z } from "zod";

/**
 * Tiket 5.4 (Brief Bagian 8.1/8.3): AI cuma boleh MENARASIKAN angka yang
 * sudah dihitung kode program, tidak pernah menghitung sendiri - makanya
 * skema output dibatasi ketat ke narasi per angka yang sudah kita kirim,
 * tanpa field angka baru yang bisa "dikarang" AI. Skema Gemini (buat
 * memaksa output JSON) dan skema Zod (buat validasi ulang di server,
 * respons tidak valid = gagal, bukan diterima diam-diam) sengaja dibuat
 * kembar - lihat lib/ai/gemini.ts.
 */
export const analisisSchema = z.object({
  ringkasan: z.string().min(1),
  petaKompetensi: z
    .array(z.object({ kode: z.string().min(1), narasi: z.string().min(1) }))
    .min(1),
  levelKognitif: z.string().min(1),
  polaKesalahan: z.string().min(1),
  rekomendasi: z.array(z.string().min(1)).min(1).max(5),
});
export type AnalisisAi = z.infer<typeof analisisSchema>;

export const geminiResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ringkasan: { type: Type.STRING, description: "2-3 kalimat ringkasan performa siswa secara umum" },
    petaKompetensi: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          kode: { type: Type.STRING },
          narasi: { type: Type.STRING, description: "narasi singkat untuk kompetensi ini, jangan mengarang angka baru" },
        },
        required: ["kode", "narasi"],
      },
    },
    levelKognitif: { type: Type.STRING, description: "narasi kekuatan/kelemahan per level kognitif C1-C6 berdasarkan data yang diberikan" },
    polaKesalahan: { type: Type.STRING, description: "narasi pola kesalahan yang terlihat dari data yang diberikan" },
    rekomendasi: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 rekomendasi sub materi prioritas untuk dipelajari ulang, disertai alasan singkat",
    },
  },
  required: ["ringkasan", "petaKompetensi", "levelKognitif", "polaKesalahan", "rekomendasi"],
};
