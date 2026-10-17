import sharp from "sharp";
import { bangunHierarkiKompetensi, type SkorKompetensi } from "@/lib/exam/hierarki-kompetensi";
import { hitungLaporanSiswa, type InfoIndikator, type JawabanBerindikator } from "@/lib/indikator/daya-serap";
import type { IdentitasRapor } from "@/lib/exam/jenis-tryout";

/**
 * Data rapor tiruan yang realistis untuk menguji dan memeriksa tampilan PDF rapor (tes dan skrip pemeriksa visual).
 * Bentuknya sama dengan keluaran buildHasil (lib/exam/hasil.ts).
 */
export type OpsiFixture = {
  jumlahSoal?: number;
  nama?: string;
  namaPaket?: string;
  ranking?: boolean;
  hierarki?: boolean;
  indikator?: boolean;
  stimulus?: boolean;
  media?: boolean;
  status?: "selesai" | "kedaluwarsa";
  skorAkhir?: number | null;
  panjang?: boolean;
};

export const SVG_DIAGRAM = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
  <rect width="320" height="200" fill="#f1f5f9" stroke="#94a3b8"/>
  <polygon points="40,160 160,40 280,160" fill="#c7d2fe" stroke="#4f46e5" stroke-width="2"/>
  <circle cx="160" cy="40" r="4" fill="#dc2626"/>
  <text x="152" y="30" font-family="sans-serif" font-size="14" fill="#0f172a">A</text>
  <text x="26" y="176" font-family="sans-serif" font-size="14">B</text>
  <text x="284" y="176" font-family="sans-serif" font-size="14">C</text>
  <text x="70" y="192" font-family="Arial" font-size="12" fill="#334155">AB = 10 cm, BC = 12 cm</text>
