export type PromptInput = {
  namaSiswa: string;
  paketNama: string;
  skorAkhir: number;
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

  return `Kamu adalah asisten yang menerjemahkan data hasil ujian siswa menjadi narasi yang mudah dipahami, dalam Bahasa Indonesia yang suportif dan membangun.

ATURAN WAJIB:
- Semua angka di bawah ini SUDAH FINAL dan BENAR, dihitung oleh sistem, bukan olehmu. Jangan menghitung ulang, jangan mengubah, jangan mengarang angka baru sama sekali.
- Tugasmu HANYA menerjemahkan angka-angka ini menjadi narasi. Kalau kamu menyebut angka, angka itu HARUS persis sama dengan yang diberikan di bawah.
- Jangan menyinggung ranking/peringkat terhadap siswa lain - data itu sengaja tidak diberikan ke kamu dan tidak relevan untuk siswa ini.
- Nada: suportif dan membangun, bukan menghakimi. Ini bantu belajar, bukan vonis.
- Keluarkan HANYA JSON sesuai skema yang diminta, tanpa teks lain di luar JSON.

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

Buat narasi: ringkasan umum, narasi singkat per kompetensi di atas, narasi kekuatan/kelemahan level kognitif, narasi pola miskonsepsi/kesalahan (bandingkan jawaban siswa vs kunci pada soal yang salah untuk menjelaskan konsep spesifik apa yang tertukar/kurang dipahami, jangan cuma menyebut nama kompetensinya), dan 3-5 rekomendasi sub materi prioritas untuk dipelajari ulang beserta alasannya.`;
}
