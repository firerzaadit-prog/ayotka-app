import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Attempt } from "@prisma/client";
import { shuffleWithSeed } from "@/lib/exam/shuffle";
import { wasAttemptFreeTrial } from "@/lib/billing/entitlements";
import { aggregateMateriScores } from "@/lib/exam/materi-scores";
import { buildRanking } from "@/lib/exam/ranking";

/**
 * Tiket 4.10 + Bagian 7.1 brief ("Tampil pembahasan"): siswa sekolah (Jalur
 * A) baru lihat pembahasan setelah jendela ujian ditutup (mencegah bocor ke
 * teman sekelas yang belum selesai); siswa mandiri (Jalur B) & latihan
 * tanpa penugasan langsung lihat begitu submit. package.mode_pembahasan
 * "langsung" selalu menang; "setelah_tutup" digerbang oleh assignment.selesai.
 */
/**
 * Tiket 5.9: ID separuh disamarkan untuk watermark - cukup untuk dilacak
 * balik oleh admin kalau ada kebocoran soal, tapi tidak menampilkan NISN
 * penuh ke siapa pun yang melihat/screenshot halaman.
 */
function maskIdentifier(nisn: string | null, attemptId: string): string {
  if (nisn && nisn.length >= 5) {
    return `${nisn.slice(0, 3)}${"*".repeat(Math.max(0, nisn.length - 5))}${nisn.slice(-2)}`;
  }
  return `ID-${attemptId.slice(0, 8)}`;
}

export async function buildHasil(attempt: Attempt) {
  const [pkg, assignment, answers, competencyScores, student, isFreeTrial] = await Promise.all([
    prisma.package.findUniqueOrThrow({
      where: { id: attempt.packageId },
      include: { tryOutGroup: { select: { nama: true } } },
    }),
    attempt.assignmentId
      ? prisma.assignment.findUnique({ where: { id: attempt.assignmentId } })
      : Promise.resolve(null),
    prisma.attemptAnswer.findMany({
      where: { attemptId: attempt.id },
      include: {
        question: {
          include: {
            options: { orderBy: { urutan: "asc" } },
            statements: { orderBy: { urutan: "asc" } },
            categories: { orderBy: { urutan: "asc" } },
          },
        },
      },
    }),
    prisma.competencyScore.findMany({
      where: { attemptId: attempt.id },
      include: {
        kompetensi: {
          select: {
            kode: true,
            deskripsi: true,
            subMateri: { select: { materi: { select: { id: true, nama: true, urutan: true } } } },
          },
        },
      },
    }),
    prisma.student.findUniqueOrThrow({
      where: { id: attempt.studentId },
      select: { nama: true, nisn: true },
    }),
    wasAttemptFreeTrial(attempt.studentId, attempt.mulaiAt),
  ]);

  const canShowPembahasan =
    pkg.modePembahasan === "langsung" || !assignment || assignment.selesai.getTime() < Date.now();

  // Urutan+label opsi & baris di sini HARUS sama persis dengan yang dilihat
  // siswa saat mengerjakan (lihat app/api/siswa/attempts/[id]/route.ts,
  // seed yang sama) - kalau balik ke urutan/label asli DB, halaman review
  // jadi tidak cocok dengan yang benar-benar dipilih siswa saat ujian
  // berlangsung (mis. "kunci"-nya kelihatan pindah ke opsi lain).
  const perSoal = answers.map((a) => {
    const q = a.question;
    const orderedOptions = pkg.acakOpsi
      ? shuffleWithSeed(q.options, `${attempt.id}:opsi:${q.id}`)
      : q.options;
    const orderedStatements = shuffleWithSeed(q.statements, `${attempt.id}:baris:${q.id}`);

    return {
      questionId: a.questionId,
      format: q.format,
      teks: q.teks,
      media: q.media,
      jawabanJson: a.jawabanJson,
      skor: a.skor,
      skorMaks: a.skorMaks,
      ...(canShowPembahasan
        ? {
            pembahasan: q.pembahasan,
            categories: q.categories.map((c) => ({ id: c.id, label: c.label })),
            options: orderedOptions.map((o, idx) => ({
              id: o.id,
              label: String.fromCharCode(65 + idx),
              teks: o.teks,
              isCorrect: o.isCorrect,
            })),
            statements: orderedStatements.map((s) => ({
              id: s.id,
              teks: s.teks,
              correctLabel: q.categories.find((c) => c.id === s.correctCategoryId)?.label ?? "-",
            })),
          }
        : {}),
    };
  });

  // Bagian 8/10 (permintaan user): "setiap ada try out ada ranking" - hanya
  // untuk paket Try Out (bukan Latihan), dan hanya kalau attempt ini sudah
  // punya skor akhir (belum tentu true untuk status "berjalan"/"paused" yang
  // tetap bisa lewat sini lewat jalur retry polling di halaman hasil).
  const ranking =
    pkg.jenisPaket === "tryout" && attempt.skorAkhir != null
      ? await buildRanking(attempt.packageId, attempt.studentId)
      : null;

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      skorMentah: attempt.skorMentah,
      skorAkhir: attempt.skorAkhir,
      mulaiAt: attempt.mulaiAt,
      selesaiAt: attempt.selesaiAt,
    },
    // Bagian 8/10: kalau paket ini salah satu variasi dari TryOutGroup, tampilkan
    // nama GRUP-nya (mis. "Try Out Januari") - nama paket sendiri cuma label
    // internal admin untuk variasinya (mis. "Variasi A"), tidak berarti apa-apa buat siswa.
    package: { nama: pkg.tryOutGroup?.nama ?? pkg.nama },
    siswa: { nama: student.nama, idSamar: maskIdentifier(student.nisn, attempt.id) },
    canShowPembahasan,
    isFreeTrial,
    // Bagian 8/10 (permintaan user): paket Latihan tidak pernah dapat
    // analisis AI, berlaku di semua jalur - independen dari status
    // free-trial/berlangganan (lihat lib/ai/auto-trigger.ts).
    isLatihan: pkg.jenisPaket === "latihan",
    ranking,
    perSoal,
    competencyScores: competencyScores.map((c) => ({
      kode: c.kompetensi.kode,
      deskripsi: c.kompetensi.deskripsi,
      jmlBenar: c.jmlBenar,
      jmlSoal: c.jmlSoal,
      persentase: c.persentase,
    })),
    // Bagian 8.7 brief: Peta Kompetensi ditampilkan per Materi (bukan per
    // Kompetensi butir halus) di web & PDF - lihat lib/exam/materi-scores.ts.
    materiScores: aggregateMateriScores(
      competencyScores.map((c) => ({
        materiId: c.kompetensi.subMateri.materi.id,
        materiNama: c.kompetensi.subMateri.materi.nama,
        materiUrutan: c.kompetensi.subMateri.materi.urutan,
        jmlBenar: c.jmlBenar,
        jmlSoal: c.jmlSoal,
      })),
    ),
  };
}
