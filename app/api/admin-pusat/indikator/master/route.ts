import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseMasterJson } from "@/lib/indikator/master";
import { simpanMaster } from "@/lib/indikator/master-simpan";

/** Berkas master asli sekitar 125 KB; batas ini murah hati tetapi mencegah badan permintaan yang sangat besar. */
const MAKS_BYTE = 2_000_000;

/**
 * Unggah master indikator resmi Pusmendik (isi kemendikdasmen-official.json: larik indikator). Seluruh berkas divalidasi
 * dulu - satu baris cacat menolak SEMUANYA - lalu disimpan dalam satu transaksi. Aman diulang (unggah ulang memperbarui
 * nilai nasional dan hierarki; tidak ada indikator yang dihapus).
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  if (!checkRateLimit(`indikator-master:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan, coba lagi sebentar lagi." }, { status: 429 });
  }

  const panjang = Number(request.headers.get("content-length") ?? 0);
  if (panjang > MAKS_BYTE) {
    return NextResponse.json({ error: "Berkas terlalu besar (maksimal 2 MB)." }, { status: 413 });
  }
  const teks = await request.text();
  if (teks.length > MAKS_BYTE) {
    return NextResponse.json({ error: "Berkas terlalu besar (maksimal 2 MB)." }, { status: 413 });
  }
  let isi: unknown;
  try {
    isi = JSON.parse(teks);
  } catch {
    return NextResponse.json({ error: "Isi berkas bukan JSON yang valid." }, { status: 400 });
  }

  const hasil = parseMasterJson(isi);
  if (!hasil.ok) {
    return NextResponse.json({ error: "Berkas master tidak valid - tidak ada yang disimpan.", galat: hasil.galat }, { status: 400 });
  }

  let ringkas;
  try {
    ringkas = await simpanMaster(prisma, hasil.baris);
  } catch (err) {
    console.error("Gagal menyimpan master indikator", err);
    return NextResponse.json({ error: "Gagal menyimpan master indikator. Tidak ada yang berubah." }, { status: 500 });
  }

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "indikator_resmi",
    entitasId: "master",
    after: ringkas,
    ip: getClientIp(request),
  });

  return NextResponse.json({ hasil: ringkas });
}
