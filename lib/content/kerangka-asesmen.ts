/**
 * Kerangka Asesmen TKA - Matematika & Bahasa Indonesia, jenjang SD & SMP.
 * Sumber: Kementerian Pendidikan Dasar dan Menengah RI (Pusmendik),
 * https://pusmendik.kemendikdasmen.go.id/tka/tka/view/mata-pelajaran-wajib/{sd|smp}
 * Ditranskrip dari halaman resmi - Contoh Soal sengaja tidak disertakan.
 */

export type Jenjang = "SD" | "SMP";
export type MataPelajaran = "matematika" | "bahasa-indonesia";

export type MatematikaMatriksRow = {
  no: number;
  elemen: string;
  subElemen: string;
  kompetensiIntro: string;
  poin: string[];
  batasan?: string;
};

export type MatematikaContent = {
  jenjang: Jenjang;
  mapel: "Matematika";
  definisi: string;
  muatan: { intro: string; elemen: string[]; outro: string };
  kompetensi:
    | { bentuk: "daftar"; intro: string; poin: string[] }
    | {
        bentuk: "level";
        intro: string;
        level: { label: string; nama: string; proses: { nama: string; deskripsi: string }[] }[];
      };
  matriks: MatematikaMatriksRow[];
};

export type BahasaMatriksRow = {
  no: number;
  kompetensi: string;
  subkompetensi: string[];
};

export type BahasaContent = {
  jenjang: Jenjang;
  mapel: "Bahasa Indonesia";
  definisi: string;
  muatan: { intro: string; jenisTeks: string[]; karakteristikIntro: string; karakteristik: string[] };
  kompetensi: {
    aspekIntro: string;
    aspek: string[];
    kelompokIntro: string;
    kelompok: { label: string; deskripsi: string }[];
  };
  matriks: BahasaMatriksRow[];
};

const matematikaSd: MatematikaContent = {
  jenjang: "SD",
  mapel: "Matematika",
  definisi:
    "TKA Matematika SD/MI sederajat mengukur kemampuan murid dalam memahami fakta, konsep, prinsip, dan prosedur matematika, serta kemampuan mereka dalam menerapkan pengetahuan matematika untuk menyelesaikan masalah (problem solving).",
  muatan: {
    intro:
      "Muatan TKA Matematika SD/MI sederajat merujuk pada elemen kurikulum atau materi matematika yang dipelajari murid yang ada pada Kurikulum 2013 dan Kurikulum Merdeka. Elemen ini meliputi:",
    elemen: ["Bilangan", "Geometri dan Pengukuran", "Data"],
    outro:
      "Pengetahuan matematika diukur melalui permasalahan dalam konteks matematika dan permasalahan dalam konteks keseharian yang dapat meliputi kejadian atau situasi di lingkup personal, keluarga, atau lingkungan sekitar.",
  },
  kompetensi: {
    bentuk: "daftar",
    intro: "Tes Kemampuan Akademik (TKA) Matematika SD/MI sederajat mengukur kemampuan matematis sebagai berikut:",
    poin: ["Pengetahuan matematika", "Representasi matematis", "Penalaran", "Pemecahan masalah matematika", "Koneksi matematis"],
  },
  matriks: [
    {
      no: 1,
      elemen: "Bilangan",
      subElemen: "Bilangan Rasional",
      kompetensiIntro:
        "Memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait cakupan sub-elemen berikut:",
      poin: [
        "Pecahan sederhana menggunakan gambar dan simbol matematika;",
        "Perbandingan dan pengurutan bilangan pecahan;",
        "Relasi berbagai bentuk pecahan (pecahan sederhana, desimal, persen);",
        "Operasi penjumlahan, pengurangan, perkalian, dan pembagian bilangan cacah;",
        "Operasi penjumlahan dan pengurangan bilangan pecahan, serta operasi perkalian dan pembagian bilangan asli;",
        "Kelipatan, faktor, KPK, dan FPB bilangan asli.",
      ],
    },
    {
      no: 2,
      elemen: "Geometri dan Pengukuran",
      subElemen: "Objek Geometri",
      kompetensiIntro:
        "Memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait cakupan sub-elemen berikut:",
      poin: ["Bentuk bangun datar;", "Konstruksi bangun ruang dari visualisasi spasial (bagian depan, atas, dan samping)."],
      batasan: "Bangun datar mencakup segitiga, segiempat, dan segi banyak; bangun ruang mencakup kubus, balok, dan gabungannya.",
    },
    {
      no: 2,
      elemen: "Geometri dan Pengukuran",
      subElemen: "Pengukuran",
      kompetensiIntro:
        "Memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait cakupan sub-elemen berikut:",
      poin: [
        "Panjang benda menggunakan satuan baku;",
        "Hubungan antar-satuan baku panjang (mm, cm, dm, m, dam, hm, km);",
        "Volume benda menggunakan satuan baku;",
        "Hubungan antar-satuan baku volume (ml, cl, dl, l, dal, hl, kl);",
        "Berat benda menggunakan satuan baku;",
        "Hubungan antar-satuan baku berat (mg, cg, dg, g, dag, hg, kg);",
        "Waktu;",
        "Hubungan antar-satuan waktu (detik, menit, jam, hari, pekan, bulan, tahun);",
        "Luas permukaan bangun datar;",
        "Keliling dan luas bangun datar (segitiga, segiempat, dan segi banyak);",
        "Volume bangun ruang (kubus, balok, dan gabungannya);",
        "Besar sudut;",
        "Perkiraan/estimasi ukuran.",
      ],
    },
    {
      no: 3,
      elemen: "Data",
      subElemen: "Penyajian dan Penggunaan Data",
      kompetensiIntro:
        "Memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait cakupan sub-elemen berikut:",
      poin: ["Penyajian data (gambar, piktogram, diagram batang, dan tabel frekuensi);", "Pengambilan informasi dan penggunaan data."],
    },
  ],
};

