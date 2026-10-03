import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { findActiveSchoolByCode } from "@/lib/schools/lookup";
import { klaimSchema } from "@/lib/validations/registrasi";

/** Kode klaim dicetak berspasi/berhuruf kecil di kartu atau diketik tangan: samakan bentuknya sebelum dibandingkan. */
function normalisasiKode(kode: string): string {
  return kode.replace(/[\s-]+/g, "").toUpperCase();
}

/** Perbandingan waktu-konstan, supaya kode tidak bisa ditebak lewat selisih waktu respons. */
function kodeSama(masukan: string, tersimpan: string | null): boolean {
  if (!tersimpan) return false;
  const a = Buffer.from(normalisasiKode(masukan));
  const b = Buffer.from(normalisasiKode(tersimpan));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Tiket 3.2/3.4 (Bagian 3.1 brief): langkah terakhir Jalur A - verifikasi
 * kepemilikan (Kode Klaim dari kartu; tanggal lahir tidak lagi diterima), lalu buat akun Supabase Auth.
 * Kalau siswa tidak punya email (umum di SD), pakai email sintetis NISN
 * ({nisn}@nisn.ayotka.id) - tidak pernah ditampilkan ke siswa, lihat
 * keputusan #22 brief.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request) ?? "unknown";
  if (!checkRateLimit(`klaim:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan, coba lagi sebentar lagi." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = klaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Rate limit per-IP di atas tidak cukup: verifikasi tanggalLahir (satu
  // tanggal kalender) bisa ditebak habis dengan rotasi IP sederhana kalau
  // studentId targetnya sudah diketahui (lihat audit keamanan). Dikunci per
  // studentId supaya limitnya tetap berlaku siapa pun/dari mana pun
  // percobaannya datang, sebelum sentuh DB sama sekali.
  if (!checkRateLimit(`klaim:student:${data.studentId}`, 5, 5 * 60_000)) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan untuk data ini. Coba lagi nanti atau hubungi admin sekolah." },
      { status: 429 },
    );
  }

  const school = await findActiveSchoolByCode(data.kodeSekolah.toUpperCase());
  if (!school) {
    return NextResponse.json({ error: "Kode sekolah tidak valid." }, { status: 403 });
  }

  const student = await prisma.student.findUnique({ where: { id: data.studentId } });
  const genericError = NextResponse.json(
    { error: "Data tidak cocok. Periksa kembali kode klaimmu, atau minta kartu klaim ke guru atau admin sekolah." },
    { status: 400 },
  );
  if (!student || student.schoolId !== school.id || student.claimStatus !== "belum_klaim" || student.deletedAt || student.lulusAt) {
    return genericError;
  }

  // Hanya Kode Klaim dari kartu yang membuktikan kepemilikan. Tanggal lahir sengaja tidak dipakai lagi: teman
  // sekelas biasanya tahu tanggal lahir temannya, jadi pemegang Kode Sekolah bisa mengambil akun siswa lain.
  if (!kodeSama(data.kodeKlaim, student.claimToken)) {
    return genericError;
  }

  let email: string;
  if (data.punyaEmail) {
    email = data.email!;
  } else {
    if (!student.nisn) {
      return NextResponse.json(
        { error: "Siswa ini belum punya NISN terdaftar - isi email untuk mendaftar, atau minta admin sekolah menambahkan NISN." },
        { status: 400 },
      );
    }
    email = `${student.nisn}@nisn.ayotka.id`;
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "Akun untuk data ini sudah pernah dibuat. Coba masuk lewat halaman login." },
      { status: 409 },
    );
  }

  const supabaseAdmin = createAdminClient();
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
    app_metadata: { role: "siswa" },
  });
  if (authError || !authData.user) {
    return NextResponse.json(
      { error: `Gagal membuat akun: ${authError?.message ?? "unknown error"}` },
      { status: 502 },
    );
  }

  await prisma.$transaction([
    prisma.user.create({
      data: { id: authData.user.id, email, role: "siswa", status: "aktif" },
    }),
    prisma.student.update({
      where: { id: student.id },
      data: { userId: authData.user.id, claimStatus: "sudah_klaim", status: "active" },
    }),
  ]);

  await logAudit({
    userId: authData.user.id,
    aksi: "update",
    entitas: "students",
    entitasId: student.id,
    before: student,
    after: { claimStatus: "sudah_klaim", status: "active" },
    ip,
  });

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: data.password });
  if (signInError) {
    return NextResponse.json({ redirectTo: "/login" });
  }

  return NextResponse.json({ redirectTo: "/siswa/dashboard" });
}
