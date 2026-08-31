import { prisma } from "../lib/db/prisma";
import { runAnalisisAi } from "../lib/ai/analyze";

async function main() {
  console.log("Mencari data ujian yang sudah selesai...");
  const attempt = await prisma.attempt.findFirst({
    where: { status: "selesai" },
    include: {
      student: { select: { nama: true } },
      package: { select: { nama: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!attempt) {
    console.log("Tidak ada data ujian (attempt) yang berstatus 'selesai'.");
    return;
  }

  console.log(`Ditemukan ujian dari siswa: ${attempt.student.nama} (Paket: ${attempt.package.nama})`);
  console.log(`Skor akhir: ${attempt.skorAkhir}`);
  console.log("Memulai analisis AI menggunakan Gemini...");
  
  try {
    const start = Date.now();
    const result = await runAnalisisAi(attempt);
    const end = Date.now();
    
    console.log(`\n--- HASIL ANALISIS AI (${((end - start) / 1000).toFixed(1)} detik) ---`);
    console.log("\n1. RINGKASAN:");
    console.log(result.ringkasan);
    
    console.log("\n2. KEKUATAN UTAMA:");
    result.kekuatanUtama.forEach(k => console.log(`- ${k}`));
    
    console.log("\n3. AREA KELEMAHAN:");
    result.areaKelemahan.forEach(k => console.log(`- ${k}`));
    
    console.log("\n4. REKOMENDASI BELAJAR:");
    result.rekomendasiBelajar.forEach(r => console.log(`- ${r}`));
    
  } catch (error: any) {
    console.error("Gagal menjalankan analisis AI:", error.message || error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
