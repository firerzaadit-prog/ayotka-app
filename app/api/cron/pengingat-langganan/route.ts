import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { kirimEmail } from "@/lib/email/kirim";
import { jalankanPengingatPeriode } from "@/lib/billing/pengingat-periode";

/**
 * Dipanggil cron server setiap hari (/etc/cron.d/ayotka di VPS, 02.00 UTC = 09.00 WIB) untuk mengirim pengingat
 * langganan sekolah lewat email ke admin sekolah:
 * HANYA H-7 dan H-1 sebelum periode berakhir (lihat lib/billing/pengingat-periode.ts untuk aturan lengkapnya,
 * termasuk anti ganda dan kapan dilewati). Aman dipanggil berulang: pengingat yang sudah terkirim tidak dikirim lagi
 * - tetapi hanya di database yang SAMA; karena itu vercel.json tidak boleh punya `crons` (Vercel menunjuk ke database
 * Supabase lama yang basi, jadi akan mengirim ganda/salah). Hitungan H-7/H-1 memakai tanggal kalender WIB.
 *
 * Diverifikasi lewat header Authorization: Bearer CRON_SECRET (format yang sama dengan Vercel Cron) - sama seperti
 * /api/cron/proses-antrean-ai - supaya tidak bisa dipicu sembarang orang (yang akan menghabiskan kuota email).
 * Untuk memeriksa tanpa mengirim apa pun: tambahkan ?dryRun=1 (tidak mengirim dan tidak mencatat klaim).
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || url.origin).replace(/\/+$/, "");

  const hasil = await jalankanPengingatPeriode(
    {
      db: prisma,
      appUrl,
      kirim: async (email) => {
        const r = await kirimEmail(email);
        return r.ok ? { ok: true } : { ok: false, error: r.error };
      },
    },
    { dryRun },
  );

  console.log(
    `[pengingat-langganan] dryRun=${hasil.dryRun} diperiksa=${hasil.diperiksa} terkirim=${hasil.terkirim.length} ` +
      `akanDikirim=${hasil.akanDikirim.length} dilewati=${hasil.dilewati.length} gagal=${hasil.gagal.length}`,
  );
  return NextResponse.json(hasil);
}
