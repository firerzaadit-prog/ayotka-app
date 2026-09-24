import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateUniqueReferralCode } from "@/lib/partners/create";
import { daftarMitraSchema } from "@/lib/validations/registrasi";
import { kirimEmailKonfirmasi, pesanEmailBelumTerkirim } from "@/lib/email/konfirmasi";

/**
 * Bagian A (permintaan user): mitra/reseller daftar sendiri tanpa perlu
 * menghubungi admin pusat - akun LANGSUNG AKTIF begitu email dikonfirmasi
 * (tidak ada gerbang approval admin, beda dari sekolah/siswa mandiri yang
 * datanya perlu diverifikasi tim). Pola email konfirmasi sama persis dengan
 * /api/registrasi/mandiri (generateLink + kirim manual lewat Resend, lihat
 * catatan di sana untuk alasannya).
 */
export async function POST(request: Request) {
  const ip = getClientIp(request) ?? "unknown";
  if (!checkRateLimit(`registrasi-mitra:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan, coba lagi sebentar lagi." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = daftarMitraSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    return NextResponse.json({ error: "Email ini sudah dipakai akun lain." }, { status: 409 });
  }

  const referralCode = await generateUniqueReferralCode();
  const supabaseAdmin = createAdminClient();

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "signup",
    email: data.email,
    password: data.password,
    options: { data: { nama: data.nama } },
  });
  if (linkError || !linkData.user || !linkData.properties) {
    return NextResponse.json(
      { error: `Gagal membuat akun: ${linkError?.message ?? "unknown error"}` },
      { status: 502 },
    );
  }
  const authUser = linkData.user;

  try {
    const { error: roleError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      app_metadata: { role: "mitra" },
    });
    if (roleError) {
      throw new Error(`Gagal menyiapkan akun: ${roleError.message}`);
    }

    await prisma.$transaction([
      prisma.user.create({
        data: { id: authUser.id, email: data.email, role: "mitra", status: "aktif" },
      }),
      prisma.partner.create({
        data: {
          userId: authUser.id,
          nama: data.nama,
          kontak: data.kontak && data.kontak.length > 0 ? data.kontak : null,
          referralCode,
        },
      }),
    ]);
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.id).catch(() => {});
    console.error("[registrasi-mitra] gagal membuat akun:", err);
    return NextResponse.json(
      { error: "Akun belum bisa dibuat karena terjadi gangguan. Silakan coba daftar lagi sebentar lagi." },
      { status: 502 },
    );
  }

  await logAudit({
    userId: authUser.id,
    aksi: "create",
    entitas: "partners",
    entitasId: authUser.id,
    after: { email: data.email, nama: data.nama, referralCode },
    ip,
  });

  // Sama seperti /api/registrasi/mandiri: email dikirim setelah akun tersimpan,
  // kegagalannya tidak menghapus akun (ada tombol kirim ulang di layar).
  const emailResult = await kirimEmailKonfirmasi({
    email: data.email,
    nama: data.nama,
    tokenHash: linkData.properties.hashed_token,
    type: "signup",
    peran: "mitra",
  });
  if (!emailResult.ok) {
    console.error("[registrasi-mitra] akun dibuat tapi email konfirmasi gagal:", emailResult.error);
    return NextResponse.json({
      ok: true,
      emailTerkirim: false,
      pesan: pesanEmailBelumTerkirim(emailResult.kuotaHabis),
    });
  }

  return NextResponse.json({ ok: true, emailTerkirim: true });
}
