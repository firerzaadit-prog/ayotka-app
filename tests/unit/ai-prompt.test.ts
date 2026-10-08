import { describe, expect, it } from "vitest";
import { buildAnalisisPrompt } from "@/lib/ai/prompt";
import { analisisSchema } from "@/lib/ai/schema";
import { hitungLaporanSiswa, type InfoIndikator, type JawabanBerindikator } from "@/lib/indikator/daya-serap";
import { PROMPT_VERSION } from "@/lib/ai/version";

describe("buildAnalisisPrompt", () => {
  const input = {
    namaSiswa: "Budi Santoso",
    paketNama: "Paket Matematika Kelas 8",
    skorAkhir: 85,
    kompetensi: [
      {
        deskripsi: "Operasi bilangan bulat",
        elemenNama: "Bilangan",
        subElemen: "Bilangan Bulat",
        jmlBenar: 4,
        jmlSoal: 5,
        persentase: 80,
      },
    ],
    levelKognitif: [{ level: "L1", jmlBenar: 3, jmlSoal: 3 }],
    format: [{ format: "pg", jmlBenar: 4, jmlSoal: 5 }],
    soal: [
      {
        nomor: 1,
        benar: false,
        teksSoal: "Soal cerita panjang tentang bilangan bulat",
        elemenNama: "Bilangan",
        subElemen: "Bilangan Bulat",
        levelBloom: "L3",
        jawabanSiswa: "12 (hasil penjumlahan tanpa memperhatikan tanda negatif)",
        kunciJawaban: "-4",
        pembahasan: "Perhatikan tanda bilangan sebelum dijumlahkan.",
      },
      {
        nomor: 2,
        benar: true,
        teksSoal: "5 + 3 = ?",
        elemenNama: "Bilangan",
        subElemen: "Bilangan Bulat",
        levelBloom: "L1",
        jawabanSiswa: "8",
        kunciJawaban: "8",
        pembahasan: null,
      },
    ],
  };

  it("menyertakan semua angka yang diberikan persis apa adanya", () => {
    const prompt = buildAnalisisPrompt(input);
    expect(prompt).toContain("Budi Santoso");
    expect(prompt).toContain("Nilai akhir: 85");
    expect(prompt).toContain("Operasi bilangan bulat [Materi: Bilangan > Bilangan Bulat]: 4/5 benar (80%)");
    expect(prompt).toContain("L1: 3/3 benar");
  });

  it("menyertakan nama materi & sub materi di rincian tiap soal", () => {
    const prompt = buildAnalisisPrompt(input);
    expect(prompt).toContain("[L3] [Bilangan > Bilangan Bulat]");
  });

  it("menyertakan jawaban siswa untuk SEMUA soal, dan kunci/pembahasan untuk soal yang salah", () => {
    const prompt = buildAnalisisPrompt(input);
    // Soal salah: jawaban siswa, kunci, dan pembahasan harus ada
    expect(prompt).toContain("Jawaban siswa: 12 (hasil penjumlahan tanpa memperhatikan tanda negatif)");
    expect(prompt).toContain("Kunci jawaban: -4");
    expect(prompt).toContain("Perhatikan tanda bilangan sebelum dijumlahkan.");
    // Soal benar: jawaban siswa tetap tampil, kunci tidak perlu diulang
    expect(prompt).toContain("5 + 3 = ?");
    expect(prompt).toContain("[BENAR]");
    expect(prompt).toContain("[SALAH]");
  });

  it("secara eksplisit melarang AI menghitung ulang atau menyebut ranking", () => {
    const prompt = buildAnalisisPrompt(input);
    expect(prompt.toLowerCase()).toContain("jangan menghitung ulang");
    expect(prompt.toLowerCase()).toContain("ranking");
  });

  it("tidak lagi meminta field petaKompetensi (dihapus 2026-09-v7)", () => {
    const prompt = buildAnalisisPrompt(input);
    expect(prompt).not.toContain("petaKompetensi");
    expect(prompt).not.toContain("Peta Kompetensi AI");
  });

  it("mewajibkan kelebihan/kekurangan/rekomendasi menyebut materi spesifik & dibatasi ke matriks asesmen", () => {
    const prompt = buildAnalisisPrompt(input);
    expect(prompt).toContain("SEBUTKAN SECARA EKSPLISIT nama materi");
    expect(prompt.toLowerCase()).toContain("jangan menyebut atau menyarankan topik lain di luar itu");
  });

  it("tetap menghasilkan prompt valid walau tidak ada data kompetensi", () => {
    const prompt = buildAnalisisPrompt({ ...input, kompetensi: [], levelKognitif: [], format: [] });
    expect(prompt).toContain("(tidak ada data)");
  });

  it("tidak menyertakan bagian standar kompetensi resmi kalau kerangkaAsesmen tidak diberikan", () => {
    const prompt = buildAnalisisPrompt(input);
    expect(prompt).not.toContain("STANDAR KOMPETENSI RESMI");
  });

  it("menyertakan bagian standar kompetensi resmi kalau kerangkaAsesmen diberikan (Bagian 8.2 brief)", () => {
    const prompt = buildAnalisisPrompt({ ...input, kerangkaAsesmen: "Ringkasan kerangka asesmen resmi Matematika SD." });
    expect(prompt).toContain("STANDAR KOMPETENSI RESMI");
    expect(prompt).toContain("Ringkasan kerangka asesmen resmi Matematika SD.");
  });
});

