import { z } from "zod";
import {
  MAKS_GAMBAR_KARAKTER,
  MAKS_PANJANG_BALASAN,
  MAKS_PANJANG_PESAN,
  MAKS_PESAN_RIWAYAT,
  MAKS_TOTAL_KARAKTER,
} from "@/lib/tutor/konstanta";

/** Hanya foto JPEG/PNG/WebP bergaya data URI base64 - bukan PDF, SVG (bisa memuat skrip), atau jenis lain. */
export const POLA_GAMBAR = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Badan permintaan POST /api/siswa/attempts/[id]/tutor. Konteks soal SENGAJA tidak ikut: disusun server dari database. */
export const tutorBodySchema = z
  .object({
    questionId: z.string().uuid("Soal tidak valid."),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z
            .string()
            .trim()
            .min(1, "Pesan tidak boleh kosong.")
            .max(MAKS_PANJANG_PESAN, `Pesan maksimal ${MAKS_PANJANG_PESAN} karakter.`),
        }),
      )
      .min(1, "Pesan tidak boleh kosong.")
      .max(MAKS_PESAN_RIWAYAT, "Percakapan terlalu panjang."),
    /** Foto coretan siswa; hanya untuk pesan terakhir. */
    gambar: z
      .string()
      .max(MAKS_GAMBAR_KARAKTER, "Foto terlalu besar. Coba foto lain atau kecilkan ukurannya.")
      .regex(POLA_GAMBAR, "Foto harus berformat JPG, PNG, atau WebP.")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.messages[0]?.role !== "user") {
      ctx.addIssue({ code: "custom", path: ["messages"], message: "Percakapan harus dimulai dari pesan siswa." });
    }
    if (data.messages[data.messages.length - 1]?.role !== "user") {
      ctx.addIssue({ code: "custom", path: ["messages"], message: "Pesan terakhir harus dari siswa." });
    }
    const total = data.messages.reduce((a, m) => a + m.content.length, 0);
    if (total > MAKS_TOTAL_KARAKTER) {
      ctx.addIssue({ code: "custom", path: ["messages"], message: "Percakapan terlalu panjang. Mulai pertanyaan baru." });
    }
  });

export type TutorBody = z.infer<typeof tutorBodySchema>;

/**
 * Bersihkan balasan dari AI sebelum sampai ke siswa: gambar markdown ![alt](url) diganti teks alternatifnya (balasan
 * AI tidak boleh membuat peramban siswa memuat alamat luar), ruang berlebih dirapikan, panjang dibatasi. null bila kosong.
 */
export function bersihkanBalasan(balasan: unknown): string | null {
  if (typeof balasan !== "string") return null;
  const bersih = balasan
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!bersih) return null;
  return bersih.length > MAKS_PANJANG_BALASAN ? `${bersih.slice(0, MAKS_PANJANG_BALASAN)}...` : bersih;
}
