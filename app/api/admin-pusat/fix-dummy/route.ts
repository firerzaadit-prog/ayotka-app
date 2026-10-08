import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

export async function GET() {
  const user = await requireRole("admin_pusat");

  const school = await prisma.school.findFirst({
    where: { nama: { contains: "Sekolah Test Kuota" } },
  });

  if (!school) {
    return NextResponse.json({ error: "School not found!" }, { status: 404 });
  }

  const students = await prisma.student.findMany({
    where: { schoolId: school.id },
  });

  let studentIndex = 0;
  for (const student of students) {
    const attempts = await prisma.attempt.findMany({
      where: { studentId: student.id, status: "selesai" },
      include: {
        answers: true,
        competencyScores: true,
      },
    });

    for (const attempt of attempts) {
      let targetSkorAkhir = 0;
      const bucket = studentIndex % 4;
      if (bucket === 0) targetSkorAkhir = 95 + Math.random() * 4; // Istimewa
      else if (bucket === 1) targetSkorAkhir = 77 + Math.random() * 15; // Baik
      else if (bucket === 2) targetSkorAkhir = 51 + Math.random() * 15; // Memadai
      else targetSkorAkhir = 15 + Math.random() * 15; // Kurang

      let totalMaxScore = 0;
      for (const ans of attempt.answers) {
        totalMaxScore += ans.skorMaks;
      }

      if (totalMaxScore === 0) continue;

      let targetRawScore = (targetSkorAkhir / 100) * totalMaxScore;

      for (const ans of attempt.answers) {
        await prisma.attemptAnswer.update({
          where: { id: ans.id },
          data: { skor: 0 },
        });
      }

      const shuffledAnswers = [...attempt.answers].sort(() => 0.5 - Math.random());
      let actualScore = 0;
      for (const ans of shuffledAnswers) {
        if (actualScore + ans.skorMaks <= targetRawScore + 0.1) {
          actualScore += ans.skorMaks;
          await prisma.attemptAnswer.update({
            where: { id: ans.id },
            data: { skor: ans.skorMaks },
          });
        }
      }

      const updatedAnswers = await prisma.attemptAnswer.findMany({
        where: { attemptId: attempt.id },
        include: { question: true },
      });

      const compMap = new Map<string, { jmlBenar: number; jmlSoal: number }>();
      for (const ans of updatedAnswers) {
        if (!ans.question.kompetensiId) continue;
        const current = compMap.get(ans.question.kompetensiId) || { jmlBenar: 0, jmlSoal: 0 };
        current.jmlSoal += 1;
        if (ans.skor && ans.skor >= ans.skorMaks && ans.skorMaks > 0) {
          current.jmlBenar += 1;
        }
        compMap.set(ans.question.kompetensiId, current);
      }

      for (const comp of attempt.competencyScores) {
        const c = compMap.get(comp.kompetensiId);
        if (c) {
          const persentase = c.jmlSoal > 0 ? (c.jmlBenar / c.jmlSoal) * 100 : 0;
          await prisma.competencyScore.update({
            where: { id: comp.id },
            data: {
              jmlBenar: c.jmlBenar,
              jmlSoal: c.jmlSoal,
              persentase: persentase,
            },
          });
        }
      }

      const finalSkorAkhir = (actualScore / totalMaxScore) * 100;
      await prisma.attempt.update({
        where: { id: attempt.id },
        data: {
          skorMentah: actualScore,
          skorAkhir: finalSkorAkhir,
        },
      });
    }
    studentIndex++;
  }

  return NextResponse.json({ success: true, message: `Berhasil sebar nilai untuk ${students.length} siswa` });
}