describe("buildAnalisisPrompt - STANDAR INDIKATOR RESMI (taksonomi resmi Kemendikdasmen)", () => {
  const dasar = {
    namaSiswa: "Sari",
    paketNama: "Try Out SD 1",
    skorAkhir: 60,
    kompetensi: [],
    levelKognitif: [],
    format: [],
    soal: [],
  };
  const mat = (n: number, o: Partial<InfoIndikator> = {}): InfoIndikator => ({
    id: `m${n}`,
    jenjang: "SMP",
    namaMapel: "Matematika",
    elemen: n <= 2 ? "Bilangan" : "Aljabar",
    subelemen: n <= 2 ? "Bilangan Real" : "Persamaan Linear",
    kompetensi: `Kemampuan ${n}`,
    indikator: `Menyelesaikan masalah nomor ${n} (${n})`,
    urutan: n,
    nilaiNasional: 40 + n,
    ...o,
  });
  const bin = (n: number): InfoIndikator => ({
    id: `b${n}`,
    jenjang: "SD",
    namaMapel: "Bahasa Indonesia",
    elemen: "Pemahaman Tekstual",
    subelemen: `Subkompetensi ${n}`,
    kompetensi: `Subkompetensi ${n}`,
    indikator: `Mengidentifikasi informasi ${n} (${n})`,
    urutan: n,
    nilaiNasional: 55,
  });
  const jw = (indikator: InfoIndikator, skor: number): JawabanBerindikator => ({ indikator, skor, skorMaks: 1 });
  const laporanMat = () => hitungLaporanSiswa([jw(mat(1), 1), jw(mat(1), 0), jw(mat(1), 1), jw(mat(3), 0), jw(mat(3), 0), jw(mat(3), 1)])!;

  it("tanpa data indikator resmi: tidak ada blok maupun aturannya (perilaku lama)", () => {
    const p = buildAnalisisPrompt({ ...dasar, indikatorResmi: null });
    expect(p).not.toContain("STANDAR INDIKATOR RESMI KEMENDIKDASMEN");
    expect(p).not.toContain("Ada STANDAR INDIKATOR RESMI");
    expect(buildAnalisisPrompt(dasar)).toBe(p);
  });

  it("memuat hierarki resmi, daya serap tiap kelompok dan indikator, serta rerata nasional - angka persis hasil hitungan kode", () => {
    const p = buildAnalisisPrompt({ ...dasar, indikatorResmi: laporanMat() });
    expect(p).toContain("STANDAR INDIKATOR RESMI KEMENDIKDASMEN (Matematika SMP; hierarki resmi: Elemen > Subelemen > Kompetensi > Indikator). 6 dari 6 soal pada ujian ini memiliki indikator resmi:");
    expect(p).toContain("Elemen: Bilangan - daya serap 67% (3 soal); rerata nasional 41,0%; Di atas rerata nasional");
    expect(p).toContain('  - [Bilangan Real > Kemampuan 1] "Menyelesaikan masalah nomor 1 (1)": 3 soal, daya serap 67%, rerata nasional 41,0%');
    expect(p).toContain("Elemen: Aljabar - daya serap 33% (3 soal); rerata nasional 43,0%; Perlu penguatan");
    expect(p).toContain('  - [Persamaan Linear > Kemampuan 3] "Menyelesaikan masalah nomor 3 (3)": 3 soal, daya serap 33%, rerata nasional 43,0%');
  });

  it("aturan wajib: penamaan resmi persis, kaitkan rekomendasi ke indikator lemah, nasional hanya rujukan di tingkat kelompok", () => {
    const p = buildAnalisisPrompt({ ...dasar, indikatorResmi: laporanMat() });
    expect(p).toContain("Ada STANDAR INDIKATOR RESMI Kemendikdasmen di bawah");
    expect(p).toContain("pakai penamaan Elemen dan Subelemen serta teks indikator PERSIS seperti di sana");
    expect(p).toContain("kaitkan kekurangan serta rekomendasi ke indikator resmi yang daya serapnya paling rendah");
    expect(p).toContain("Rerata nasional hanya RUJUKAN");
    expect(p).toContain("kesimpulan perbandingan hanya pada tingkat Elemen");
    expect(p).not.toContain("JANGAN memakai kata");
  });

  it("Bahasa Indonesia: tiga tingkat, memakai Kompetensi/Subkompetensi dan melarang kata Elemen", () => {
    const laporan = hitungLaporanSiswa([jw(bin(1), 1), jw(bin(1), 0), jw(bin(2), 1), jw(bin(2), 1)])!;
    const p = buildAnalisisPrompt({ ...dasar, indikatorResmi: laporan });
    expect(p).toContain("hierarki resmi: Kompetensi > Subkompetensi > Indikator");
    expect(p).toContain("Kompetensi: Pemahaman Tekstual - daya serap 75% (4 soal)");
    expect(p).toContain("pakai penamaan Kompetensi dan Subkompetensi serta teks indikator PERSIS");
    expect(p).toContain('JANGAN memakai kata "Elemen" atau "Subelemen"');
    expect(p).not.toMatch(/Elemen: /);
  });

  it("SD Matematika: nama elemen di blok mengikuti Kerangka Asesmen ('Data'), bukan nama di master portal", () => {
    const sd = (n: number): InfoIndikator => ({ ...mat(n), jenjang: "SD", elemen: "Data dan Ketidakpastian", subelemen: "Penyajian dan Penggunaan Data" });
    const p = buildAnalisisPrompt({ ...dasar, indikatorResmi: hitungLaporanSiswa([jw(sd(1), 1), jw(sd(1), 0), jw(sd(1), 1)])! });
    expect(p).toContain("Elemen: Data - daya serap 67% (3 soal)");
    expect(p).not.toContain("Ketidakpastian");
  });

  it("teks indikator multibaris dirapatkan jadi satu baris (tidak merusak struktur daftar)", () => {
    const laporan = hitungLaporanSiswa([jw(mat(1, { indikator: "Baris satu\n   baris   dua (1)" }), 1)])!;
    expect(buildAnalisisPrompt({ ...dasar, indikatorResmi: laporan })).toContain('"Baris satu baris dua (1)"');
  });

  it("kelompok tanpa pembanding nasional atau dengan data kurang: tidak mengarang rerata nasional", () => {
    const laporan = hitungLaporanSiswa([jw(mat(1, { nilaiNasional: null }), 1), jw(mat(3, { nilaiNasional: 90 }), 0)])!;
    const p = buildAnalisisPrompt({ ...dasar, indikatorResmi: laporan });
    expect(p).toContain("Elemen: Bilangan - daya serap 100% (1 soal); Tanpa pembanding nasional");
    expect(p).toContain("Elemen: Aljabar - daya serap 0% (1 soal); Data belum cukup"); // < 3 soal: tidak ada rerata nasional di kepala
    expect(p).not.toMatch(/Aljabar - daya serap 0% \(1 soal\); rerata nasional/);
  });

  it("urutan blok: kerangka asesmen, lalu indikator resmi, lalu data siswa", () => {
    const p = buildAnalisisPrompt({ ...dasar, kerangkaAsesmen: "Ringkasan kerangka.", indikatorResmi: laporanMat() });
    const iKerangka = p.indexOf("STANDAR KOMPETENSI RESMI (Kerangka");
    const iIndikator = p.indexOf("STANDAR INDIKATOR RESMI KEMENDIKDASMEN");
    const iData = p.indexOf("DATA SISWA:");
    expect(iKerangka).toBeGreaterThan(-1);
    expect(iIndikator).toBeGreaterThan(iKerangka);
    expect(iData).toBeGreaterThan(iIndikator);
  });

  it("pembatasan topik kini mencakup standar indikator resmi", () => {
    expect(buildAnalisisPrompt(dasar)).toContain("PETA KOMPETENSI, RINCIAN SEMUA SOAL, dan STANDAR INDIKATOR RESMI (bila ada)");
  });

  it("versi prompt dinaikkan agar analisis lama ditandai usang", () => {
    expect(PROMPT_VERSION).toBe("2026-10-v8");
  });
});

describe("analisisSchema", () => {
  const valid = {
    ringkasan: "Kamu sudah cukup baik di sebagian besar kompetensi.",
    levelKognitif: "Kuat di L1-L2, masih perlu latihan di L3.",
    polaKesalahan: "Beberapa kesalahan pada soal cerita panjang.",
    rekomendasi: ["Latihan soal cerita bilangan bulat"],
  };

  it("menerima struktur yang lengkap dan sesuai (tanpa petaKompetensi)", () => {
    expect(analisisSchema.safeParse(valid).success).toBe(true);
  });

  it("menolak respons kosong", () => {
    expect(analisisSchema.safeParse({}).success).toBe(false);
  });

  it("mengabaikan petaKompetensi kalau tetap dikirim (field lama, tidak lagi divalidasi)", () => {
    expect(analisisSchema.safeParse({ ...valid, petaKompetensi: [] }).success).toBe(true);
  });

  it("menolak rekomendasi lebih dari 5 atau kosong", () => {
    expect(analisisSchema.safeParse({ ...valid, rekomendasi: [] }).success).toBe(false);
    expect(
      analisisSchema.safeParse({ ...valid, rekomendasi: ["a", "b", "c", "d", "e", "f"] }).success,
    ).toBe(false);
  });
});
