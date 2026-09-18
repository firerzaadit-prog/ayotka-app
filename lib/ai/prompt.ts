export type PromptInput = {
  namaSiswa: string;
  paketNama: string;
  skorAkhir: number;
  /** Bagian 8.2 brief: ringkasan kerangka asesmen resmi (kalau tersedia untuk mapel ini) - lihat lib/content/kerangka-asesmen.ts. */
  kerangkaAsesmen?: string | null;
  kompetensi: {
    kode: string;
    deskripsi: string;
    materiNama: string;
    subMateriNama: string;
    jmlBenar: number;
    jmlSoal: number;
    persentase: number;
  }[];
  levelKognitif: { level: string; jmlBenar: number; jmlSoal: number }[];
  format: { format: string; jmlBenar: number; jmlSoal: number }[];
  soal: {
    nomor: number;
    benar: boolean;
    teksSoal: string;
    kompetensi: string;
    materiNama: string;
    subMateriNama: string;
    levelBloom: string;
    jawabanSiswa: string;
    kunciJawaban: string;
    pembahasan: string | null;
  }[];
};

/**
 * Tiket 5.4 (Brief Bagian 8.1): fungsi murni (tanpa I/O) supaya gampang
 * dites - semua angka di sini SUDAH final hasil hitungan kode program
 * (skoring biner + agregasi kompetensi), prompt cuma minta AI menarasikan,
 * bukan menghitung ulang atau menebak angka baru.
 */
