export type PromptInput = {
  namaSiswa: string;
  paketNama: string;
  skorAkhir: number;
  kompetensi: { kode: string; deskripsi: string; jmlBenar: number; jmlSoal: number; persentase: number }[];
  levelKognitif: { level: string; jmlBenar: number; jmlSoal: number }[];
  format: { format: string; jmlBenar: number; jmlSoal: number }[];
  salahDijawab: { teksSoal: string; kompetensi: string; levelBloom: string }[];
};

/**
 * Tiket 5.4 (Brief Bagian 8.1): fungsi murni (tanpa I/O) supaya gampang
 * dites - semua angka di sini SUDAH final hasil hitungan kode program
 * (skoring biner + agregasi kompetensi), prompt cuma minta AI menarasikan,
 * bukan menghitung ulang atau menebak angka baru.
 */
export function buildAnalisisPrompt(input: PromptInput): string {
  const kompetensiLines = input.kompetensi
    .map((k) => `- ${k.kode} (${k.deskripsi}): ${k.jmlBenar}/${k.jmlSoal} benar (${k.persentase.toFixed(0)}%)`)
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

SAMPEL SOAL YANG SALAH DIJAWAB OLEH SISWA:
(Analisis teks soal berikut untuk mencari letak miskonsepsi atau pola kesalahan berulang. Jangan bahas satu-satu secara literal, tapi tarik kesimpulan polanya)
${input.salahDijawab.slice(0, 10).map((s, i) => `${i + 1}. [${s.kompetensi} - ${s.levelBloom}] ${s.teksSoal.replace(/\s+/g, ' ').slice(0, 300)}${s.teksSoal.length > 300 ? '...' : ''}`).join("\n") || "(tidak ada atau berhasil menjawab semua)"}

Buat narasi: ringkasan umum, narasi singkat per kompetensi di atas, narasi kekuatan/kelemahan level kognitif, narasi pola miskonsepsi/kesalahan (didasarkan pada sampel soal yang salah dijawab), dan 3-5 rekomendasi sub materi prioritas untuk dipelajari ulang beserta alasannya.`;
}