const matematikaSmp: MatematikaContent = {
  jenjang: "SMP",
  mapel: "Matematika",
  definisi:
    "Asesmen standar nasional yang dirancang untuk mengukur capaian akademik dan penguasaan konsep inti murid pada mata pelajaran tertentu sesuai kurikulum. Tes Kemampuan Akademik (TKA) bertujuan memberikan informasi objektif mengenai kompetensi siswa, bersifat sukarela, serta hasilnya dapat digunakan untuk jalur prestasi seleksi masuk sekolah.",
  muatan: {
    intro:
      "Muatan TKA Matematika SMP/MTs/sederajat merujuk pada elemen kurikulum atau materi matematika yang dipelajari murid yang ada pada Kurikulum 2013 dan Kurikulum Merdeka. Elemen ini meliputi:",
    elemen: ["Bilangan", "Aljabar", "Geometri dan pengukuran", "Data dan peluang"],
    outro:
      "Penggunaan logika matematika diintegrasikan langsung dengan elemen matematika yang tertera dalam kurikulum. Pengetahuan matematika diukur melalui permasalahan dalam konteks matematika dan permasalahan dalam konteks keseharian.",
  },
  kompetensi: {
    bentuk: "level",
    intro: "Kompetensi TKA Matematika SMP/MTs sederajat diukur melalui tiga level kognitif berikut:",
    level: [
      {
        label: "Level 1",
        nama: "Pengetahuan & Pemahaman (Knowing and Understanding)",
        proses: [
          { nama: "Menghitung", deskripsi: "Melakukan perhitungan berdasarkan prosedur yang mencakup operasi hitung aritmatika (+, −, ×, ÷, atau kombinasinya), operasi aljabar, atau operasi matematika lainnya." },
          { nama: "Memahami informasi", deskripsi: "Memahami informasi dari grafik fungsi, tabel, diagram, infografis, atau bentuk visual lainnya." },
          { nama: "Mengelompokkan", deskripsi: "Mengelompokkan objek berdasarkan fakta, konsep, dan prinsip matematika dalam cakupan sub-elemen." },
          { nama: "Mengidentifikasi", deskripsi: "Melakukan identifikasi terhadap objek menggunakan konsep, fakta, dan prinsip matematika dalam cakupan sub-elemen." },
        ],
      },
      {
        label: "Level 2",
        nama: "Aplikasi (Applying)",
        proses: [
          { nama: "Memodelkan", deskripsi: "Memodelkan permasalahan kontekstual terkait cakupan sub-elemen ke dalam kalimat matematika." },
          { nama: "Mengaplikasikan", deskripsi: "Mengaplikasikan strategi dan operasi matematika (operasi hitung, aljabar, atau bentuk operasi lainnya) untuk menyelesaikan permasalahan yang melibatkan konsep dan prosedur matematis yang familiar dan rutin." },
          { nama: "Menginterpretasikan", deskripsi: "Memahami dan menjelaskan makna dari berbagai situasi, kejadian, pernyataan, representasi, atau masalah matematika." },
        ],
      },
      {
        label: "Level 3",
        nama: "Penalaran (Reasoning)",
        proses: [
          { nama: "Menganalisis", deskripsi: "Menentukan, menjelaskan, dan menggunakan hubungan beberapa konsep, fakta, prinsip, atau prosedur matematika dalam cakupan sub-elemen." },
          { nama: "Memecahkan masalah", deskripsi: "Mengaitkan beberapa konsep, fakta, prinsip, prosedur, dan representasi matematika dalam cakupan sub-elemen, untuk menyelesaikan permasalahan dalam situasi baru atau konteks yang tidak rutin." },
          { nama: "Mengevaluasi", deskripsi: "Mengevaluasi alternatif strategi dan solusi dari suatu pemecahan masalah." },
          { nama: "Menyimpulkan", deskripsi: "Menarik kesimpulan yang valid dari informasi, data, atau bukti yang diberikan menggunakan konsep, fakta, prinsip, dan prosedur matematika dalam cakupan sub-elemen." },
          { nama: "Melakukan generalisasi", deskripsi: "Menyusun pernyataan matematis yang menggambarkan hubungan yang lebih umum terkait konsep, fakta, prinsip, dan prosedur dalam cakupan sub-elemen." },
        ],
      },
    ],
  },
  matriks: [
    {
      no: 1,
      elemen: "Bilangan",
      subElemen: "Bilangan Real",
      kompetensiIntro: "Memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait cakupan sub-elemen berikut:",
      poin: [
        "Perbandingan dan sifat-sifat bilangan;",
        "Operasi aritmetika pada bilangan;",
        "Estimasi/perkiraan hasil perhitungan;",
        "Faktorisasi prima bilangan asli;",
        "Rasio (skala, proporsi, dan laju perubahan);",
        "Perbandingan senilai dan berbalik nilai.",
      ],
      batasan: "Bilangan mencakup bilangan bulat, bilangan rasional dan irasional, bilangan berpangkat bulat, bilangan akar, dan bilangan dalam notasi ilmiah.",
    },
    {
      no: 2,
      elemen: "Aljabar",
      subElemen: "Persamaan dan Pertidaksamaan Linier",
      kompetensiIntro: "Memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait cakupan sub-elemen berikut:",
      poin: ["Persamaan linear satu variabel;", "Pertidaksamaan linear satu variabel;", "Sistem persamaan linear dua variabel."],
    },
    {
      no: 2,
      elemen: "Aljabar",
      subElemen: "Bentuk Aljabar",
      kompetensiIntro: "Memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait cakupan sub-elemen berikut:",
      poin: ["Bentuk aljabar dan sifat-sifat operasinya (komutatif, asosiatif, dan distributif)."],
    },
    {
      no: 2,
      elemen: "Aljabar",
      subElemen: "Fungsi",
      kompetensiIntro: "Memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait cakupan sub-elemen berikut:",
      poin: ["Relasi dan fungsi (domain, kodomain, range), serta penyajiannya."],
    },
    {
      no: 2,
      elemen: "Aljabar",
      subElemen: "Barisan dan Deret",
      kompetensiIntro: "Memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait cakupan sub-elemen berikut:",
      poin: ["Barisan berhingga bilangan;", "Deret berhingga bilangan."],
    },
    {
      no: 3,
      elemen: "Geometri dan Pengukuran",
      subElemen: "Objek Geometri",
      kompetensiIntro: "Memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait cakupan sub-elemen berikut:",
      poin: [
        "Hubungan antar-sudut yang terbentuk oleh dua garis yang berpotongan, dan oleh dua garis sejajar yang dipotong suatu garis transversal (termasuk penentuan besar sudut dalam segitiga);",
        "Teorema Pythagoras;",
        "Kekongruenan dan kesebangunan bangun datar;",
        "Jaring-jaring bangun ruang (prisma, tabung, limas dan kerucut).",
      ],
    },
    {
      no: 3,
      elemen: "Geometri dan Pengukuran",
      subElemen: "Transformasi Geometri",
      kompetensiIntro: "Memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait cakupan sub-elemen berikut:",
      poin: ["Transformasi tunggal (refleksi, translasi, rotasi, dan dilatasi) terhadap titik, garis, dan bangun datar pada bidang."],
    },
    {
      no: 3,
      elemen: "Geometri dan Pengukuran",
      subElemen: "Pengukuran",
      kompetensiIntro: "Memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait cakupan sub-elemen berikut:",
      poin: [
        "Keliling dan luas bangun datar (daerah segi banyak dan daerah lingkaran, serta daerah gabungannya);",
        "Volume bangun ruang (prisma, limas, dan bola).",
      ],
    },
    {
      no: 4,
      elemen: "Data dan Peluang",
      subElemen: "Data",
      kompetensiIntro: "Memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait cakupan sub-elemen berikut:",
      poin: [
        "Perumusan pertanyaan untuk mendapatkan data, serta penyajian, dan penginterpretasian data;",
        "Penentuan dan penaksiran rerata (mean), median, modus, dan jangkauan (range) dari data;",
        "Perbandingan ukuran pemusatan dan ukuran penyebaran beberapa kelompok data.",
      ],
      batasan: "Penyajian data meliputi: diagram batang, diagram garis, diagram lingkaran, dan tabel.",
    },
    {
      no: 4,
      elemen: "Data dan Peluang",
      subElemen: "Peluang",
      kompetensiIntro: "Memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan terkait cakupan sub-elemen berikut:",
      poin: ["Peluang dan frekuensi relatif dari kejadian tunggal."],
    },
  ],
};

