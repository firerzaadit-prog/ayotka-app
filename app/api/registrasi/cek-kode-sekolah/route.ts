import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { findActiveSchoolByCode } from "@/lib/schools/lookup";
import { cekKodeSekolahSchema } from "@/lib/validations/registrasi";

export async function POST(request: Request) {
  const ip = getClientIp(request) ?? "unknown";
  if (!checkRateLimit(`cek-kode-sekolah:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan, coba lagi sebentar lagi." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = cekKodeSekolahSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Kode sekolah wajib diisi." }, { status: 400 });
  }

  const school = await findActiveSchoolByCode(parsed.data.kodeSekolah.toUpperCase());
  if (!school) {
    return NextResponse.json(
      { error: "Kode sekolah tidak ditemukan atau sekolah belum aktif." },
      { status: 404 },
    );
  }

  return NextResponse.json({ nama: school.nama });
}
