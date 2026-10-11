/**
 * Skrip sinkronisasi multi-media (Diagram Presisi SVG + Foto Ilustrasi)
 * dari database sumber generator (skema `soal`) ke database aplikasi (`public.questions`).
 *
 * Mengupdate soal-soal yang sudah terlanjur diimpor sebelum fitur multi-gambar aktif,
 * seperti A05-SD-MAT-28 dan soal sejenisnya, agar memiliki tab Foto dan Diagram.
 *
 * Jalankan dengan:
 * npx tsx scripts/sync-multi-media.ts
 */

import { prisma } from "../lib/db/prisma";
import { formatQuestionMedia, parseQuestionMedia, type QuestionMediaData } from "../lib/soal/media-types";

// PENGAMAN: skrip ini MENULIS ke public.questions di database yang ditunjuk DATABASE_URL (di komputer pengembang itu bisa
// database PRODUKSI). Tanpa --jalankan hanya simulasi: menghitung dan mencetak apa yang akan diubah, tanpa menulis apa pun.
const JALANKAN = process.argv.includes("--jalankan");

async function main() {
  console.log(JALANKAN ? "MODE: MENULIS (--jalankan)" : "MODE: SIMULASI (tidak menulis). Tambahkan --jalankan untuk benar-benar memperbarui.");
  console.log("Memulai pemeriksaan soal dengan media ganda (SVG diagram + Foto)...");

  // Ambil semua soal public untuk pencocokan cepat di memori
  const publicQuestions = await prisma.question.findMany({
    select: { id: true, teks: true, media: true },
  });
  const publicByText = new Map(publicQuestions.map((q) => [q.teks.trim(), q]));

  // Ambil semua soal dari skema soal yang memiliki gambar ilustrasi_kontekstual dengan svg_fallback
  const sourceQuestions = await prisma.$queryRaw<any[]>`
    SELECT id, code, payload
    FROM soal.questions
    WHERE payload->'gambar'->>'svg_fallback' IS NOT NULL
  `;

  console.log(`Ditemukan ${sourceQuestions.length} butir soal di sumber yang memiliki svg_fallback.`);

  let updatedCount = 0;
  let alreadyMultiCount = 0;

  for (const sq of sourceQuestions) {
    const text = sq.payload?.soal_text?.trim();
    if (!text) continue;

    const matchedPublic = publicByText.get(text);
    if (!matchedPublic) continue;

    // Cek apakah sudah berformat multi
    const currentParsed = parseQuestionMedia(matchedPublic.media);
    if (currentParsed && currentParsed.items.length > 1) {
      alreadyMultiCount++;
      continue;
    }

    const g = sq.payload.gambar;
    const caption = g.deskripsi_alt?.trim() || null;
    const svgContent = g.svg_fallback?.trim();

    // Dapatkan URL foto (dari media tersimpan sekarang, atau URL sumber jika belum tersimpan)
    let photoUrl = matchedPublic.media;
    if (!photoUrl || photoUrl.startsWith("{") || photoUrl.endsWith(".svg")) {
      photoUrl = g.url || g.image_data || null;
    }

    const items: QuestionMediaData["items"] = [];

    // 1. Diagram Presisi (SVG)
    if (svgContent) {
      items.push({
        tipe: "svg",
        label: "Diagram Presisi (SVG)",
        svgContent,
        url: `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`,
      });
    }

    // 2. Foto Ilustrasi
    if (photoUrl) {
      items.push({
        tipe: "foto",
        label: "Foto Ilustrasi",
        url: photoUrl,
      });
    }

    if (items.length > 0) {
      const mediaData: QuestionMediaData = {
        tipe: items.length > 1 ? "multi" : "single",
        caption,
        items,
      };

      const jsonStr = formatQuestionMedia(mediaData);

      if (JALANKAN) {
        await prisma.question.update({
          where: { id: matchedPublic.id },
          data: { media: jsonStr },
        });
      }

      console.log(`[${JALANKAN ? "UPDATED" : "SIMULASI"}] Soal ${sq.code} (${matchedPublic.id}) ${JALANKAN ? "berhasil diperbarui" : "akan diperbarui"} dengan ${items.length} ilustrasi.`);
      updatedCount++;
    }
  }

  console.log(`\nSelesai!`);
  console.log(`- Soal yang ${JALANKAN ? "diperbarui" : "AKAN diperbarui (simulasi, tidak ada yang ditulis)"}: ${updatedCount}`);
  console.log(`- Soal yang sudah multi-media sebelumnya: ${alreadyMultiCount}`);
}

main()
  .catch((err) => {
    console.error("Gagal sinkronisasi multi-media:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