const bahasaIndonesiaSd: BahasaContent = {
  jenjang: "SD",
  mapel: "Bahasa Indonesia",
  definisi:
    "TKA Bahasa Indonesia SD/MI sederajat difokuskan pada satu keterampilan berbahasa, yakni membaca. Membaca dipilih sebagai fokus karena merupakan keterampilan yang menjadi fondasi untuk belajar dan bekerja pada era teknologi yang berubah dan berkembang sangat cepat.",
  muatan: {
    intro: "Keterampilan membaca disajikan pada dua jenis teks, yaitu teks informasi dan teks fiksi.",
    jenisTeks: [
      "Teks informasi merupakan teks yang berisi fakta, konsep, atau prosedur dari berbagai bidang atau topik yang berskala lokal dan nasional.",
      "Teks fiksi merupakan cerita rekaan yang dapat berupa fantasi atau faktual (sejarah/biografi) dengan latar cerita konkret, tokoh berkarakter datar, konflik tunggal atau jamak dengan penyelesaian tertutup, alur campuran, dan sudut pandang orang ketiga.",
    ],
    karakteristikIntro: "Teks yang digunakan TKA memiliki karakteristik kosakata, kalimat, dan wacana sebagai berikut:",
    karakteristik: [
      "Karakteristik kosakata: kata dasar, kata berimbuhan, kata konkret, dominan makna denotatif, makna konotatif/makna konteks terbatas.",
      "Karakteristik kalimat: jumlah kata 5–7 per kalimat, pola kalimat dasar S-P-O-K, struktur bahasa tidak bercampur bahasa lisan terbatas.",
      "Karakteristik wacana: kohesi pengulangan/referensi, konjungsi antarparagraf/penambahan/penjelasan, panjang teks 150–200 kata (kecuali teks puisi).",
    ],
  },
  kompetensi: {
    aspekIntro: "Aspek keterampilan membaca yang diukur adalah:",
    aspek: [
      "Mengidentifikasi informasi tersurat dalam teks.",
      "Menyusun ulang, mengelompokkan, membuat ikhtisar, dan menyajikan kembali informasi tersurat dalam teks.",
      "Mengidentifikasi dan menyimpulkan informasi tersurat dalam teks.",
      "Menilai gagasan, fakta, atau opini dalam teks.",
      "Menanggapi isi teks, merefleksi diri dengan tokoh atau kejadian, dan menanggapi bahasa penulis dalam teks.",
    ],
    kelompokIntro: "Aspek-aspek tersebut dikelompokkan ke dalam tiga kompetensi, yaitu:",
    kelompok: [
      { label: "Pemahaman tekstual", deskripsi: "Kemampuan untuk memahami informasi yang dikemukakan secara eksplisit, mengelompokkan, menyusun ulang, dan menyajikan kembali informasi secara eksplisit dari teks." },
      { label: "Pemahaman inferensial", deskripsi: "Kemampuan untuk menarik kesimpulan berdasarkan informasi yang tersirat dalam teks." },
      { label: "Evaluasi dan apresiasi", deskripsi: "Kemampuan untuk membuat penilaian terhadap ide, gagasan, atau isi teks secara emosional dan estetis dengan mempertimbangkan dampaknya terhadap perasaan, imajinasi, serta penggunaan bahasa oleh penulis." },
    ],
  },
  matriks: [
    {
      no: 1,
      kompetensi: "Pemahaman Tekstual",
      subkompetensi: [
        "Mengidentifikasi penggunaan kosakata secara umum dan khusus dalam berbagai bidang.",
        "Mengidentifikasi objek berdasarkan kosakata yang digunakan dalam teks fiksi dan nonfiksi.",
        "Menyusun kembali informasi dari teks nonfiksi dalam bentuk bagan.",
        "Mengidentifikasi informasi tersurat dalam teks.",
      ],
    },
    {
      no: 2,
      kompetensi: "Pemahaman Inferensial",
      subkompetensi: [
        "Menyimpulkan ide pokok, gagasan pendukung, tokoh, peristiwa, dan/atau nilai-nilai dalam teks.",
        "Menjelaskan makna ungkapan yang digunakan dalam teks.",
      ],
    },
    {
      no: 3,
      kompetensi: "Evaluasi dan Apresiasi",
      subkompetensi: [
        "Menilai relevansi peristiwa dalam teks dengan kehidupan sehari-hari berdasarkan pengalaman atau pengetahuan pribadi.",
        "Menilai kesesuaian antarperistiwa dan/atau antarinformasi dalam teks.",
        "Menyimpulkan respons emosional terhadap unsur teks fiksi.",
      ],
    },
  ],
};