export function buildAnalisisPrompt(input: PromptInput): string {
  const kompetensiLines = input.kompetensi
    .map(
      (k) =>
        `- ${k.kode} (${k.deskripsi}) [Materi: ${k.materiNama} > ${k.subMateriNama}]: ${k.jmlBenar}/${k.jmlSoal} benar (${k.persentase.toFixed(0)}%)`,
    )
    .join("\n");
  const levelLines = input.levelKognitif
    .map((l) => `- ${l.level}: ${l.jmlBenar}/${l.jmlSoal} benar`)
    .join("\n");
  const formatLines = input.format
    .map((f) => `- ${f.format}: ${f.jmlBenar}/${f.jmlSoal} benar`)
    .join("\n");

  const kerangkaBlock = input.kerangkaAsesmen
    ? `\nSTANDAR KOMPETENSI RESMI (Kerangka Asesmen TKA - Kemendikdasmen, untuk konteks BACAAN saja, BUKAN sumber angka):\n${input.kerangkaAsesmen}\n`
    : "";
  const kerangkaAturan = input.kerangkaAsesmen
    ? "\n- Gunakan STANDAR KOMPETENSI RESMI di bawah sebagai acuan pembanding saat menarasikan tiap kompetensi (mis. kompetensi APA dari standar itu yang belum dikuasai berdasarkan persentase yang diberikan) - jangan mengarang cakupan standar yang tidak disebutkan di sana."
    : "";

  return `Kamu adalah seorang analis pendidikan dan guru pembimbing ahli yang menganalisis kemampuan belajar siswanya secara mendalam berdasarkan data pengerjaan ujian. Sampaikan analisis ini secara langsung kepada siswa menggunakan Bahasa Indonesia baku, santun, hangat, objektif, dan bernada mendidik (pedagogis).

ATURAN WAJIB:
- Posisikan dirimu sebagai guru pembimbing yang berdialog langsung dengan siswa (gunakan kata sapaan yang santun seperti 'kamu' atau nama siswa).
- Gunakan Bahasa Indonesia baku yang baik, benar, dan mudah dipahami oleh siswa.
- Berikan apresiasi atas usaha siswa, deteksi kelebihan dan kekurangannya secara jelas berdasarkan materi dan sub-materi pelajaran, serta berikan rekomendasi tindak lanjut yang konkrit.
- Semua angka di bawah ini SUDAH FINAL dan BENAR, dihitung oleh sistem, bukan olehmu. Jangan menghitung ulang, jangan mengubah, jangan mengarang angka baru sama sekali.
- Tugasmu HANYA menerjemahkan angka-angka ini menjadi narasi edukatif. Kalau kamu menyebut angka atau persentase, angka itu HARUS persis sama dengan yang diberikan di bawah.
- Jangan menyinggung ranking/peringkat terhadap siswa lain - data itu sengaja tidak diberikan ke kamu dan tidak relevan untuk evaluasi personal siswa ini.
- Nada: suportif, memotivasi, dan membangun, bukan menghakimi. Ini adalah panduan belajar, bukan vonis.
- Keluarkan HANYA JSON sesuai skema yang diminta, tanpa teks lain di luar JSON.${kerangkaAturan}
${kerangkaBlock}
DATA SISWA:
Nama: ${input.namaSiswa}
Paket ujian: ${input.paketNama}
Nilai akhir: ${input.skorAkhir.toFixed(0)}

PETA KOMPETENSI (persentase penguasaan per kompetensi):
${kompetensiLines || "(tidak ada data)"}

LEVEL KOGNITIF (L1=Pengetahuan & Pemahaman, L2=Aplikasi, L3=Penalaran):
${levelLines || "(tidak ada data)"}

PER FORMAT SOAL:
${formatLines || "(tidak ada data)"}

RINCIAN SEMUA SOAL (jawaban siswa sudah diterjemahkan dari pilihan/kategori yang
dipilih ke teks aslinya, bukan ID mentah - bandingkan langsung dengan kunci jawaban
untuk memahami APA yang salah dipahami siswa, bukan cuma BAHWA soal itu salah):
${
  input.soal
    .map((s) => {
      const status = s.benar ? "BENAR" : "SALAH";
      const lines = [
        `${s.nomor}. [${status}] [${s.kompetensi} - ${s.levelBloom}] [${s.materiNama} > ${s.subMateriNama}] ${s.teksSoal.replace(/\s+/g, " ")}`,
        `   Jawaban siswa: ${s.jawabanSiswa}`,
      ];
      if (!s.benar) {
        lines.push(`   Kunci jawaban: ${s.kunciJawaban}`);
        if (s.pembahasan) lines.push(`   Pembahasan: ${s.pembahasan.replace(/\s+/g, " ")}`);
      }
      return lines.join("\n");
    })
    .join("\n") || "(tidak ada soal)"
}

Sebagai guru analis, susun laporan evaluasi belajar terstruktur dalam format JSON dengan 5 bagian utama berikut:
1. "ringkasan": Ringkasan Kemampuan (sapaan hangat guru kepada siswa, apresiasi usaha belajarnya, dan rangkuman menyeluruh performa ujian dalam 2-3 kalimat Bahasa Indonesia baku yang memotivasi).
2. "petaKompetensi": Peta Kompetensi AI (evaluasi capaian untuk setiap butir kompetensi dasar di atas dengan bahasa guru pembimbing, mengaitkannya pada standar kurikulum/Kemendikdasmen).
3. "kelebihanSiswa": Kelebihan Siswa (penjelasan apresiatif tentang materi pokok dan sub-materi apa saja yang telah dikuasai siswa dengan sangat baik, konsep mana yang sudah kokoh, serta keunggulan siswa pada level kognitif L1/L2/L3).
4. "kekuranganSiswa": Kekurangan Siswa (penjelasan empatik namun tegas mengenai materi dan sub-materi apa yang masih menjadi kendala, letak kekeliruan konsep atau miskonsepsi saat membandingkan jawaban siswa dengan kunci jawaban, serta tipe/format soal yang masih sering membuat siswa terkecoh).
5. "rekomendasi": Rekomendasi Belajar (3-5 butir langkah konkrit dan terarah dari guru untuk siswa, meliputi materi prioritas yang harus diulas kembali, metode verifikasi jawaban, dan strategi latihan mandiri agar capaian siswa meningkat).`;
}
