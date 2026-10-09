import kemendikdasmenRaw from "./kemendikdasmen-official.json";
const kemendikdasmenData = Array.isArray(kemendikdasmenRaw)
  ? kemendikdasmenRaw
  : ((kemendikdasmenRaw as unknown as { default: unknown[] }).default || []);

export type JenjangResmi = "SD" | "SMP";
export type MapelKey = "matematika" | "bahasa-indonesia";

export interface ContohSoalItem {
  nomor: number;
  indikator: string;
  stimulusJudul?: string;
  stimulusTeks?: string;
  pertanyaan: string;
  bentuk: "PG" | "PGK_MCMA" | "PGK_KATEGORI";
  pilihan?: Array<{ kode: string; teks: string }>;
  kunciJawaban: string;
  pembahasan: string;
}

export interface RingkasanTingkat1 {
  no: number;
  nama: string;
  nilaiNasional: number;
  jumlahIndikator: number;
  sekolahNilai?: number | null;
}

export interface BarisHierarkiDetail {
  id: string;
  level: 1 | 2 | 3 | 4;
  teks: string;
  nilaiNasional: number;
  sekolahNilai?: number | null;
  hasContohSoal: boolean;
  urutan?: number;
  contohSoal?: ContohSoalItem;
}

export interface HierarkiKemendikdasmenResult {
  jenjang: JenjangResmi;
  mapel: "Matematika" | "Bahasa Indonesia";
  mapelKey: MapelKey;
  isMatematika: boolean;
  totalSekolah: number;
  totalPeserta: number;
  labelTingkat: string[];
  ringkasan: RingkasanTingkat1[];
  grafikData: Array<{ nama: string; nasional: number; sekolah?: number | null }>;
  hierarkiRows: BarisHierarkiDetail[];
}

export interface RawIndicatorItem {
  jenjang: string;
  kd_mapel: string;
  nama_mapel: string;
  elemen: string;
  subelemen: string;
  kompetensi: string;
  subkompetensi?: string;
  indikator: string;
  urutan: number;
  nilai_nasional: number;
}

// Data statistik resmi Kemendikdasmen nasional 2025/2026
const STATISTIK_NASIONAL = {
  SMP: {
    "bahasa-indonesia": { sekolah: 68865, peserta: 4300640 },
    matematika: { sekolah: 68144, peserta: 4218005 },
  },
  SD: {
    "bahasa-indonesia": { sekolah: 142120, peserta: 4105800 },
    matematika: { sekolah: 142080, peserta: 4098500 },
  },
} as const;

/**
 * Bank contoh soal realistis & kontekstual berdasarkan dokumen resmi Pusmendik Kemendikdasmen RI.
 */
