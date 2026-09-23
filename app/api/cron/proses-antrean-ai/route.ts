import { NextResponse } from "next/server";
import { processAiQueue } from "@/lib/ai/queue-worker";

/**
 * Dipanggil Vercel Cron untuk memproses antrean Analisis AI dengan laju
 * terkendali - lihat lib/ai/queue-worker.ts untuk alasan lengkap kenapa ini
 * menggantikan pemicu fire-and-forget lama di finalizeAttempt.
 *
 * CATATAN SKALA (PENTING): Vercel Hobby membatasi cron ke SEKALI PER HARI -
 * vercel.json sekarang dijadwalkan "0 3 * * *" (jam 3 pagi) supaya proyek
 * tetap bisa di-deploy di plan Hobby saat ini. Artinya siswa yang minta
 * Analisis AI hari ini baru diproses dini hari berikutnya, BUKAN dalam
 * hitungan menit seperti desain aslinya. Begitu proyek naik ke plan Pro,
 * ganti jadwal di vercel.json jadi "* * * * *" (tiap menit) supaya antrean
 * diproses nyaris real-time seperti seharusnya untuk skala Try Out Nasional.
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
