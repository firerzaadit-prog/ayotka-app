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
    kelebihanSiswa: {
      type: Type.STRING,
      description:
        "Kelebihan siswa, WAJIB menyebut nama materi/sub-materi spesifik yang paling dikuasai (bukan pujian umum), serta level kognitif yang paling kuat. Hanya materi yang ada di data yang diberikan.",
    },
    kekuranganSiswa: {
      type: Type.STRING,
      description:
        "Kekurangan siswa, WAJIB menyebut nama materi/sub-materi spesifik yang masih lemah beserta miskonsepsi konkretnya (bandingkan jawaban siswa vs kunci pada soal terkait). Hanya materi yang ada di data yang diberikan.",
    },
    rekomendasi: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "3-5 rekomendasi belajar, TIAP butir menyasar satu materi/sub-materi lemah yang spesifik (bukan saran generik), dengan langkah konkret",
    },
  },
  required: ["ringkasan", "kelebihanSiswa", "kekuranganSiswa", "rekomendasi"],
};

export const analisisSekolahSchema = z.object({
  ringkasan: z.string().min(1),
  kelebihanSekolah: z.string().min(1),
  kekuranganSekolah: z.string().min(1),
  rekomendasi: z.array(z.string().min(1)).min(1).max(5),
});
export type AnalisisAiSekolah = z.infer<typeof analisisSekolahSchema>;

export const geminiSekolahResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ringkasan: { type: Type.STRING, description: "Ringkasan performa dan daya serap sekolah secara umum (2-3 kalimat)" },
    kelebihanSekolah: {
      type: Type.STRING,
      description: "Kelebihan sekolah, WAJIB menyebut nama indikator atau materi yang paling dikuasai siswa.",
    },
    kekuranganSekolah: {
      type: Type.STRING,
      description: "Kekurangan sekolah, WAJIB menyebut indikator yang masih lemah dan prioritas remedial.",
    },
    rekomendasi: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 rekomendasi tindak lanjut bagi guru, spesifik menyasar indikator yang lemah",
    },
  },
  required: ["ringkasan", "kelebihanSekolah", "kekuranganSekolah", "rekomendasi"],
};