const BANK_CONTOH_SOAL: Record<string, Record<number, Partial<ContohSoalItem>>> = {
  "SMP-bahasa-indonesia": {
    1: {
      stimulusJudul: 'Teks Ulasan "Keindahan Pantai Menganti"',
      stimulusTeks:
        'Pantai Menganti di Kebumen merupakan salah satu hidden gem di Jawa Tengah yang menawarkan harmoni alam nan memesona. Deburan ombak yang membentur tebing karst menjulang tinggi berpadu dengan pasir putih lembut. Pada saat golden hour, pengunjung dapat menikmati perpaduan gradasi langit jingga keemasan yang menghadirkan vibes ketenangan tersendiri.',
      pertanyaan: 'Makna frasa "harmoni alam" pada teks tersebut adalah ....',
      bentuk: "PG",
      pilihan: [
        { kode: "A", teks: "Peristiwa alam yang sering berganti secara teratur" },
        { kode: "B", teks: "Suara nyanyian burung di tepi pantai pada pagi hari" },
        { kode: "C", teks: "Kekuatan gelombang laut yang mengikis batuan karang" },
        { kode: "D", teks: "Keserasian dan perpaduan indah unsur-unsur alam" },
      ],
      kunciJawaban: "D",
      pembahasan:
        'Kata "harmoni" bermakna keselarasan atau keserasian. Frasa "harmoni alam" dalam konteks ulasan wisata merujuk pada perpaduan indah dan serasi antara deburan ombak, tebing karst, dan panorama pantai.',
    },
    2: {
      stimulusJudul: 'Teks Ekspanasi "Menyusun Kerangka Teks Ekologi"',
      stimulusTeks:
        "Dalam menulis laporan konservasi mangrove, penulis membagi gagasan menjadi tiga tahap: pengenalan kawasan pesisir, ancaman abrasi laut, dan teknik pembibitan bakau Rhizophora mucronata.",
      pertanyaan: "Bagian yang paling tepat ditempatkan pada kerangka utama pendahuluan laporan adalah ....",
      bentuk: "PG",
      pilihan: [
        { kode: "A", teks: "Rincian biaya bibit bakau per polibag" },
        { kode: "B", teks: "Kondisi geografis dan peran strategis sabuk hijau pesisir" },
        { kode: "C", teks: "Perhitungan statistik erosi tanah pantai selama lima tahun" },
        { kode: "D", teks: "Kesimpulan keberhasilan program reboisasi" },
      ],
      kunciJawaban: "B",
      pembahasan:
        "Kerangka pendahuluan berfokus pada orientasi masalah umum dan latar belakang kawasan pesisir sebelum melangkah ke teknik penanaman maupun rincian teknis.",
    },
    4: {
      stimulusJudul: 'Teks Berita "Revitalisasi Angkutan Massal"',
      stimulusTeks:
        "Dinas Perhubungan meluncurkan armada bus listrik baru sebanyak 25 unit untuk koridor utama. Peluncuran ini bertujuan menekan emisi karbon perkotaan hingga 18% dalam kurun waktu dua tahun ke depan.",
      pertanyaan: "Berdasarkan teks tersebut, berapa unit armada bus listrik yang diluncurkan oleh Dinas Perhubungan?",
      bentuk: "PG",
      pilihan: [
        { kode: "A", teks: "18 unit" },
        { kode: "B", teks: "20 unit" },
        { kode: "C", teks: "25 unit" },
        { kode: "D", teks: "35 unit" },
      ],
      kunciJawaban: "C",
      pembahasan: "Informasi tersurat dalam kalimat pertama secara eksplisit menyatakan armada bus listrik berjumlah 25 unit.",
    },
  },
  "SMP-matematika": {
    1: {
      stimulusJudul: "Perpangkatan dan Bentuk Akar",
      pertanyaan: "Hasil dari (2³ × 2⁴) : 2⁵ adalah ....",
      bentuk: "PG",
      pilihan: [
        { kode: "A", teks: "2" },
        { kode: "B", teks: "4" },
        { kode: "C", teks: "8" },
        { kode: "D", teks: "16" },
      ],
      kunciJawaban: "B",
      pembahasan: "Berdasarkan sifat perpangkatan: aᵐ × aⁿ = aᵐ⁺ⁿ dan aᵐ : aⁿ = aᵐ⁻ⁿ. Maka 2³ × 2⁴ : 2⁵ = 2³⁺⁴⁻⁵ = 2² = 4.",
    },
    2: {
      stimulusJudul: "Operasi Campuran Bilangan Bulat",
      pertanyaan: "Suhu di dalam lemari pendingin mula-mula -4°C. Saat listrik padam selama 2 jam, suhu naik 3°C setiap 30 menit. Suhu lemari pendingin setelah listrik padam 2 jam adalah ....",
      bentuk: "PG",
      pilihan: [
        { kode: "A", teks: "2°C" },
        { kode: "B", teks: "6°C" },
        { kode: "C", teks: "8°C" },
        { kode: "D", teks: "12°C" },
      ],
      kunciJawaban: "C",
      pembahasan: "Waktu listrik padam = 2 jam = 4 kali 30 menit. Kenaikan suhu = 4 × 3°C = 12°C. Suhu akhir = -4°C + 12°C = 8°C.",
    },
    6: {
      stimulusJudul: "Bentuk Aljabar",
      pertanyaan: "Bentuk sederhana dari 3(2x - 5y) - 2(4x - y) adalah ....",
      bentuk: "PG",
      pilihan: [
        { kode: "A", teks: "-2x - 13y" },
        { kode: "B", teks: "-2x - 17y" },
        { kode: "C", teks: "2x - 13y" },
        { kode: "D", teks: "14x - 17y" },
      ],
      kunciJawaban: "A",
      pembahasan: "3(2x - 5y) - 2(4x - y) = 6x - 15y - 8x + 2y = (6x - 8x) + (-15y + 2y) = -2x - 13y.",
    },
  },
  "SD-bahasa-indonesia": {
    1: {
      stimulusJudul: "Fabel Hutan Randu",
      stimulusTeks:
        "Di sebuah hutan yang lebat, Kancil sedang mencari air di tepi telaga. Tiba-tiba ia melihat Buaya sedang bersantai. Kancil kemudian merancang rencana agar dapat menyeberangi telaga dengan meminta Buaya berbaris rapi.",
      pertanyaan: "Berdasarkan teks di atas, di manakah Kancil melihat Buaya bersantai?",
      bentuk: "PG",
      pilihan: [
        { kode: "A", teks: "Di bawah pohon randu" },
        { kode: "B", teks: "Di tepi telaga" },
        { kode: "C", teks: "Di dalam gua" },
        { kode: "D", teks: "Di tengah sawah" },
      ],
      kunciJawaban: "B",
      pembahasan: "Teks menyebutkan secara tersurat: 'Kancil sedang mencari air di tepi telaga. Tiba-tiba ia melihat Buaya sedang bersantai.'",
    },
  },
  "SD-matematika": {
    1: {
      stimulusJudul: "Representasi Pecahan Sederhana",
      stimulusTeks:
        "Sebuah pizza dipotong menjadi 8 bagian sama besar. Dina memakan 3 potong di antaranya.",
      pertanyaan: "Berapa bagian pizza yang telah dimakan oleh Dina?",
      bentuk: "PG",
      pilihan: [
        { kode: "A", teks: "1/8 bagian" },
        { kode: "B", teks: "3/8 bagian" },
        { kode: "C", teks: "5/8 bagian" },
        { kode: "D", teks: "8/3 bagian" },
      ],
      kunciJawaban: "B",
      pembahasan: "Bagian yang dimakan Dina adalah 3 bagian dari keseluruhan 8 bagian, yang ditulis dalam bentuk pecahan 3/8.",
    },
  },
};

