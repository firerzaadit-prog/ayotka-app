import { NextResponse } from "next/server";
import { processAiQueue } from "@/lib/ai/queue-worker";

/**
 * Dipanggil Vercel Cron tiap menit (lihat vercel.json) untuk memproses
 * antrean Analisis AI dengan laju terkendali - lihat lib/ai/queue-worker.ts
 * untuk alasan lengkap kenapa ini menggantikan pemicu fire-and-forget lama
 * di finalizeAttempt.
 *
 * CATATAN SKALA: jadwal cron per menit di vercel.json cuma berlaku di
 * proyek Vercel Pro ke atas - Hobby dibatasi Vercel ke cron sekali per hari,
 * sama sekali tidak cukup untuk memproses antrean secara real-time. Jangan
 * andalkan endpoint ini sampai proyek sudah di plan Pro.
 *
 * Diverifikasi lewat header Authorization standar Vercel Cron (CRON_SECRET)
 * supaya endpoint ini tidak bisa dipicu sembarang orang dari luar - tanpa
 * batas laju semacam ini, siapa pun yang tahu URL-nya bisa memicu banyak
 * panggilan Gemini berulang-ulang.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const hasil = await processAiQueue();
  return NextResponse.json(hasil);
}
