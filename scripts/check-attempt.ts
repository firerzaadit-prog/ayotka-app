import { prisma } from "../lib/db/prisma";

const ATTEMPT_ID = "a4fac53e-fc0a-45b2-baeb-97340301a4a3";

async function main() {
  const attempt = await prisma.attempt.findUnique({
    where: { id: ATTEMPT_ID },
    select: { id: true, status: true, selesaiAt: true, skorAkhir: true, studentId: true }
  });
  console.log("Attempt status:", JSON.stringify(attempt, null, 2));

  if (!attempt) {
    console.log("Attempt tidak ditemukan!");
    return;
  }

  if (attempt.status === "berjalan") {
    console.log("\nAttempt masih 'berjalan' di DB. Mencoba finalize manual...");
    const { finalizeAttempt } = await import("../lib/exam/finalize");
    await prisma.$transaction((tx) => finalizeAttempt(tx, ATTEMPT_ID, "selesai"));
    const after = await prisma.attempt.findUnique({
      where: { id: ATTEMPT_ID },
      select: { status: true, skorAkhir: true }
    });
    console.log("Setelah finalize:", JSON.stringify(after, null, 2));
  } else {
    console.log("Status sudah:", attempt.status);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
