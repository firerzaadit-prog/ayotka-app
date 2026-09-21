import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveKodeReferral } from "@/lib/registrasi/referral";

/**
 * Publik (dipakai halaman pendaftaran sebelum siswa punya akun): memberi tahu apakah kode
 * dikenali, supaya salah ketik atau kode yang sudah terpakai ketahuan SEBELUM daftar.
 * Yang dibuka hanya jenis kode; untuk voucher juga nama paket, nama mitra, dan apakah masih
 * bisa dipakai. Untuk kode teman tidak ada identitas apa pun yang dikembalikan.
 */
export async function GET(request: Request) {
  const ip = getClientIp(request) ?? "unknown";
  if (!checkRateLimit(`cek-referral:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak pengecekan, coba lagi sebentar lagi." }, { status: 429 });
  }

  const kode = new URL(request.url).searchParams.get("kode") ?? "";
  const hasil = await resolveKodeReferral(kode);

  const body =
    hasil?.tipe === "voucher"
      ? { tipe: "voucher" as const, status: hasil.status, paket: hasil.planNama, mitra: hasil.mitraNama }
      : hasil?.tipe === "siswa"
        ? { tipe: "siswa" as const }
        : { tipe: null };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
