/**
 * Tiket 2.1 — seed data mapel tetap sesuai Bagian 3.2 brief:
 * SD: Matematika, Bahasa Indonesia. SMP: IPA, Bahasa Indonesia, Bahasa
 * Inggris, Matematika. Mapel dengan nama sama di jenjang beda tetap 2 baris
 * terpisah (subjects.jenjang satu nilai per baris) karena materinya beda
 * total antar jenjang.
 *
 * Jalankan sekali: npx tsx scripts/seed-subjects.ts
 * Idempotent - aman dijalankan berkali-kali (upsert by kode).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SUBJECTS = [
  { kode: "MTK-SD", nama: "Matematika", jenjang: "SD" as const },
  { kode: "BIN-SD", nama: "Bahasa Indonesia", jenjang: "SD" as const },
  { kode: "IPA-SMP", nama: "IPA", jenjang: "SMP" as const },
  { kode: "BIN-SMP", nama: "Bahasa Indonesia", jenjang: "SMP" as const },
  { kode: "BIG-SMP", nama: "Bahasa Inggris", jenjang: "SMP" as const },
  { kode: "MTK-SMP", nama: "Matematika", jenjang: "SMP" as const },
];

async function main() {
  for (const subject of SUBJECTS) {
    await prisma.subject.upsert({
      where: { kode: subject.kode },
      update: { nama: subject.nama, jenjang: subject.jenjang },
      create: subject,
    });
  }
  console.log(`${SUBJECTS.length} mapel siap (dibuat/diperbarui).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
