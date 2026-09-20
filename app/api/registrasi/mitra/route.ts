import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateUniqueReferralCode } from "@/lib/partners/create";
import { daftarMitraSchema } from "@/lib/validations/registrasi";
import { sendViaResendApi } from "@/lib/email/resend";

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

    const confirmUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/confirm`);
    confirmUrl.searchParams.set("token_hash", linkData.properties.hashed_token);
    confirmUrl.searchParams.set("type", "signup");
    confirmUrl.searchParams.set("next", "/mitra/dashboard");

    const emailResult = await sendViaResendApi({
      to: data.email,
      subject: "Konfirmasi akun Mitra AyoTKA kamu",
      html: [
        `<p>Halo ${data.nama},</p>`,
        `<p>Terima kasih sudah mendaftar sebagai mitra AyoTKA. Klik tombol di bawah untuk mengonfirmasi akunmu:</p>`,
        `<p><a href="${confirmUrl.toString()}" style="display:inline-block;padding:10px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">Konfirmasi Akun</a></p>`,
        `<p>Atau salin tautan ini ke browser: ${confirmUrl.toString()}</p>`,
        `<p>Kalau kamu tidak merasa mendaftar di AyoTKA, abaikan saja email ini.</p>`,
      ].join(""),
    });
    if (!emailResult.ok) {
      throw new Error(`Gagal mengirim email verifikasi: ${emailResult.error}`);
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
    const message = err instanceof Error ? err.message : "";
    const emailGagal = message.startsWith("Gagal mengirim email verifikasi");
    return NextResponse.json(
      {
        error: emailGagal
          ? "Akun belum bisa dibuat karena email verifikasi gagal terkirim. Pastikan alamat emailmu benar, lalu coba lagi. Kalau masih gagal, hubungi admin AyoTKA."
          : "Akun belum bisa dibuat karena terjadi gangguan. Silakan coba daftar lagi sebentar lagi.",
      },
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

  return NextResponse.json({ ok: true });
}
