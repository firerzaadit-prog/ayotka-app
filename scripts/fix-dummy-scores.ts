import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({
    where: { nama: { contains: 'Sekolah Test Kuota' } }
  });

  if (!school) {
    console.log("School not found!");
    return;
  }

  const students = await prisma.student.findMany({
    where: { schoolId: school.id }
  });

  console.log(`Found ${students.length} students in ${school.nama}`);

  let studentIndex = 0;
  for (const student of students) {
    const attempts = await prisma.attempt.findMany({
      where: { studentId: student.id, status: 'selesai' },
      include: {
        answers: true,
        competencyScores: true,
      }
    });

    for (const attempt of attempts) {
      // Pick a random target score between 10 and 100 to spread it out
      // To make it look "Rata: jelek, sedang, bagus", we will distribute them:
      // index % 4 == 0: Istimewa (~95)
      // index % 4 == 1: Baik (~80)
      // index % 4 == 2: Memadai (~55)
      // index % 4 == 3: Kurang (~30)
      
      let targetSkorAkhir = 0;
      const bucket = studentIndex % 4;
      if (bucket === 0) targetSkorAkhir = 95 + Math.random() * 5; // 95 - 100
      else if (bucket === 1) targetSkorAkhir = 76.67 + Math.random() * 15; // 76.67 - 91
      else if (bucket === 2) targetSkorAkhir = 50 + Math.random() * 15; // 50 - 65
      else targetSkorAkhir = 15 + Math.random() * 15; // 15 - 30

      // Update answers to reflect target score
      let totalMaxScore = 0;
      for (const ans of attempt.answers) {
        totalMaxScore += ans.skorMaks;
      }

      if (totalMaxScore === 0) continue;

      let currentScore = 0;
      let targetRawScore = (targetSkorAkhir / 100) * totalMaxScore;

      // Reset all scores to 0
      for (const ans of attempt.answers) {
        await prisma.attemptAnswer.update({
          where: { id: ans.id },
          data: { skor: 0 }
        });
      }

      // Randomly assign max scores until target is met
      const shuffledAnswers = [...attempt.answers].sort(() => 0.5 - Math.random());
      let actualScore = 0;
      for (const ans of shuffledAnswers) {
        if (actualScore + ans.skorMaks <= targetRawScore + 0.1) {
          actualScore += ans.skorMaks;
          await prisma.attemptAnswer.update({
            where: { id: ans.id },
            data: { skor: ans.skorMaks }
          });
        }
      }

      // Recalculate competency scores
      const updatedAnswers = await prisma.attemptAnswer.findMany({
        where: { attemptId: attempt.id },
        include: { question: true }
      });

      const compMap = new Map<string, { jmlBenar: number, jmlSoal: number }>();
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
            }
          });
        }
      }

      const finalSkorAkhir = (actualScore / totalMaxScore) * 100;
      await prisma.attempt.update({
        where: { id: attempt.id },
        data: {
          skorMentah: actualScore,
          skorAkhir: finalSkorAkhir
        }
      });
      
      console.log(`Updated attempt ${attempt.id} for student ${student.nama} to score ${finalSkorAkhir.toFixed(2)}`);
    }
    studentIndex++;
  }

  console.log("Done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
