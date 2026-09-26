import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/audit/log";
import { kirimEmailKonfirmasi, pesanEmailBelumTerkirim } from "@/lib/email/konfirmasi";

const schema = z.object({ email: z.string().email("Format email tidak valid.") });

const PESAN_UMUM =
  "Kalau emailmu terdaftar dan belum dikonfirmasi, email konfirmasi baru sudah dikirim. Cek kotak masuk dan folder spam.";

/**
 * Kirim ulang email konfirmasi pendaftaran (siswa mandiri & mitra) - dipakai
 * saat email awal gagal terkirim (kuota Resend habis/gangguan sesaat, lihat
 * app/api/registrasi/mandiri) atau tidak sampai. Sengaja memakai tautan
 * "magiclink" dari Supabase: terbukti (uji langsung) bahwa memverifikasinya
 * pada akun yang belum terkonfirmasi ikut mengonfirmasi emailnya, dan tidak
 * butuh password asli siswa seperti tipe "signup".
 *
 * Respons dibuat seragam untuk email yang tidak terdaftar / sudah
 * terkonfirmasi supaya endpoint ini tidak bisa dipakai menebak email mana
 * yang punya akun. Dibatasi per IP dan per email supaya tidak bisa dipakai
 * membanjiri kotak masuk orang lain atau menghabiskan kuota email kita.
 */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Email tidak valid." },
      { status: 400 },
    );
  }
  const email = parsed.data.email.toLowerCase().trim();
  const ip = getClientIp(request) ?? "unknown";

  if (
    !checkRateLimit(`kirim-ulang:ip:${ip}`, 10, 10 * 60_000) ||
    !checkRateLimit(`kirim-ulang:email:${email}`, 3, 10 * 60_000)
  ) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan kirim ulang. Coba lagi beberapa menit lagi." },
      { status: 429 },
    );
  }

  // Tidak peka huruf besar/kecil: baris lama bisa tersimpan dengan huruf kapital.
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      studentProfile: { select: { nama: true } },
      partnerProfile: { select: { nama: true } },
    },
  });
  if (!user || user.status === "nonaktif" || (user.role !== "siswa" && user.role !== "mitra")) {
    return NextResponse.json({ ok: true, message: PESAN_UMUM });
  }

  const supabaseAdmin = createAdminClient();
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(user.id);
  if (authError || !authData.user || authData.user.email_confirmed_at) {
    return NextResponse.json({ ok: true, message: PESAN_UMUM });
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (linkError || !linkData.properties?.hashed_token) {
    console.error("[kirim-ulang-konfirmasi] gagal membuat tautan:", linkError);
    return NextResponse.json(
      { error: "Belum bisa membuat tautan konfirmasi. Coba lagi beberapa saat lagi." },
      { status: 503 },
    );
  }

  const nama = user.studentProfile?.nama ?? user.partnerProfile?.nama ?? "Pengguna AyoTKA";
  const hasil = await kirimEmailKonfirmasi({
    email: user.email,
    nama,
    tokenHash: linkData.properties.hashed_token,
    type: "magiclink",
    peran: user.role === "mitra" ? "mitra" : "siswa",
  });
  if (!hasil.ok) {
    console.error("[kirim-ulang-konfirmasi] email gagal terkirim:", hasil.error);
    return NextResponse.json({ error: pesanEmailBelumTerkirim(hasil.kuotaHabis) }, { status: 503 });
  }

  return NextResponse.json({ ok: true, message: PESAN_UMUM });
}
