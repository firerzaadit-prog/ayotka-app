import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { loadOwnedAttempt } from "@/lib/exam/attempt-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { tutorBodySchema } from "@/lib/tutor/validasi";
import { susunKonteksTutor } from "@/lib/tutor/konteks-soal";
import { tanyaTutorAi } from "@/lib/tutor/klien-ai";
import { batasHarianTutor, lepasReservasi, reservasiPesan, ringkasanTutor } from "@/lib/tutor/penggunaan";

// Layanan Tutor AI bisa membutuhkan puluhan detik (ada pergantian model cadangan di sisinya).
export const maxDuration = 90;

type RouteParams = { params: Promise<{ id: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Status Tanya Tutor AI untuk satu percobaan: aktif atau tidak, dan sisa pesan hari ini. */
export async function GET(_request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return json({ error: "Tidak diizinkan." }, 403);
  }
  const { id } = await params;
  const attempt = await loadOwnedAttempt(user.id, id);
  if (!attempt) return json({ error: "Attempt tidak ditemukan." }, 404);
  return json(await ringkasanTutor(attempt));
}

/**
 * Siswa bertanya ke Tutor AI tentang satu soal di halaman pembahasan. Syarat: percobaan milik siswa dan sudah selesai,
 * Learning Analytics percobaan itu sudah jadi (Tutor adalah bagiannya), dan batas pesan harian belum tercapai.
 * Konteks soal (soal, opsi, kunci, pembahasan, jawaban siswa) DISUSUN SERVER dari database - klien hanya mengirim id
 * soal dan percakapannya - lalu layanan Tutor AI dipanggil dari server. Pesan dicatat sebagai reservasi sebelum AI
 * dipanggil (batas tak bisa ditembus permintaan serentak) dan dilepas lagi bila AI gagal menjawab.
 */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return json({ error: "Tidak diizinkan." }, 403);
  }

  const { id } = await params;
  const attempt = await loadOwnedAttempt(user.id, id);
  if (!attempt) return json({ error: "Attempt tidak ditemukan." }, 404);
  if (attempt.status !== "selesai" && attempt.status !== "kedaluwarsa") {
    return json({ error: "Ujian belum selesai, pembahasan belum bisa ditanyakan.", code: "BELUM_SELESAI" }, 409);
  }

  // Pembatas laju per siswa (menahan banjir permintaan); batas HARIAN yang sebenarnya ada di reservasi di bawah.
  if (!checkRateLimit(`tutor:${attempt.studentId}`, 10, 60_000)) {
    return json({ error: "Terlalu cepat. Tunggu sebentar lalu kirim lagi.", code: "TERLALU_SERING" }, 429);
  }

  const parsed = tutorBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid.", code: "DATA_TIDAK_VALID" }, 400);
  }
  const body = parsed.data;

  const ringkasan = await ringkasanTutor(attempt);
  if (!ringkasan.aktif) {
    return json(
      {
        error: "Tanya Tutor AI aktif untuk ujian yang Learning Analytics-nya sudah jadi. Jalankan Learning Analytics dulu di halaman hasil.",
        code: "TUTOR_TIDAK_AKTIF",
      },
      403,
    );
  }

  const [jawaban, pkg] = await Promise.all([
    prisma.attemptAnswer.findUnique({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: body.questionId } },
      select: {
        jawabanJson: true,
        question: {
          select: {
            id: true,
            format: true,
            teks: true,
            pembahasan: true,
            options: { select: { id: true, teks: true, isCorrect: true, urutan: true } },
            statements: { select: { id: true, teks: true, correctCategoryId: true, urutan: true } },
            categories: { select: { id: true, label: true, urutan: true } },
            stimulus: { select: { konten: true, judul: true } },
          },
        },
      },
    }),
    prisma.package.findUniqueOrThrow({
      where: { id: attempt.packageId },
      select: { acakOpsi: true, jenjang: true, subject: { select: { nama: true } } },
    }),
  ]);
  if (!jawaban) return json({ error: "Soal tidak ditemukan di percobaan ini.", code: "SOAL_TIDAK_ADA" }, 404);

  const konteks = susunKonteksTutor({
    attemptId: attempt.id,
    acakOpsi: pkg.acakOpsi,
    jenjang: pkg.jenjang,
    mapel: pkg.subject.nama,
    soal: jawaban.question,
    jawabanJson: jawaban.jawabanJson,
  });

  const batas = batasHarianTutor();
  const reservasi = await reservasiPesan({ studentId: attempt.studentId, attemptId: attempt.id, questionId: body.questionId }, batas);
  if (!reservasi.ok) {
    return json(
      { error: `Batas ${batas} pesan Tutor AI hari ini sudah tercapai. Coba lagi besok.`, code: "BATAS_HARIAN", sisaHariIni: 0 },
      429,
    );
  }

  let hasil;
  try {
    hasil = await tanyaTutorAi({ konteks, pesan: body.messages, gambar: body.gambar });
  } catch (err) {
    // Jaring pengaman: apa pun yang terjadi, jatah siswa tidak boleh hilang tanpa jawaban.
    console.error("[tutor] galat tak terduga saat memanggil layanan:", err);
    hasil = { ok: false as const, alasan: "jaringan" as const };
  }
  if (!hasil.ok) {
    await lepasReservasi(reservasi.id).catch((err) => console.error("[tutor] gagal melepas reservasi:", err));
    return json(
      {
        error: "Tutor AI sedang sibuk atau tidak bisa dihubungi. Jatah pesanmu tidak terpakai, coba lagi sebentar lagi.",
        code: "TUTOR_GAGAL",
      },
      502,
    );
  }

  return json({ balasan: hasil.balasan, sisaHariIni: reservasi.sisaSetelah });
}