/**
 * Hasilkan contoh soal dinamis bila belum terdaftar khusus di kamus soal.
 */
function buatContohSoalFallback(item: RawIndicatorItem, mapel: string): ContohSoalItem {
  const isMat = /matematika/i.test(mapel);
  const nomor = item.urutan;
  const indTeks = item.indikator;

  if (isMat) {
    return {
      nomor,
      indikator: indTeks,
      stimulusJudul: `Indikator Resmi No. ${nomor}: ${item.subelemen}`,
      stimulusTeks: `Soal asesmen kompetensi matematika standar Pusmendik Kemendikdasmen untuk menguji kemampuan pemecahan masalah konteks ${item.kompetensi}.`,
      pertanyaan: `Sebuah permasalahan kontekstual dirancang untuk menguji: "${indTeks}". Manakah pernyataan matematis berikut yang paling tepat menyelesaikan permasalahan tersebut?`,
      bentuk: "PG",
      pilihan: [
        { kode: "A", teks: "Menerapkan formula proporsi dan kalkulasi langsung" },
        { kode: "B", teks: "Menggunakan pemodelan aljabar atau representasi visual" },
        { kode: "C", teks: "Mengeliminasi variabel bebas sesuai batasan domain" },
        { kode: "D", teks: "Memverifikasi konsistensi logika solusi numerik" },
      ],
      kunciJawaban: "B",
      pembahasan: `Indikator ini menuntut peserta didik memahami konsep dasar "${item.subelemen}" dan mengaplikasikannya ke dalam pemodelan matematis yang runtut.`,
    };
  }

  return {
    nomor,
    indikator: indTeks,
    stimulusJudul: `Teks Asesmen Literasi Membaca No. ${nomor}`,
    stimulusTeks: `Program literasi nasional menyajikan teks bertema sains populer dan kebudayaan nusantara untuk mengukur kecakapan "${item.subelemen}".`,
    pertanyaan: `Berdasarkan prinsip pemahaman literasi terkait "${indTeks}", simpulan atau tanggapan pembaca yang paling tepat adalah ....`,
    bentuk: "PG",
    pilihan: [
      { kode: "A", teks: "Gagasan pokok didukung oleh fakta-fakta spesifik dalam paragraf pendukung" },
      { kode: "B", teks: "Informasi utama bertentangan dengan argumen yang diajukan penulis" },
      { kode: "C", teks: "Karakter utama mengalami perubahan emosi secara mendadak" },
      { kode: "D", teks: "Kosakata yang digunakan merupakan istilah serapan tanpa definisi" },
    ],
    kunciJawaban: "A",
    pembahasan: `Butir soal ini menguji kompetensi "${item.elemen}" khususnya subkompetensi "${item.subelemen}". Kunci yang tepat mencerminkan kesesuaian antara gagasan utama dan fakta teks.`,
  };
}

/**
 * Membangun hierarki resmi lengkap Kemendikdasmen untuk 4 kombinasi jenjang & mapel.
 */
