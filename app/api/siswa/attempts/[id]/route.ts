import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { loadOwnedAttempt, sanitizeAttemptForClient } from "@/lib/exam/attempt-access";
import { getRemainingSeconds } from "@/lib/exam/timing";
import { shuffleWithSeed } from "@/lib/exam/shuffle";
import { buildHasil } from "@/lib/exam/hasil";
import { hitungOpsiLaSusulan } from "@/lib/billing/la-susulan";
import { infoTutorHalaman } from "@/lib/tutor/penyimpanan";
import { checkAndClaimSession } from "@/lib/exam/session-guard";
import { susunRiwayatPercobaan } from "@/lib/exam/percobaan";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Tiket 4.4/4.5-4.7: soal untuk halaman pengerjaan. Bagian 9 brief:
 * "kunci jawaban tidak pernah dikirim ke browser sebelum ujian selesai" -
 * is_correct, correct_category_id, dan pembahasan SENGAJA tidak pernah
 * disertakan di sini selama status masih berjalan/paused.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const attempt = await loadOwnedAttempt(user.id, id);
  if (!attempt) {
    return NextResponse.json({ error: "Attempt tidak ditemukan." }, { status: 404 });
  }

  if (attempt.status === "paused") {
    return NextResponse.json({ attempt: sanitizeAttemptForClient(attempt), questions: [], answers: [] });
  }

  if (attempt.status === "selesai" || attempt.status === "kedaluwarsa") {
    // Riwayat percobaan siswa ini pada paket (& jalur) yang sama, untuk kartu "Percobaan pada
    // Paket Ini" di halaman hasil - lihat lib/exam/percobaan.ts.
    // laSusulan (apa yang bisa dilakukan siswa untuk Learning Analytics di percobaan ini) sengaja dihitung HANYA di
    // sini, bukan di buildHasil: buildHasil juga dipakai halaman admin dan rapor PDF, yang tidak boleh membaca saldo siswa.
    const [hasil, attemptsPaket, laSusulan, tutorAi] = await Promise.all([
      buildHasil(attempt),
      prisma.attempt.findMany({
        where: { studentId: attempt.studentId, packageId: attempt.packageId, assignmentId: attempt.assignmentId },
        select: {
          id: true,
          packageId: true,
          assignmentId: true,
          status: true,
          skorAkhir: true,
          mulaiAt: true,
          selesaiAt: true,
        },
      }),
      // Kegagalan menghitung opsi (mis. DB sesaat bermasalah) tidak boleh merusak halaman hasil: tanpa opsi, halaman
      // tetap menampilkan nilai dan pembahasan, hanya tombol Learning Analytics susulan yang tidak muncul.
      hitungOpsiLaSusulan(attempt).catch((err) => {
        console.error(`[hasil] gagal menghitung opsi Learning Analytics susulan untuk attempt ${attempt.id}:`, err);
        return null;
      }),
      // Status Tanya Tutor AI (aktif bila Learning Analytics percobaan ini sudah jadi + sisa pesan hari ini). Sama
      // seperti laSusulan: gagal menghitung tidak boleh merusak halaman hasil, tombol Tutor saja yang tidak muncul.
      infoTutorHalaman(attempt).catch((err) => {
        console.error(`[hasil] gagal menghitung status Tanya Tutor AI untuk attempt ${attempt.id}:`, err);
        return null;
      }),
    ]);
    return NextResponse.json({ ...hasil, laSusulan, tutorAi, percobaan: susunRiwayatPercobaan(attemptsPaket, attempt.id) });
  }

  // Tiket 4.13: satu sesi aktif per attempt - tab/device lain yang masih
  // aktif mengerjakan attempt yang sama ditolak di sini.
  const tabToken = request.nextUrl.searchParams.get("tabToken");
  // Tanpa tabToken hanya status yang dikirim (dipakai halaman hasil yang
  // menunggu finalize selesai). Soal & jawaban hanya untuk tab yang ikut aturan
  // satu sesi aktif - dulu tabToken opsional, jadi perangkat kedua cukup tidak
  // mengirimnya untuk melewati batas satu sesi per ujian.
  if (!tabToken) {
    return NextResponse.json({ attempt: sanitizeAttemptForClient(attempt), questions: [], answers: [] });
  }
  if (!(await checkAndClaimSession(attempt.id, tabToken))) {
    return NextResponse.json(
      { error: "SESI_DIAMBIL_ALIH", message: "Ujian ini sedang dibuka di tab/perangkat lain." },
      { status: 409 },
    );
  }

  const [pkg, questions, answers] = await Promise.all([
    prisma.package.findUniqueOrThrow({
      where: { id: attempt.packageId },
      include: { subject: { select: { nama: true } } },
    }),
    prisma.question.findMany({
      where: { packageId: attempt.packageId, deletedAt: null },
      include: {
        options: { orderBy: { urutan: "asc" } },
        categories: { orderBy: { urutan: "asc" } },
        statements: { orderBy: { urutan: "asc" } },
      },
    }),
    prisma.attemptAnswer.findMany({ where: { attemptId: attempt.id } }),
  ]);

  const orderedQuestions = pkg.acakSoal ? shuffleWithSeed(questions, `${attempt.id}:soal`) : questions;

  const sanitizedQuestions = orderedQuestions.map((q) => {
    const options = pkg.acakOpsi
      ? shuffleWithSeed(q.options, `${attempt.id}:opsi:${q.id}`)
      : q.options;
    return {
      id: q.id,
      format: q.format,
      teks: q.teks,
      media: q.media,
      bobot: q.bobot,
      // Label A/B/C/D dihitung ulang dari posisi tampil setelah acak, bukan
      // label asli tersimpan - kalau tetap pakai label asli, urutannya jadi
      // "C, B, A, D" dsb. yang justru membongkar bahwa opsinya diacak.
      options: options.map((o, idx) => ({
        id: o.id,
        label: String.fromCharCode(65 + idx),
        teks: o.teks,
        media: o.media,
      })),
      categories: q.categories.map((c) => ({ id: c.id, label: c.label })),
      statements: shuffleWithSeed(q.statements, `${attempt.id}:baris:${q.id}`).map((s) => ({
        id: s.id,
        teks: s.teks,
        media: s.media,
      })),
    };
  });

  return NextResponse.json({
    attempt: { ...sanitizeAttemptForClient(attempt), sisaDetik: getRemainingSeconds(attempt) },
    package: { nama: pkg.nama, durasiMenit: pkg.durasiMenit, subjectNama: pkg.subject.nama },
    questions: sanitizedQuestions,
    answers: answers.map((a) => ({
      questionId: a.questionId,
      jawabanJson: a.jawabanJson,
      ragu: a.ragu,
    })),
  });
}
