import { prisma } from "../lib/db/prisma";

async function main() {
  const analysis = await prisma.aiAnalysis.findFirst({
    include: {
      attempt: {
        include: {
          student: { select: { nama: true } },
          package: { select: { nama: true } }
        }
      }
    },
    orderBy: { generatedAt: "desc" }
  });

  if (!analysis) {
    console.log("Belum ada data analisis AI di database.");
    return;
  }

  console.log(`Menampilkan analisis AI terakhir untuk siswa: ${analysis.attempt.student.nama} (Paket: ${analysis.attempt.package.nama})`);
  console.log(`Tanggal generate: ${analysis.generatedAt}\n`);
  
  console.log("=== RINGKASAN ===");
  console.log(analysis.ringkasan);
  
  console.log("\n=== DETAIL JSON ===");
  const detail = analysis.detailJson as any;
  console.log("Kekuatan Utama:", detail.kekuatanUtama);
  console.log("Area Kelemahan:", detail.areaKelemahan);
  console.log("Rekomendasi:", detail.rekomendasiBelajar);
}

main().catch(console.error).finally(() => prisma.$disconnect());
