import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendViaResendApi } from "@/lib/email/resend";

const forgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid."),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Email tidak valid." },
      { status: 400 },
    );
  }

  const cleanEmail = parsed.data.email.toLowerCase().trim();

  // Cari user di database kita untuk menentukan identitas & role
  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      studentProfile: { select: { nama: true } },
      partnerProfile: { select: { nama: true } },
      schoolUsers: { select: { school: { select: { nama: true } } } },
    },
  });

  // Jika email tidak terdaftar, tetap berikan respons sukses demi mencegah enumerasi akun (security best practice)
  if (!user) {
    return NextResponse.json({
      ok: true,
      message: "Jika email Anda terdaftar, tautan konfirmasi reset password telah dikirimkan ke kotak masuk email Anda.",
    });
  }

  if (user.status === "nonaktif") {
    return NextResponse.json(
      { error: "Akun Anda saat ini sedang dinonaktifkan. Silakan hubungi Admin Pusat." },
      { status: 403 },
    );
  }

  const nama =
    user.partnerProfile?.nama ??
    user.studentProfile?.nama ??
    user.schoolUsers?.[0]?.school?.nama ??
    "Pengguna AyoTKA";

  const roleLabelMap: Record<string, string> = {
    mitra: "Mitra",
    admin_sekolah: "Admin Sekolah",
    dinas_pendidikan: "Dinas Pendidikan",
    admin_pusat: "Admin Pusat",
    siswa: "Siswa",
  };
  const roleLabel = roleLabelMap[user.role] ?? "Pengguna";

  // Generate recovery link via Supabase Admin API
  const supabaseAdmin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: user.email,
  });

  if (linkError || !linkData.properties?.hashed_token) {
    console.error("Gagal generate link reset password:", linkError);
    return NextResponse.json(
      { error: "Gagal membuat tautan reset password. Silakan coba lagi beberapa saat lagi." },
      { status: 500 },
    );
  }

  // Bangun URL konfirmasi yang mengarah ke alur konfirmasi aman aplikasi
  const confirmUrl = new URL(`${appUrl}/api/auth/confirm`);
  confirmUrl.searchParams.set("token_hash", linkData.properties.hashed_token);
  confirmUrl.searchParams.set("type", "recovery");
  confirmUrl.searchParams.set("next", "/reset-password");

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="margin-bottom: 24px;">
        <span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #4338ca; background: #e0e7ff; padding: 4px 12px; border-radius: 9999px;">
          AyoTKA • Portal ${roleLabel}
        </span>
      </div>
      <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 14px 0;">
        Atur Ulang Password Akun Anda
      </h1>
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
        Halo <strong>${nama}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 24px 0;">
        Kami menerima permintaan untuk mengatur ulang password akun <strong>${roleLabel}</strong> AyoTKA Anda (${user.email}). Klik tombol konfirmasi di bawah untuk membuat password baru:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${confirmUrl.toString()}" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 14px 32px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
          Atur Ulang Password Sekarang
        </a>
      </div>
      <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 0 0 8px 0;">
        Jika tombol di atas tidak berfungsi, Anda juga dapat menyalin tautan berikut ke browser:
      </p>
      <p style="margin: 0 0 24px 0;">
        <a href="${confirmUrl.toString()}" style="font-size: 12px; color: #4f46e5; word-break: break-all; text-decoration: underline;">
          ${confirmUrl.toString()}
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
      <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 0;">
        Tautan ini bersifat rahasia dan hanya berlaku sementara waktu. Jika Anda tidak pernah meminta atur ulang password, abaikan email ini dengan aman.
      </p>
    </div>
  `;

  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    const emailResult = await sendViaResendApi({
      to: user.email,
      subject: `Konfirmasi Atur Ulang Password Akun ${roleLabel} AyoTKA`,
      html: emailHtml,
    });
    emailSent = emailResult.ok;
    if (!emailResult.ok) {
      console.warn("Resend API gagal mengirim email reset password:", emailResult.error);
    }
  }

  // Fallback: jika Resend API key belum terpasang, coba mekanisme built-in Supabase
  if (!emailSent) {
    await supabaseAdmin.auth
      .resetPasswordForEmail(user.email, {
        redirectTo: `${appUrl}/api/auth/confirm?next=/reset-password`,
      })
      .catch((err) => console.warn("Supabase reset fallback error:", err));
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[RESET PASSWORD LINK for ${user.email}]:`, confirmUrl.toString());
  }

  return NextResponse.json({
    ok: true,
    message: `Tautan atur ulang password telah dikirim ke ${user.email}. Silakan cek kotak masuk atau folder spam email Anda.`,
  });
}
