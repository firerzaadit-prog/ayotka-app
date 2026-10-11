/**
 * Skrip komprehensif untuk menyinkronkan seluruh komponen media soal
 * (Diagram Presisi SVG, Foto Ilustrasi, serta Keterangan/Caption Visualisasi Pendukung)
 * dari soal.ayotka.id ke seluruh soal yang ada di database AyoTKA (public.questions).
 */

import { prisma } from "../lib/db/prisma";
import { formatQuestionMedia, parseQuestionMedia, type QuestionMediaData, type MediaItem } from "../lib/soal/media-types";

// PENGAMAN: skrip ini MENULIS ke public.questions di database yang ditunjuk DATABASE_URL (di komputer pengembang itu bisa
// database PRODUKSI). Tanpa --jalankan hanya simulasi: menghitung dan mencetak apa yang akan diubah, tanpa menulis apa pun.
const JALANKAN = process.argv.includes("--jalankan");

async function main() {
  console.log("=== MEMULAI SINKRONISASI KOMPONEN MEDIA SOAL DARI SOAL.AYOTKA.ID ===");
  console.log(JALANKAN ? "MODE: MENULIS (--jalankan)" : "MODE: SIMULASI (tidak menulis). Tambahkan --jalankan untuk benar-benar memperbarui.");

  const publicQuestions = await prisma.question.findMany({
    select: { id: true, teks: true, media: true },
  });
  console.log(`Jumlah butir soal di public: ${publicQuestions.length}`);

  const publicByText = new Map(publicQuestions.map((q) => [q.teks.trim(), q]));

  const sourceQuestions = await prisma.$queryRaw<any[]>`
    SELECT q.id, q.code, q.payload->>'soal_text' as soal_text, q.payload->'gambar' as gambar
    FROM soal.questions q
    WHERE q.payload->'gambar' IS NOT NULL
  `;
  console.log(`Jumlah butir soal di sumber (soal.questions) dengan gambar: ${sourceQuestions.length}`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const sq of sourceQuestions) {
    const text = sq.soal_text?.trim();
    if (!text) continue;

    const matchedPublic = publicByText.get(text);
    if (!matchedPublic) continue;

    const g = sq.gambar;
    if (!g) continue;

    const caption = g.deskripsi_alt?.trim() || g.desk_alt?.trim() || null;
    const existingParsed = parseQuestionMedia(matchedPublic.media);

    // Kumpulkan seluruh item yang ada di sumber
    const items: MediaItem[] = [];

    // 1. Diagram SVG (baik dari svg_fallback maupun svg_content)
    const svgMarkup = g.svg_fallback || (g.tipe === "svg" ? g.svg_content : null);
    if (svgMarkup && svgMarkup.trim()) {
      const trimmedSvg = svgMarkup.trim();
      const svgUrl = `data:image/svg+xml;utf8,${encodeURIComponent(trimmedSvg)}`;
      items.push({
        tipe: "svg",
        label: "Diagram Presisi (SVG)",
        url: svgUrl,
        svgContent: trimmedSvg,
        alt: caption || undefined,
      });
    }

    // 2. Foto Ilustrasi (dari url atau image_data atau gambar yang sudah diunggah di AyoTKA)
    let photoUrl = g.url?.trim() || g.image_data || null;
    // Jika soal di public sudah punya URL Supabase storage untuk fotonya, prioritaskan URL storage AyoTKA
    if (matchedPublic.media && matchedPublic.media.startsWith("http") && !matchedPublic.media.includes(".svg")) {
      photoUrl = matchedPublic.media;
    } else if (existingParsed) {
      const existingPhoto = existingParsed.items.find((it) => it.tipe === "foto" && it.url?.startsWith("http"));
      if (existingPhoto?.url) photoUrl = existingPhoto.url;
    }

    if (photoUrl && photoUrl !== svgMarkup) {
      items.push({
        tipe: "foto",
        label: "Foto Ilustrasi",
        url: photoUrl,
        alt: caption || undefined,
      });
    }

    // Jika items kosong (misal tipe url tapi url belum ada), gunakan media yang sudah ada jika ada
    if (items.length === 0 && matchedPublic.media) {
      const parsed = parseQuestionMedia(matchedPublic.media);
      if (parsed) {
        items.push(...parsed.items);
      }
    }

    if (items.length === 0) {
      skippedCount++;
      continue;
    }

    const newMediaData: QuestionMediaData = {
      tipe: items.length > 1 ? "multi" : "single",
      caption,
      items,
    };

    const newMediaPayload = formatQuestionMedia(newMediaData);

    // Bandingkan apakah berubah
    if (matchedPublic.media === newMediaPayload) {
      skippedCount++;
      continue;
    }

    if (JALANKAN) {
      await prisma.question.update({
        where: { id: matchedPublic.id },
        data: { media: newMediaPayload },
      });
    }

    console.log(`[${JALANKAN ? "UPDATE" : "SIMULASI"}] Soal ${sq.code} (${matchedPublic.id}): items=${items.length}, caption="${caption ? caption.slice(0, 40) + '...' : 'none'}"`);
    updatedCount++;
  }

  console.log(`\n=== HASIL SINKRONISASI${JALANKAN ? "" : " (SIMULASI)"}: ${updatedCount} soal ${JALANKAN ? "diperbarui" : "akan diperbarui"}, ${skippedCount} dilewati / sudah sesuai. ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
