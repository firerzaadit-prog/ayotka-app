import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Attempt } from "@prisma/client";
import { shuffleWithSeed } from "@/lib/exam/shuffle";
import { wasAttemptFreeTrial } from "@/lib/billing/entitlements";
import { aggregateElemenScores } from "@/lib/exam/elemen-scores";
import { buildRanking } from "@/lib/exam/ranking";
import { firstFinishedAttempt, percobaanBerjawabPertama } from "@/lib/exam/seri-mandiri";
import { bukaPaketBerikutnyaSetelah } from "@/lib/exam/seri-jadwal";
import { hitungLaporanSiswa } from "@/lib/indikator/daya-serap";

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
            indikatorResmi: true,
          },
        },
      },
    }),
    prisma.competencyScore.findMany({
      where: { attemptId: attempt.id },
      include: {
        kompetensi: {
          select: {
            deskripsi: true,
            elemen: { select: { id: true, nama: true, urutan: true } },
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

  // Keputusan user (25 Sep 2026, ditegaskan 8 Okt 2026): pembahasan dan kunci jawaban SELALU tampil langsung begitu
  // percobaan selesai/kedaluwarsa, untuk SEMUA siswa dan semua jenis ujian (Try Out Mandiri, Try Out Nasional, dan
  // Try Out Bersama sekolah) - tidak menunggu jendela ujian ditutup. Dulu digerbang assignment.selesai; gerbang itu
  // sudah dihapus seluruhnya (tidak ada lagi cabang "pembahasan disembunyikan"). buildHasil cuma dipanggil untuk
  // percobaan yang sudah difinalisasi (lihat pemanggilnya).

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

  // Permintaan user (30 Sep 2026): Try Out Mandiri boleh diulang berkali-kali,
  // tapi rapor PDF cuma untuk percobaan PERTAMA pada paket itu - percobaan
  // berikutnya tetap tersimpan & tampil di riwayat/halaman ini (nilai, rincian
  // jawaban, dst), cuma tombol unduh rapornya yang disembunyikan/ditolak.
  // Ujian Terjadwal (assignmentId terisi) dan Try Out Nasional tidak kena
  // aturan ini - lihat lib/exam/seri-mandiri.ts.
  let bisaUnduhRapor = true;
  if (attempt.assignmentId === null && pkg.kategori === "mandiri") {
    const pertama = await firstFinishedAttempt(attempt.studentId, attempt.packageId);
    bisaUnduhRapor = pertama == null || pertama.id === attempt.id;
  }

  // Paket berseri (Try Out Mandiri): beri tahu kapan paket berikutnya di seri terbuka (06.00 WIB pertama setelah
  // selesai - lib/exam/seri-jadwal.ts) pada percobaan yang PERTAMA kali dihitung "sudah mengerjakan" (selesai dan
  // minimal satu soal terjawab). Kalau percobaan ini selesai tapi belum ada satu pun percobaan paket ini yang
  // punya soal terjawab, siswa diberi tahu bahwa paket berikutnya belum terbuka. Pengerjaan ulang, Ujian Terjadwal,
  // dan paket yang tidak berseri tidak mendapat keterangan ini.
  let bukaPaketBerikutnya: Date | null = null;
  let paketBerseriBelumTerjawab = false;
  if (
    attempt.assignmentId === null &&
    pkg.kategori === "mandiri" &&
    pkg.urutanSeri != null &&
    (attempt.status === "selesai" || attempt.status === "kedaluwarsa")
  ) {
    const pertama = await percobaanBerjawabPertama(attempt.studentId, attempt.packageId);
    if (pertama == null) paketBerseriBelumTerjawab = true;
    else if (pertama.id === attempt.id) bukaPaketBerikutnya = bukaPaketBerikutnyaSetelah(pertama.percobaan);
  }

  // Daya serap per indikator resmi Pusmendik (null bila tak ada soal yang tertaut ke indikator resmi: bagian tak ditampilkan).
  const indikator = hitungLaporanSiswa(
    answers.map((a) => {
      const r = a.question.indikatorResmi;
      return {
        indikator: r
          ? {
              id: r.id,
              jenjang: r.jenjang,
              namaMapel: r.namaMapel,
              elemen: r.elemen,
              subelemen: r.subelemen,
              kompetensi: r.kompetensi,
              indikator: r.indikator,
              urutan: r.urutan,
              nilaiNasional: r.nilaiNasional,
            }
          : null,
        skor: a.skor,
        skorMaks: a.skorMaks,
      };
    }),
  );

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
    // Selalu true. Tetap dikirim hanya demi halaman lama yang masih terbuka di peramban siswa saat versi baru
    // dipasang (yang membaca bidang ini); kode baru tidak lagi memakainya.
    canShowPembahasan: true as const,
    isFreeTrial,
    // Siswa gratis yang MENYALAKAN Learning Analytics (dibayar saldo) tetap berhak
    // melihat hasil analisisnya - teaser blur hanya untuk yang tidak memintanya.
    analisisAiDiminta: attempt.analisisAiDiminta,
    bisaUnduhRapor,
    bukaPaketBerikutnya,
    paketBerseriBelumTerjawab,
    ranking,
    perSoal,
    indikator,
    competencyScores: competencyScores.map((c) => ({
      deskripsi: c.kompetensi.deskripsi,
      jmlBenar: c.jmlBenar,
      jmlSoal: c.jmlSoal,
      persentase: c.persentase,
    })),
    // Bagian 8.7 brief: Peta Kompetensi ditampilkan per Elemen (bukan per
    // Kompetensi butir halus) di web & PDF - lihat lib/exam/elemen-scores.ts.
    elemenScores: aggregateElemenScores(
      competencyScores.map((c) => ({
        elemenId: c.kompetensi.elemen.id,
        elemenNama: c.kompetensi.elemen.nama,
        elemenUrutan: c.kompetensi.elemen.urutan,
        jmlBenar: c.jmlBenar,
        jmlSoal: c.jmlSoal,
      })),
    ),
  };
}
