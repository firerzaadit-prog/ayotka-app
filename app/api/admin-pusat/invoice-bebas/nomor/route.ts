import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { formatNomorInvoice } from "@/lib/billing/nomor-invoice";
import { nomorBerikutnyaUntukAwalan, pemakaiNomor } from "@/lib/billing/nomor-terpakai";
import { awalanDariIsian } from "@/lib/invoice/bebas";

/**
 * Saran nomor urut untuk Pembuat Invoice: `?kode=AYOTKA&tanggal=2026-10-16` menjawab nomor berikutnya yang masih bebas pada
 * bulan itu (dari invoice sekolah, invoice bebas, dan nomor yang terpakai di luar aplikasi). Dengan `&urut=5` ikut
 * menjawab apakah nomor urut itu sudah dipakai dan oleh siapa, untuk peringatan di formulir sebelum diterbitkan.
 */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const awalan = awalanDariIsian(params.get("kode") ?? "", params.get("tanggal") ?? "");
  if (!awalan) return NextResponse.json({ error: "Kode nomor atau tanggal terbit tidak valid." }, { status: 400 });

  const berikutnya = await nomorBerikutnyaUntukAwalan(awalan);

  let dipakai: Awaited<ReturnType<typeof pemakaiNomor>> = null;
  const urutParam = params.get("urut");
  if (urutParam !== null && /^\d{1,5}$/.test(urutParam) && Number(urutParam) >= 1) {
    dipakai = await pemakaiNomor(formatNomorInvoice(awalan, Number(urutParam)), awalan);
  }

  return NextResponse.json(
    { awalan, urutBerikutnya: berikutnya.urut, nomorBerikutnya: berikutnya.nomor, dipakai },
    { headers: { "Cache-Control": "no-store" } },
  );
}
