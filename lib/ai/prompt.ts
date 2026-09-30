export type PromptInput = {
  namaSiswa: string;
  paketNama: string;
  skorAkhir: number;
  /** Bagian 8.2 brief: ringkasan kerangka asesmen resmi (kalau tersedia untuk mapel ini) - lihat lib/content/kerangka-asesmen.ts. */
  kerangkaAsesmen?: string | null;
  kompetensi: {
    deskripsi: string;
    elemenNama: string;
    subElemen: string;
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
    elemenNama: string;
    subElemen: string;
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
        `- ${k.deskripsi} [Materi: ${k.elemenNama} > ${k.subElemen}]: ${k.jmlBenar}/${k.jmlSoal} benar (${k.persentase.toFixed(0)}%)`,
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
- Untuk kelebihan, kekurangan, dan rekomendasi: HANYA bahas materi/sub-materi/kompetensi yang tercantum di PETA KOMPETENSI dan RINCIAN SEMUA SOAL di bawah. Jangan menyebut atau menyarankan topik lain di luar itu, walau topik itu lazim ada di mata pelajaran ini - kamu tidak tahu apakah topik itu diujikan di paket ini atau tidak. Ini adalah matriks asesmen resminya, jangan keluar dari konteks itu.
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
        `${s.nomor}. [${status}] [${s.levelBloom}] [${s.elemenNama} > ${s.subElemen}] ${s.teksSoal.replace(/\s+/g, " ")}`,
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

Sebagai guru analis, susun laporan evaluasi belajar terstruktur dalam format JSON dengan 4 bagian utama berikut. Setiap bagian WAJIB berakar dari data PETA KOMPETENSI dan RINCIAN SEMUA SOAL di atas (nama materi/sub-materi, persentase, dan perbandingan jawaban siswa vs kunci) - bukan komentar umum yang bisa berlaku untuk siswa mana pun:
1. "ringkasan": Ringkasan Kemampuan (sapaan hangat guru kepada siswa, apresiasi usaha belajarnya, dan rangkuman menyeluruh performa ujian dalam 2-3 kalimat Bahasa Indonesia baku yang memotivasi).
2. "kelebihanSiswa": Kelebihan Siswa - SEBUTKAN SECARA EKSPLISIT nama materi dan sub-materi mana saja yang paling dikuasai siswa (rujuk langsung persentase di PETA KOMPETENSI, jangan pujian umum tanpa nama materi), konsep mana yang sudah kokoh, serta level kognitif (L1/L2/L3) mana yang paling kuat.
3. "kekuranganSiswa": Kekurangan Siswa - SEBUTKAN SECARA EKSPLISIT nama materi dan sub-materi mana saja yang masih lemah (rujuk persentase di PETA KOMPETENSI). Untuk tiap materi yang lemah, jelaskan miskonsepsi konkretnya dengan MEMBANDINGKAN jawaban siswa vs kunci jawaban pada soal-soal terkait di RINCIAN SEMUA SOAL - sebutkan pola kesalahan yang berulang kalau ada. Jangan berhenti di "siswa masih lemah di X" tanpa menjelaskan APA kekeliruannya.
4. "rekomendasi": Rekomendasi Belajar (3-5 butir). TIAP butir HARUS menyasar satu materi/sub-materi spesifik yang lemah dari poin 3, dengan langkah konkret (metode belajar, jenis latihan, atau konsep yang harus diulang) - bukan saran generik seperti "belajar lebih giat" atau "perbanyak latihan soal" tanpa menyebut materi apa.`;
}
