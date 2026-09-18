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
export const analisisSchema = z
  .object({
    ringkasan: z.string().min(1),
    petaKompetensi: z
      .array(z.object({ kode: z.string().min(1), narasi: z.string().min(1) }))
      .min(1),
    kelebihanSiswa: z.string().min(1).optional(),
    kekuranganSiswa: z.string().min(1).optional(),
    levelKognitif: z.string().min(1).optional(),
    polaKesalahan: z.string().min(1).optional(),
    rekomendasi: z.array(z.string().min(1)).min(1).max(5),
  })
  .refine((data) => Boolean(data.kelebihanSiswa || data.levelKognitif), {
    message: "Kelebihan siswa atau level kognitif harus diisi.",
  })
  .refine((data) => Boolean(data.kekuranganSiswa || data.polaKesalahan), {
    message: "Kekurangan siswa atau pola kesalahan harus diisi.",
  })
  .transform((data) => ({
    ...data,
    kelebihanSiswa: data.kelebihanSiswa ?? data.levelKognitif ?? "",
    kekuranganSiswa: data.kekuranganSiswa ?? data.polaKesalahan ?? "",
  }));
export type AnalisisAi = z.infer<typeof analisisSchema>;

export const geminiResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ringkasan: { type: Type.STRING, description: "Ringkasan performa dan kemampuan siswa secara umum (2-3 kalimat)" },
    petaKompetensi: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          kode: { type: Type.STRING },
          narasi: { type: Type.STRING, description: "Narasi singkat capaian untuk kompetensi ini, jangan mengarang angka baru" },
        },
        required: ["kode", "narasi"],
      },
    },
    kelebihanSiswa: {
      type: Type.STRING,
      description: "Penjelasan kelebihan, kekuatan konsep, serta materi dan level kognitif yang paling dikuasai siswa dengan baik",
    },
    kekuranganSiswa: {
      type: Type.STRING,
      description: "Penjelasan kekurangan, materi yang belum dikuasai, konsep/tipe soal yang masih keliru, serta pola miskonsepsi siswa",
    },
    rekomendasi: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 rekomendasi belajar terarah dan sub materi prioritas untuk dipelajari ulang, disertai alasan singkat",
    },
  },
  required: ["ringkasan", "petaKompetensi", "kelebihanSiswa", "kekuranganSiswa", "rekomendasi"],
};
