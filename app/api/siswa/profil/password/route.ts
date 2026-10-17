import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifikasiPasswordSaatIni } from "@/lib/auth/verifikasi-password";
import { adalahEmailSintetis } from "@/lib/billing/pembayaran-affiliate";
import { buatEmailPasswordDiubah, kirimPemberitahuanAkun } from "@/lib/email/profil";
import { emailKontakTerverifikasi, labelNisnTersamar } from "@/lib/siswa/email-kontak";
import { gantiPasswordSchema } from "@/lib/validations/profil";
import { asalPublik } from "@/lib/utils/asal-publik";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Percobaan ganti password per siswa: cukup longgar untuk salah ketik, cukup ketat untuk menebak password lama. */
const BATAS_PERCOBAAN = 5;
const JENDELA_MS = 15 * 60_000;

/**
 * Siswa mengganti passwordnya sendiri. Wajib mengirim password SAAT INI (diperiksa ke layanan login lewat klien
 * sementara, sesi pengguna tidak berubah): sesi curian atau komputer yang ditinggal terbuka saja tidak cukup untuk
 * merebut akun. Password baru disimpan lewat Admin API layanan login; password tidak pernah ditulis ke log atau audit.
 * Pemberitahuan dikirim ke email akun; akun NISN (email sintetis) ke email kontaknya yang sudah terverifikasi, dan
 * dilewati bila belum punya. Gagal kirim tidak membatalkan perubahan.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return json({ error: "Tidak diizinkan." }, 403);
  }

  if (!checkRateLimit(`profil-password:${user.id}`, BATAS_PERCOBAAN, JENDELA_MS)) {
    return json({ error: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit." }, 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = gantiPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, 400);
  }
  const { passwordLama, passwordBaru } = parsed.data;

  const verifikasi = await verifikasiPasswordSaatIni(user.email, passwordLama);
  if (verifikasi === "salah") return json({ error: "Password saat ini salah." }, 400);
  if (verifikasi === "dibatasi") return json({ error: "Sistem sedang ramai. Tunggu beberapa saat lalu coba lagi." }, 429);
  if (verifikasi === "layanan") {
    return json({ error: "Layanan masuk sedang gangguan, password belum bisa diubah. Coba lagi beberapa saat lagi." }, 503);
  }

  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, { password: passwordBaru });
  if (error) {
    console.error("[profil-password] gagal menyimpan password baru:", error.message);
    return json({ error: "Password belum bisa diubah karena terjadi gangguan. Silakan coba lagi." }, 502);
  }

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "users",
    entitasId: user.id,
    after: { aksi: "ganti_password_mandiri" },
    ip: getClientIp(request),
  });

  // Pemberitahuan keamanan: ke email akun; akun NISN (email sintetis tanpa kotak surat) ke email kontaknya bila sudah
  // diverifikasi, dan dilewati bila belum punya.
  let pemberitahuan: boolean | null = null;
  const siswa = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { nama: true, nisn: true, emailKontak: true, emailKontakVerifiedAt: true },
  });
  if (!adalahEmailSintetis(user.email)) {
    const hasil = await kirimPemberitahuanAkun(
      user.email,
      buatEmailPasswordDiubah({ nama: siswa?.nama ?? "", email: user.email, waktu: new Date(), asal: asalPublik(request) }),
    );
    pemberitahuan = hasil.ok;
  } else {
    const kontak = siswa ? emailKontakTerverifikasi(siswa) : null;
    if (siswa && kontak) {
      const hasil = await kirimPemberitahuanAkun(
        kontak,
        buatEmailPasswordDiubah({ nama: siswa.nama, email: labelNisnTersamar(siswa.nisn), waktu: new Date(), asal: asalPublik(request) }),
      );
      pemberitahuan = hasil.ok;
    }
  }

  return json({ ok: true, pemberitahuan });
}
