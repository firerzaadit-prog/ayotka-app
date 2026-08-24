import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Attempt } from "@prisma/client";
import { shuffleWithSeed } from "@/lib/exam/shuffle";

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
  const [pkg, assignment, answers, competencyScores, student] = await Promise.all([
    prisma.package.findUniqueOrThrow({ where: { id: attempt.packageId } }),
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
      include: { kompetensi: { select: { kode: true, deskripsi: true } } },
    }),
    prisma.student.findUniqueOrThrow({
      where: { id: attempt.studentId },
      select: { nama: true, nisn: true },
    }),
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
    perSoal,
    competencyScores: competencyScores.map((c) => ({
      kode: c.kompetensi.kode,
      deskripsi: c.kompetensi.deskripsi,
      jmlBenar: c.jmlBenar,
      jmlSoal: c.jmlSoal,
      persentase: c.persentase,
    })),
  };
}
