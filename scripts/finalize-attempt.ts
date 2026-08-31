// Finalize menggunakan DATABASE_URL langsung (tidak modifikasi URL)
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const ATTEMPT_ID = "a4fac53e-fc0a-45b2-baeb-97340301a4a3";

async function main() {
  // Cek status
  const attempt = await db.attempt.findUnique({ 
    where: { id: ATTEMPT_ID }, 
    select: { id: true, status: true, skorAkhir: true } 
  });
  console.log("Status saat ini:", attempt);

  if (!attempt) { console.log("Tidak ditemukan"); return; }
  if (attempt.status !== "berjalan") { console.log("Sudah:", attempt.status); return; }

  // Update langsung ke selesai (skor 0 dulu, nanti refresh halaman hasil akan tampil)
  await db.attempt.update({
    where: { id: ATTEMPT_ID },
    data: { status: "selesai", selesaiAt: new Date(), skorMentah: 0, skorAkhir: 0 }
  });

  console.log("✅ Berhasil! Refresh halaman hasil.");
}

main().catch(console.error).finally(() => db.$disconnect());
