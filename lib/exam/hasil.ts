import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Attempt } from "@prisma/client";
import { shuffleWithSeed } from "@/lib/exam/shuffle";
import { wasAttemptFreeTrial } from "@/lib/billing/entitlements";
import { aggregateMateriScores } from "@/lib/exam/materi-scores";
import { buildRanking } from "@/lib/exam/ranking";

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
  const [pkg, answers, competencyScores, student, isFreeTrial] = await Promise.all([
    prisma.package.findUniqueOrThrow({
      where: { id: attempt.packageId },
    }),
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

  // Keputusan user (25 Sep 2026): pembahasan sekarang SELALU tampil langsung
  // begitu attempt selesai/kedaluwarsa - dulu digerbang assignment.selesai
  // (siswa sekolah baru lihat setelah jendela ujian ditutup), disederhanakan
  // untuk meminimalkan risiko bug dari gerbang jadwal itu. buildHasil cuma
  // dipanggil untuk attempt yang sudah difinalisasi (lihat pemanggilnya),
  // jadi selalu true di sini.
  const canShowPembahasan = true;

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

  // Keputusan user (25 Sep 2026): ranking cuma berlaku untuk Try Out Nasional
  // - Try Out Mandiri (kapan saja, sepuasnya, soal bisa diulang bebas) tidak
  // pantas dirangking bareng peserta lain. Tetap butuh skor akhir (belum
  // tentu ada untuk status "berjalan"/"paused" yang tetap bisa lewat sini
  // lewat jalur retry polling di halaman hasil).
  const ranking =
    pkg.kategori === "nasional" && attempt.skorAkhir != null
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
    package: { nama: pkg.nama },
    siswa: { nama: student.nama, idSamar: maskIdentifier(student.nisn, attempt.id) },
    canShowPembahasan,
    isFreeTrial,
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
