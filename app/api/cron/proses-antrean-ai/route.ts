import { NextResponse } from "next/server";
import { processAiQueue } from "@/lib/ai/queue-worker";
import { tutupPercobaanKedaluwarsa } from "@/lib/exam/tutup-kedaluwarsa";

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
 * Cron yang sama juga MENUTUP percobaan ujian yang waktunya sudah habis tapi masih berstatus "berjalan" (siswa yang
 * menutup peramban dan tidak pernah membuka ujiannya lagi - lihat lib/exam/tutup-kedaluwarsa.ts). Dijalankan SEBELUM
 * antrean AI supaya analisis percobaan yang baru ditutup ikut terproses di putaran yang sama. Sengaja tidak dibuat
 * cron tersendiri: plan Hobby hanya mengizinkan 2 cron per akun dan keduanya sudah terpakai (vercel.json).
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

  // Kegagalan penyapuan tidak boleh menghalangi antrean AI (dan sebaliknya).
  let tutup;
  try {
    tutup = await tutupPercobaanKedaluwarsa();
    if (tutup.ditutup.length > 0 || tutup.gagal.length > 0) {
      console.log(
        `[tutup-kedaluwarsa] diperiksa=${tutup.diperiksa} ditutup=${tutup.ditutup.length} gagal=${tutup.gagal.length}`,
      );
    }
  } catch (err) {
    console.error("[tutup-kedaluwarsa] penyapuan gagal:", err);
    tutup = { diperiksa: 0, ditutup: [], gagal: [{ attemptId: "-", galat: err instanceof Error ? err.message : String(err) }] };
  }

  const hasil = await processAiQueue();
  return NextResponse.json({ ...hasil, tutupKedaluwarsa: { diperiksa: tutup.diperiksa, ditutup: tutup.ditutup.length, gagal: tutup.gagal.length } });
}