</svg>`;

/** PNG berlatar gradien sebagai data URI (tanpa jaringan), untuk menguji foto di rapor. */
export async function pngContoh(lebar = 420, tinggi = 260): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${lebar}" height="${tinggi}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${lebar / 2}" cy="${tinggi / 2}" r="60" fill="#fde68a"/></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

const mat = (n: number, o: Partial<InfoIndikator> = {}): InfoIndikator => ({
  id: `m${n}`,
  jenjang: "SD",
  namaMapel: "Matematika",
  elemen: n <= 5 ? "Bilangan" : n <= 9 ? "Aljabar" : "Geometri dan Pengukuran",
  subelemen: n <= 5 ? "Bilangan Real" : n <= 9 ? "Persamaan Linear" : "Bangun Datar",
  kompetensi: "Kemampuan memahami dan mengaplikasikan konsep untuk menyelesaikan permasalahan",
  indikator: `Menyelesaikan masalah kontekstual yang berkaitan dengan operasi hitung nomor ${n} (${n})`,
  urutan: n,
  nilaiNasional: 20 + n * 4.5,
  ...o,
});

export function skorKompetensiContoh(): SkorKompetensi[] {
  const k = (id: string, elemenId: string, elemenNama: string, urutan: number, sub: string, kompetensi: string, level: string, benar: number, soal: number): SkorKompetensi => ({
    kompetensiId: id,
    elemenId,
    elemenNama,
    elemenUrutan: urutan,
    subElemen: sub,
    kompetensi,
    level,
    jmlBenar: benar,
    jmlSoal: soal,
  });
  return [
    k("k1", "e1", "Bilangan", 1, "Bilangan Cacah dan Bulat", "Menyelesaikan masalah yang melibatkan operasi hitung bilangan bulat", "L1", 4, 4),
    k("k2", "e1", "Bilangan", 1, "Bilangan Cacah dan Bulat", "Menentukan hasil operasi campuran dengan memperhatikan urutan pengerjaan operasi hitung", "L2", 2, 3),
    k("k3", "e1", "Bilangan", 1, "Pecahan dan Desimal", "Membandingkan dan mengurutkan pecahan serta bilangan desimal dalam berbagai bentuk", "L2", 1, 3),
    k("k4", "e2", "Aljabar", 2, "Persamaan Linear", "Memodelkan situasi sehari-hari ke dalam persamaan linear satu variabel dan menyelesaikannya", "L3", 1, 4),
    k("k5", "e2", "Aljabar", 2, "Pola Bilangan", "Menemukan aturan suatu pola bilangan dan memprediksi suku berikutnya", "L2", 3, 3),
    k("k6", "e3", "Geometri dan Pengukuran", 3, "Bangun Datar", "Menghitung keliling dan luas gabungan beberapa bangun datar", "L2", 0, 3),
    k("k7", "e3", "Geometri dan Pengukuran", 3, "Bangun Ruang", "Menentukan volume dan luas permukaan bangun ruang sisi datar", "L3", 2, 4),
    k("k8", "e4", "Data dan Peluang", 4, "Penyajian Data", "Membaca dan menafsirkan data yang disajikan dalam tabel dan diagram", "L1", 3, 3),
  ];
}

export async function buatHasilContoh(o: OpsiFixture = {}) {
  const n = o.jumlahSoal ?? 12;
  const fotoUri = o.media ? await pngContoh() : null;
  const panjang = o.panjang
    ? " Perhatikan baik-baik seluruh keterangan pada soal, termasuk satuan yang dipakai pada tiap besaran, karena satuan yang berbeda harus disamakan lebih dulu sebelum dilakukan perhitungan."
    : "";

  const perSoal = Array.from({ length: n }, (_, i) => {
    const jenis = i % 4;
    const benar = i % 3 !== 0;
    const base = {
      questionId: `q${i + 1}`,
      media: null as string | null,
      stimulus: null as null | { id: string; tipe: string; judul: string | null; konten: string },
      pembahasan: `Langkah penyelesaian soal nomor ${i + 1}: gunakan konsep yang sesuai, kerjakan operasi sesuai urutan, lalu periksa kembali hasilnya agar tidak ada langkah yang terlewat. Jawaban yang benar mengikuti kunci yang tertera pada pilihan jawaban di atas.${panjang}`,
      categories: [] as { id: string; label: string }[],
      statements: [] as { id: string; teks: string; correctLabel: string }[],
    };
    if (jenis === 0 || jenis === 3) {
      return {
        ...base,
        format: "pg",
        teks: `Hasil dari operasi hitung $30 - 15 \\div (-3) + 4 \\times 2$ adalah ... (soal ${i + 1}).${panjang}`,
        skor: benar ? 1 : 0,
        skorMaks: 1,
        jawabanJson: { option_id: benar ? "b" : "a" } as unknown,
        options: [
          { id: "a", label: "A", teks: "-1", isCorrect: false },
          { id: "b", label: "B", teks: "43", isCorrect: true },
          { id: "c", label: "C", teks: "27", isCorrect: false },
          { id: "d", label: "D", teks: "13", isCorrect: false },
        ],
        ...(o.stimulus && jenis === 3
          ? {
              stimulus: {
                id: "s1",
                tipe: "teks",
                judul: "Bacaan 1",
                konten:
                  "Pak Budi menjual 3 jenis buah di pasar. Setiap hari ia mencatat jumlah buah yang terjual dalam sebuah tabel, lalu menghitung pendapatannya.\n\nPada hari Senin ia menjual 12 kg apel, 8 kg jeruk, dan 5 kg mangga.",
              },
            }
          : {}),
        ...(o.media && jenis === 0
          ? {
              media: JSON.stringify({
                tipe: "multi",
                caption: "Keterangan yang tidak boleh dicetak",
                items: [
                  { tipe: "svg", label: "Diagram Presisi (SVG)", svgContent: SVG_DIAGRAM },
                  { tipe: "foto", label: "Foto Ilustrasi", url: fotoUri },
                ],
              }),
            }
          : {}),
      };
    }
    if (jenis === 1) {
      return {
        ...base,
        format: "pg_kompleks",
        teks: `Pilihlah semua pernyataan yang benar tentang bilangan prima (soal ${i + 1}).${panjang}`,
        skor: benar ? 1 : 0,
        skorMaks: 1,
        jawabanJson: { option_ids: benar ? ["a", "c"] : ["a", "b"] } as unknown,
        options: [
          { id: "a", label: "A", teks: "2 adalah bilangan prima genap satu-satunya", isCorrect: true },
          { id: "b", label: "B", teks: "9 adalah bilangan prima", isCorrect: false },
          { id: "c", label: "C", teks: "Bilangan prima hanya habis dibagi 1 dan dirinya sendiri", isCorrect: true },
          { id: "d", label: "D", teks: "1 adalah bilangan prima terkecil", isCorrect: false },
        ],
      };
    }
    return {
      ...base,
      format: "pg_kategori",
      teks: `Tentukan apakah setiap pernyataan berikut Benar atau Salah (soal ${i + 1}).`,
      skor: benar ? 1 : 0,
      skorMaks: 1,
      jawabanJson: { s1: benar ? "k1" : "k2", s2: "k2" } as unknown,
      options: [] as { id: string; label: string; teks: string; isCorrect: boolean }[],
      categories: [
        { id: "k1", label: "Benar" },
        { id: "k2", label: "Salah" },
      ],
      statements: [
        { id: "s1", teks: "Jumlah sudut dalam segitiga adalah 180 derajat", correctLabel: "Benar" },
        { id: "s2", teks: "Segitiga sama sisi memiliki tepat dua sisi yang sama panjang", correctLabel: "Salah" },
      ],
    };
  });

  const jw: JawabanBerindikator[] = [];
  for (let k = 1; k <= 12; k++) for (let r = 0; r < 3; r++) jw.push({ indikator: mat(k), skor: (k + r) % 3 === 0 ? 0 : 1, skorMaks: 1 });

  const skor = skorKompetensiContoh();
  return {
    attempt: {
      id: "attempt-uji",
      status: o.status ?? "selesai",
      skorMentah: 8,
      skorAkhir: o.skorAkhir === undefined ? 72.5 : o.skorAkhir,
      mulaiAt: new Date("2026-10-12T08:38:00.000Z"),
      selesaiAt: new Date("2026-10-12T09:12:00.000Z"),
    },
    package: { nama: o.namaPaket ?? "Try Out Matematika SD - Paket 1" },
    siswa: { nama: o.nama ?? "FIRERZA PRADITYA PERDANA", idSamar: "008***42" },
    canShowPembahasan: true as const,
    isFreeTrial: false,
    analisisAiDiminta: false,
    bisaUnduhRapor: true,
    bukaPaketBerikutnya: null,
    paketBerseriBelumTerjawab: false,
    ranking: o.ranking ? { peringkatSaya: 3, totalPeserta: 45, papan: [] as { peringkat: number; nama: string; skor: number; andaSendiri: boolean }[] } : null,
    perSoal,
    indikator: o.indikator ? hitungLaporanSiswa(jw) : null,
    competencyScores: [],
    hierarkiKompetensi: o.hierarki === false ? undefined : bangunHierarkiKompetensi(skor),
    elemenScores: [
      { elemenNama: "Bilangan", jmlBenar: 7, jmlSoal: 10, persentase: 70 },
      { elemenNama: "Aljabar", jmlBenar: 4, jmlSoal: 7, persentase: 57 },
      { elemenNama: "Geometri dan Pengukuran", jmlBenar: 2, jmlSoal: 7, persentase: 29 },
      { elemenNama: "Data dan Peluang", jmlBenar: 3, jmlSoal: 3, persentase: 100 },
    ],
  };
}

export const ANALISIS_CONTOH = {
  detailJson: {
    ringkasan:
      "Halo Firerza, kerja kerasmu pada try out ini patut diapresiasi! Kamu menunjukkan penguasaan yang baik pada materi Bilangan dan Data, namun masih perlu penguatan pada Geometri dan Pengukuran terutama soal keliling dan luas bangun gabungan.",
    kelebihanSiswa:
      "Kamu sangat kuat pada sub-materi Bilangan Cacah dan Bulat serta Penyajian Data (100%). Kemampuan membaca tabel dan diagram serta menyelesaikan operasi hitung bilangan bulat sudah sangat baik.",
    kekuranganSiswa:
      "Pada Bangun Datar kamu belum menjawab benar satu pun soal. Jawabanmu menunjukkan kebiasaan menjumlahkan semua sisi tanpa mengurangi sisi yang berimpit saat bangun digabung, sehingga keliling gabungan terlalu besar.",
    rekomendasi: [
      "Latih soal keliling bangun gabungan dengan menggambar ulang bentuknya dan mencoret sisi yang berimpit sebelum menjumlahkan.",
      "Ulangi materi persamaan linear satu variabel, khususnya mengubah soal cerita menjadi model matematika.",
      "Kerjakan 5 soal volume bangun ruang tiap hari dan periksa satuan sebelum menghitung.",
    ],
  },
  generatedAt: new Date("2026-10-12T09:20:00.000Z"),
};

export const IDENTITAS_CONTOH: IdentitasRapor = {
  asalSekolah: "SDN Sukun 3 Malang",
  jenisTryOut: "mandiri",
  mataPelajaran: "Matematika",
  jenjang: "SD",
  kodeSoal: "MAT-SD-PT1",
  mulaiAt: new Date("2026-10-12T08:38:00.000Z"),
  selesaiAt: new Date("2026-10-12T09:12:00.000Z"),
};
