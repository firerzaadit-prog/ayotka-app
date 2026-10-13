import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { KONFIG_HARGA_LA_BAWAAN, validasiKonfigHargaLA } from "@/lib/billing/harga-la";
import { muatKalibrasiAi } from "@/lib/billing/kalibrasi-ai";
import { getKonfigHargaLA, simpanKonfigHargaLA, tabelHargaLaBelumAda } from "@/lib/billing/saldo";

/**
 * Harga Learning Analytics tambahan yang mengikuti beban AI paket (permintaan user, 12-13 Okt 2026): admin pusat
 * mengatur harga minimum, harga maksimum, dan dua batas beban AI (token masukan) di Paket & Rekening. Aturan hitungnya ada di
 * lib/billing/harga-la.ts. GET juga memuat ringkasan pemakaian token nyata (lib/billing/kalibrasi-ai.ts) untuk menyetel batas.
 * Menggantikan pengaturan lama "harga dasar + margin" (kolom lama di app_settings tidak dibaca lagi).
 */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const [konfig, kalibrasi] = await Promise.all([getKonfigHargaLA(), muatKalibrasiAi()]);
  return NextResponse.json({ konfig, bawaan: KONFIG_HARGA_LA_BAWAAN, kalibrasi }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const hasil = validasiKonfigHargaLA(body);
  if (!hasil.ok) {
    return NextResponse.json({ error: hasil.error }, { status: 400 });
  }

  const sebelum = await getKonfigHargaLA();
  let sesudah;
  try {
    sesudah = await simpanKonfigHargaLA(hasil.konfig);
  } catch (err) {
    if (tabelHargaLaBelumAda(err)) {
      return NextResponse.json(
        { error: "Pengaturan harga belum bisa disimpan: migrasi database untuk fitur ini belum diterapkan. Hubungi pengembang." },
        { status: 503 },
      );
    }
    throw err;
  }

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "harga_la_pengaturan",
    entitasId: "global",
    before: sebelum,
    after: sesudah,
    ip: getClientIp(request),
  });

  return NextResponse.json({ konfig: sesudah });
}