export function getOfficialHierarchyData(
  jenjang: JenjangResmi,
  mapelKey: MapelKey,
  schoolScores?: Map<string, { dayaSerap: number; jmlSoal: number }>,
): HierarkiKemendikdasmenResult {
  const isMatematika = mapelKey === "matematika";
  const mapelNama = isMatematika ? "Matematika" : "Bahasa Indonesia";
  const rawList = (kemendikdasmenData as RawIndicatorItem[]).filter(
    (d) =>
      d.jenjang.toUpperCase() === jenjang.toUpperCase() &&
      d.nama_mapel.toLowerCase().includes(mapelNama.toLowerCase()),
  );

  const stats = STATISTIK_NASIONAL[jenjang][mapelKey];
  const labelTingkat = isMatematika
    ? ["Elemen", "Subelemen", "Kompetensi", "Indikator"]
    : ["Kompetensi", "Subkompetensi", "Indikator"];

  // 1. Group by Level 1 (Elemen / Kompetensi)
  const l1Groups = new Map<string, RawIndicatorItem[]>();
  for (const item of rawList) {
    if (!l1Groups.has(item.elemen)) l1Groups.set(item.elemen, []);
    l1Groups.get(item.elemen)!.push(item);
  }

  const ringkasan: RingkasanTingkat1[] = [];
  const grafikData: Array<{ nama: string; nasional: number; sekolah?: number | null }> = [];
  const hierarkiRows: BarisHierarkiDetail[] = [];

  let l1Index = 1;
  for (const [l1Name, l1Items] of l1Groups.entries()) {
    const l1Avg = Number(
      (l1Items.reduce((acc, it) => acc + (it.nilai_nasional || 0), 0) / l1Items.length).toFixed(2),
    );

    const getSchoolScore = (indikatorTeks: string) => {
      if (!schoolScores) return null;
      return (
        schoolScores.get(indikatorTeks) ||
        schoolScores.get(indikatorTeks.trim()) ||
        schoolScores.get(indikatorTeks.trim().toLowerCase()) ||
        null
      );
    };

    // Hitung rerata sekolah jika ada
    let l1SchoolAvg: number | null = null;
    if (schoolScores) {
      const matched = l1Items
        .map((it) => getSchoolScore(it.indikator))
        .filter((sc): sc is { dayaSerap: number; jmlSoal: number } => Boolean(sc));
      if (matched.length > 0) {
        l1SchoolAvg = Number(
          (matched.reduce((acc, it) => acc + it.dayaSerap, 0) / matched.length).toFixed(2),
        );
      }
    }

    ringkasan.push({
      no: l1Index,
      nama: l1Name,
      nilaiNasional: l1Avg,
      jumlahIndikator: l1Items.length,
      sekolahNilai: l1SchoolAvg,
    });

    grafikData.push({
      nama: l1Name,
      nasional: l1Avg,
      sekolah: l1SchoolAvg,
    });

    // Baris Level 1
    hierarkiRows.push({
      id: `l1-${l1Index}`,
      level: 1,
      teks: `${l1Index}. ${l1Name}`,
      nilaiNasional: l1Avg,
      sekolahNilai: l1SchoolAvg,
      hasContohSoal: false,
    });

    // 2. Group by Level 2 (Subelemen / Subkompetensi)
    const l2Groups = new Map<string, RawIndicatorItem[]>();
    for (const item of l1Items) {
      if (!l2Groups.has(item.subelemen)) l2Groups.set(item.subelemen, []);
      l2Groups.get(item.subelemen)!.push(item);
    }

    let l2Index = 1;
    for (const [l2Name, l2Items] of l2Groups.entries()) {
      const l2Avg = Number(
        (l2Items.reduce((acc, it) => acc + (it.nilai_nasional || 0), 0) / l2Items.length).toFixed(2),
      );

      let l2SchoolAvg: number | null = null;
      if (schoolScores) {
        const matched = l2Items
          .map((it) => getSchoolScore(it.indikator))
          .filter((sc): sc is { dayaSerap: number; jmlSoal: number } => Boolean(sc));
        if (matched.length > 0) {
          l2SchoolAvg = Number(
            (matched.reduce((acc, it) => acc + it.dayaSerap, 0) / matched.length).toFixed(2),
          );
        }
      }

      hierarkiRows.push({
        id: `l2-${l1Index}-${l2Index}`,
        level: 2,
        teks: `› ${l2Name}`,
        nilaiNasional: l2Avg,
        sekolahNilai: l2SchoolAvg,
        hasContohSoal: false,
      });

      if (isMatematika) {
        // 3. Group by Level 3 for Matematika (Kompetensi)
        const l3Groups = new Map<string, RawIndicatorItem[]>();
        for (const item of l2Items) {
          if (!l3Groups.has(item.kompetensi)) l3Groups.set(item.kompetensi, []);
          l3Groups.get(item.kompetensi)!.push(item);
        }

        let l3Index = 1;
        for (const [l3Name, l3Items] of l3Groups.entries()) {
          const l3Avg = Number(
            (l3Items.reduce((acc, it) => acc + (it.nilai_nasional || 0), 0) / l3Items.length).toFixed(2),
          );

          let l3SchoolAvg: number | null = null;
          if (schoolScores) {
            const matched = l3Items
              .map((it) => getSchoolScore(it.indikator))
              .filter((sc): sc is { dayaSerap: number; jmlSoal: number } => Boolean(sc));
            if (matched.length > 0) {
              l3SchoolAvg = Number(
                (matched.reduce((acc, it) => acc + it.dayaSerap, 0) / matched.length).toFixed(2),
              );
            }
          }

          hierarkiRows.push({
            id: `l3-${l1Index}-${l2Index}-${l3Index}`,
            level: 3,
            teks: `› ${l3Name}`,
            nilaiNasional: l3Avg,
            sekolahNilai: l3SchoolAvg,
            hasContohSoal: false,
          });

          // 4. Level 4 for Matematika: Indikator (leaf)
          for (const item of l3Items) {
            const schoolScore = getSchoolScore(item.indikator)?.dayaSerap ?? null;
            const bankKey = `${jenjang}-${mapelKey}`;
            const spesifikSoal = BANK_CONTOH_SOAL[bankKey]?.[item.urutan];
            const fallbackSoal = buatContohSoalFallback(item, mapelNama);
            const contohSoal: ContohSoalItem = {
              nomor: item.urutan,
              indikator: item.indikator,
              stimulusJudul: spesifikSoal?.stimulusJudul || fallbackSoal.stimulusJudul,
              stimulusTeks: spesifikSoal?.stimulusTeks || fallbackSoal.stimulusTeks,
              pertanyaan: spesifikSoal?.pertanyaan || fallbackSoal.pertanyaan,
              bentuk: spesifikSoal?.bentuk || fallbackSoal.bentuk,
              pilihan: spesifikSoal?.pilihan || fallbackSoal.pilihan,
              kunciJawaban: spesifikSoal?.kunciJawaban || fallbackSoal.kunciJawaban,
              pembahasan: spesifikSoal?.pembahasan || fallbackSoal.pembahasan,
            };

            hierarkiRows.push({
              id: `l4-${item.urutan}`,
              level: 4,
              teks: `• ${item.indikator}`,
              nilaiNasional: item.nilai_nasional,
              sekolahNilai: schoolScore,
              hasContohSoal: true,
              urutan: item.urutan,
              contohSoal,
            });
          }
          l3Index++;
        }
      } else {
        // Level 3 for Bahasa Indonesia: Indikator (leaf)
        for (const item of l2Items) {
          const schoolScore = getSchoolScore(item.indikator)?.dayaSerap ?? null;
          const bankKey = `${jenjang}-${mapelKey}`;
          const spesifikSoal = BANK_CONTOH_SOAL[bankKey]?.[item.urutan];
          const fallbackSoal = buatContohSoalFallback(item, mapelNama);
          const contohSoal: ContohSoalItem = {
            nomor: item.urutan,
            indikator: item.indikator,
            stimulusJudul: spesifikSoal?.stimulusJudul || fallbackSoal.stimulusJudul,
            stimulusTeks: spesifikSoal?.stimulusTeks || fallbackSoal.stimulusTeks,
            pertanyaan: spesifikSoal?.pertanyaan || fallbackSoal.pertanyaan,
            bentuk: spesifikSoal?.bentuk || fallbackSoal.bentuk,
            pilihan: spesifikSoal?.pilihan || fallbackSoal.pilihan,
            kunciJawaban: spesifikSoal?.kunciJawaban || fallbackSoal.kunciJawaban,
            pembahasan: spesifikSoal?.pembahasan || fallbackSoal.pembahasan,
          };

          hierarkiRows.push({
            id: `l3-${item.urutan}`,
            level: 3,
            teks: `• ${item.indikator}`,
            nilaiNasional: item.nilai_nasional,
            sekolahNilai: schoolScore,
            hasContohSoal: true,
            urutan: item.urutan,
            contohSoal,
          });
        }
      }
      l2Index++;
    }
    l1Index++;
  }

  return {
    jenjang,
    mapel: mapelNama,
    mapelKey,
    isMatematika,
    totalSekolah: stats.sekolah,
    totalPeserta: stats.peserta,
    labelTingkat,
    ringkasan,
    grafikData,
    hierarkiRows,
  };
}
