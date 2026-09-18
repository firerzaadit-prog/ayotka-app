import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import dotenv from "dotenv";

dotenv.config();

// Mock server-only
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as any;

import { prisma } from "../lib/db/prisma";

async function generateSamplePdf() {
  console.log("Generating sample Rapor PDF...");

  let hasil: any = null;
  let aiAnalysis: any = null;

  try {
    const attempt = await prisma.attempt.findUnique({
      where: { id: "a4fac53e-fc0a-45b2-baeb-97340301a4a3" },
    });
    if (attempt) {
      const { buildHasil } = await import("../lib/exam/hasil");
      hasil = await buildHasil(attempt);
      aiAnalysis = await prisma.aiAnalysis.findUnique({
        where: { attemptId: attempt.id },
      });
    }
  } catch (err) {
    console.warn("Could not query DB directly, using comprehensive realistic report data:", err);
  }

  if (!hasil) {
    hasil = {
      attempt: {
        id: "a4fac53e-fc0a-45b2-baeb-97340301a4a3",
        status: "selesai",
        skorMentah: 32,
        skorAkhir: 80.0,
        mulaiAt: new Date(Date.now() - 3600000),
        selesaiAt: new Date(),
      },
      package: { nama: "Try Out Matematika Mandiri (Paket A)" },
      siswa: { nama: "FIRERZA PRADITYA PERDANA", idSamar: "008***42 · ID-a4fac53e" },
      canShowPembahasan: true,
      isFreeTrial: false,
      isLatihan: false,
      ranking: { peringkatSaya: 3, totalPeserta: 45, papan: [] },
      materiScores: [
        { materiNama: "Bilangan", jmlBenar: 5, jmlSoal: 6, persentase: 83 },
        { materiNama: "Aljabar", jmlBenar: 6, jmlSoal: 8, persentase: 75 },
        { materiNama: "Geometri dan Pengukuran", jmlBenar: 7, jmlSoal: 8, persentase: 88 },
        { materiNama: "Data dan Peluang", jmlBenar: 6, jmlSoal: 8, persentase: 75 },
      ],
      perSoal: [
        {
          questionId: "q-1",
          format: "pg",
          teks: "Hasil dari operasi hitung bilangan bulat berikut:\n$$30 - 15 \\div (-3) + 4 \\times 2$$",
          skor: 4,
          skorMaks: 4,
          jawabanJson: { option_id: "opt-4" },
          options: [
            { id: "opt-1", label: "A", teks: "-1", isCorrect: false },
            { id: "opt-2", label: "B", teks: "13", isCorrect: false },
            { id: "opt-3", label: "C", teks: "27", isCorrect: false },
            { id: "opt-4", label: "D", teks: "43", isCorrect: true },
          ],
          pembahasan: "Urutan operasi hitung campuran (KABATAKU):\n1. Kerjakan pembagian: 15 / (-3) = -5.\n2. Kerjakan perkalian: 4 * 2 = 8.\n3. Kerjakan penjumlahan dan pengurangan: 30 - (-5) + 8 = 30 + 5 + 8 = 43.\nJadi jawaban yang benar adalah D (43).",
        },
        {
          questionId: "q-2",
          format: "pg_kompleks",
          teks: "Sebuah truk pengantar barang memuat $p$ buah kardus besar (15 kg) dan $q$ buah kardus kecil (8 kg). Di dalam truk terdapat sopir (65 kg) dan kernet (55 kg).\n\nTentukan pernyataan yang BENAR mengenai model aljabar total beban truk!",
          skor: 4,
          skorMaks: 4,
          jawabanJson: { option_ids: ["opt-2a", "opt-2b", "opt-2c"] },
          options: [
            { id: "opt-2a", label: "A", teks: "Total berat seluruh kardus saja dapat dimodelkan dengan $15p + 8q$.", isCorrect: true },
            { id: "opt-2b", label: "B", teks: "Total berat gabungan antara sopir dan kernet adalah suku konstanta sebesar 120 kg.", isCorrect: true },
            { id: "opt-2c", label: "C", teks: "Bentuk aljabar untuk total keseluruhan muatan truk adalah $15p + 8q + 120$.", isCorrect: true },
            { id: "opt-2d", label: "D", teks: "Jika truk membawa 10 kardus besar dan 20 kardus kecil, total muatan adalah 310 kg.", isCorrect: false },
          ],
          pembahasan: "1. Beban kardus: 15p + 8q (Pernyataan A Benar).\n2. Sopir + kernet: 65 + 55 = 120 kg (Pernyataan B Benar).\n3. Beban total: 15p + 8q + 120 (Pernyataan C Benar).\n4. Untuk p=10, q=20: 15(10) + 8(20) + 120 = 150 + 160 + 120 = 430 kg (Pernyataan D Salah karena lupa menjumlahkan sopir & kernet).",
        },
        {
          questionId: "q-3",
          format: "pg_kategori",
          teks: "FESTIVAL PERMAINAN DADU BERHADIAH\n\nSebuah stan permainan melempar dua buah dadu setimbang secara bersamaan satu kali. Tentukan nilai kebenaran dari setiap pernyataan berikut!",
          skor: 4,
          skorMaks: 4,
          jawabanJson: { "s-1": "cat-benar", "s-2": "cat-salah" },
          categories: [
            { id: "cat-benar", label: "Benar" },
            { id: "cat-salah", label: "Salah" },
          ],
          statements: [
            { id: "s-1", teks: "Peluang mendapatkan jumlah mata dadu 11 (Hadiah Utama) adalah 2/36.", correctLabel: "Benar" },
            { id: "s-2", teks: "Peluang selisih mata dadu 0 (mata dadu kembar) adalah 1/12.", correctLabel: "Salah" },
          ],
          pembahasan: "1. Jumlah mata dadu 11 didapat dari pasangan (5,6) dan (6,5) = 2 kemungkinan dari 36 ruang sampel, peluang = 2/36 (BENAR).\n2. Mata dadu kembar adalah (1,1), (2,2), (3,3), (4,4), (5,5), (6,6) = 6 kemungkinan dari 36 ruang sampel, peluang = 6/36 = 1/6, bukan 1/12 (SALAH).",
        },
      ],
    };
  }

  if (!aiAnalysis) {
    aiAnalysis = {
      model: "gemini-3.6-flash",
      detailJson: {
        ringkasan: "Halo Ananda Firerza, Bapak/Ibu Guru sangat mengapresiasi kesungguhan belajarmu dalam menyelesaikan Paket Try Out ini dengan capaian nilai akhir 80.0 yang membanggakan. Kamu telah menunjukkan pemahaman konsep dasar dan aplikasi perhitungan yang sangat matang, khususnya pada materi Geometri dan Bilangan. Mari kita terus tingkatkan kemampuan penalaran kontekstualmu agar hasil ujian berikutnya semakin paripurna.",
        petaKompetensi: [
          { kode: "MTK.BIL.REAL", narasi: "Capaianmu pada materi Bilangan Real mencapai 83%. Kamu sudah sangat terampil dan cermat dalam menyelesaikan operasi hitung campuran bilangan bulat dan pecahan sesuai standar kurikulum." },
          { kode: "MTK.ALJ.PPL", narasi: "Capaianmu pada materi Aljabar mencapai 75%. Kamu telah menguasai bentuk dasar aljabar dengan baik, namun perlu sedikit lebih teliti saat memodelkan masalah kontekstual ke dalam persamaan." },
          { kode: "MTK.GEO.UKUR", narasi: "Capaianmu pada materi Geometri dan Pengukuran sangat istimewa mencapai 88%. Kamu sangat mahir menghubungkan rumus keliling, luas, dan volume dengan karakteristik bangun ruang." },
          { kode: "MTK.DAP.DATA", narasi: "Capaianmu pada materi Data dan Peluang mencapai 75%. Kamu sudah membaca diagram data dengan akurat dan memahami perhitungan dasar peluang suatu kejadian." },
        ],
        kelebihanSiswa: "Kamu memiliki kekuatan menonjol pada kemampuan kalkulasi cepat dan daya abstraksi spasial, terutama pada materi Geometri dan Pengukuran serta Bilangan. Pada level kognitif Pengetahuan & Pemahaman (L1) serta Aplikasi Rumus (L2), tingkat akurasimu melampaui 85%. Fondasi teori dan penguasaan konsepmu sudah sangat kokoh, sehingga kamu mampu menyelesaikan soal-soal operasional dengan efisien dan tepat.",
        kekuranganSiswa: "Berdasarkan rincian lembar jawabanmu, tantangan utama yang perlu kita perbaiki bersama terletak pada ketelitian memodelkan soal cerita panjang pada level Penalaran (L3), khususnya topik Aljabar. Pada soal PG Kompleks, kamu cenderung tergesa-gesa mengonfirmasi pilihan pertama sehingga melewatkan verifikasi komponen konstanta tetap. Selain itu, perhatikan kembali syarat batas peluang pada topik Data.",
        rekomendasi: [
          "Luangkan waktu berlatih membedah soal cerita aljabar kontekstual: biasakan menuliskan 'Diketahui', 'Variabel', dan 'Konstanta' sebelum menyusun rumus penyelesaian.",
          "Terapkan strategi 'Ceklis Opsi Mandiri' pada format soal PG Kompleks: uji kebenaran tiap butir pernyataan secara terpisah dari opsi A hingga D sebelum mengonfirmasi jawaban.",
          "Perbanyak simulasi soal tipe HOTS (Level 3 - Penalaran) pada materi kombinatorika dan pemecahan masalah kontekstual.",
        ],
      },
    };
  }

  const logoPath = path.resolve(__dirname, "../public/logo.png");
  const logoBuffer = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;

  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const outputPath = path.resolve(__dirname, "../public/rapor-siswa-contoh.pdf");
  const writeStream = fs.createWriteStream(outputPath);

  doc.pipe(writeStream);

  const { renderRaporPdf } = await import("../lib/pdf/rapor-renderer");
  await renderRaporPdf(
    doc,
    hasil,
    aiAnalysis as any,
    logoBuffer,
  );

  doc.end();

  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  const stats = fs.statSync(outputPath);
  console.log(`PDF generated successfully! Output: ${outputPath} (${stats.size} bytes)`);
}

generateSamplePdf()
  .catch((e) => {
    console.error("PDF generation failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