const bahasaIndonesiaSmp: BahasaContent = {
  jenjang: "SMP",
  mapel: "Bahasa Indonesia",
  definisi:
    "Sebagaimana TKA Bahasa Indonesia SD/MI sederajat, TKA Bahasa Indonesia SMP/MTs/sederajat juga difokuskan pada keterampilan membaca.",
  muatan: {
    intro: "Keterampilan membaca disajikan pada dua jenis teks, yaitu teks informasi dan teks fiksi.",
    jenisTeks: [
      "Teks informasi merupakan teks yang berisi fakta, konsep, atau prosedur dari berbagai bidang atau topik yang berskala lokal, nasional, atau global.",
      "Teks fiksi merupakan cerita rekaan yang dapat berupa fantasi atau realisme dengan latar cerita konkret atau abstrak, tokoh berkarakter bulat, konflik tunggal atau jamak dengan penyelesaian tertutup, alur campuran, dan sudut pandang orang ketiga.",
    ],
    karakteristikIntro: "Teks yang digunakan TKA memiliki karakteristik kosakata, kalimat, dan wacana sebagai berikut:",
    karakteristik: [
      "Karakteristik kosakata: kata umum, kata berimbuhan/konfliks, kata abstrak, makna denotatif, istilah teknis, makna konotatif/konteks tertentu.",
      "Karakteristik kalimat: jumlah kata per kalimat 5–9 kata, kalimat tunggal berbagai pola, kalimat majemuk setara.",
      "Karakteristik wacana: kohesi penyulihan/substitusi, konjungsi antarparagraf/perbandingan dan penekanan/intensifikasi, penggunaan tanda baca untuk mendukung deskripsi; panjang teks 200–250 kata (kecuali teks puisi).",
    ],
  },
  kompetensi: {
    aspekIntro: "Aspek keterampilan membaca yang diukur adalah:",
    aspek: [
      "Mengidentifikasi informasi tersurat dalam teks;",
      "Menyusun ulang, mengelompokkan, membuat ikhtisar, dan menyajikan kembali informasi tersurat dalam teks;",
      "Mengidentifikasi dan menyimpulkan informasi tersurat dalam teks; dan",
      "Menilai gagasan, fakta, atau opini dalam teks;",
      "Menanggapi isi teks, merefleksi diri dengan tokoh atau kejadian, dan menanggapi bahasa penulis dalam teks.",
    ],
    kelompokIntro: "Aspek-aspek tersebut dikelompokkan ke dalam tiga kompetensi, yaitu:",
    kelompok: [
      { label: "Pemahaman tekstual", deskripsi: "Kemampuan untuk memahami informasi yang dikemukakan secara eksplisit, mengelompokkan, menyusun ulang, dan menyajikan kembali informasi secara eksplisit dari teks." },
      { label: "Pemahaman inferensial", deskripsi: "Kemampuan untuk menarik kesimpulan berdasarkan informasi yang tersirat dalam teks." },
      { label: "Evaluasi dan apresiasi", deskripsi: "Kemampuan untuk membuat penilaian terhadap ide, gagasan, atau isi teks secara emosional dan estetis dengan mempertimbangkan dampaknya terhadap perasaan, imajinasi, serta penggunaan bahasa oleh penulis." },
    ],
  },
  matriks: [
    {
      no: 1,
      kompetensi: "Pemahaman Tekstual",
      subkompetensi: [
        "Mengidentifikasi penggunaan istilah dalam berbagai bidang.",
        "Mengidentifikasi objek dan/atau latar berdasarkan kosakata yang digunakan dalam teks fiksi atau nonfiksi.",
        "Mengidentifikasi informasi penting yang tersurat dalam teks.",
        "Menyusun kerangka atau bagan berdasarkan bagian-bagian penting dalam teks.",
      ],
    },
    {
      no: 2,
      kompetensi: "Pemahaman Inferensial",
      subkompetensi: [
        "Menyimpulkan ide pokok, gagasan pendukung, tokoh, peristiwa, latar, dan/atau nilai-nilai dalam dan/atau antarteks.",
        "Menjelaskan kelogisan hubungan antarperistiwa, antargagasan, dan/atau antarinformasi dalam dan/atau antarteks.",
        "Memprediksi peristiwa dalam teks.",
        "Menjelaskan bahasa khas dan citraan yang digunakan dalam teks fiksi.",
      ],
    },
    {
      no: 3,
      kompetensi: "Evaluasi dan Apresiasi",
      subkompetensi: [
        "Menilai relevansi peristiwa dalam teks dengan kehidupan sehari-hari.",
        "Menilai kesesuaian dan/atau keakuratan unsur, kebahasaan, atau isi berdasarkan perbandingan informasi dalam dan/atau antarteks.",
        "Menyimpulkan respons emosional terhadap unsur teks fiksi.",
      ],
    },
  ],
};

export const KERANGKA_ASESMEN: Record<Jenjang, Record<MataPelajaran, MatematikaContent | BahasaContent>> = {
  SD: { matematika: matematikaSd, "bahasa-indonesia": bahasaIndonesiaSd },
  SMP: { matematika: matematikaSmp, "bahasa-indonesia": bahasaIndonesiaSmp },
};

export const SUMBER_URL: Record<Jenjang, string> = {
  SD: "https://pusmendik.kemendikdasmen.go.id/tka/tka/view/mata-pelajaran-wajib/sd",
  SMP: "https://pusmendik.kemendikdasmen.go.id/tka/tka/view/mata-pelajaran-wajib/smp",
};
