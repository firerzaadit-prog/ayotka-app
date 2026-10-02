/**
 * Logika murni untuk skrip uji beban (seed & cleanup) - dipisah supaya bisa dites tanpa
 * database. Akun uji beban SELALU bisa dikenali & dihapus aman lewat tiga tanda sekaligus:
 * NISN berawalan "9", nama berawalan NAMA_AWALAN, dan milik sekolah uji beban.
 */

export const NAMA_AWALAN = "Load Test Siswa";
export const SEKOLAH_NAMA_BAWAAN = "Sekolah Load Test (hapus setelah uji)";
export const BATAS_JUMLAH_MAKS = 10_000;

/** NISN uji beban: 10 digit angka murni berawalan 9 (login memperlakukan 10 digit sebagai NISN). */
export function buatNisn(nomor: number): string {
  if (!Number.isInteger(nomor) || nomor < 1 || nomor > 99_999_999) {
    throw new Error(`Nomor siswa uji di luar jangkauan: ${nomor}`);
  }
  return `9${String(nomor).padStart(9, "0")}`;
}

export function emailDariNisn(nisn: string): string {
  return `${nisn}@nisn.ayotka.id`;
}

export function namaSiswa(nomor: number): string {
  return `${NAMA_AWALAN} ${nomor}`;
}

/** Cocok dengan format NISN uji beban. Dipakai sebagai pengaman tambahan sebelum menghapus apa pun. */
export function adalahNisnUjiBeban(nisn: string | null | undefined): boolean {
  return typeof nisn === "string" && /^9\d{9}$/.test(nisn);
}

export function adalahNamaUjiBeban(nama: string | null | undefined): boolean {
  return typeof nama === "string" && nama.startsWith(`${NAMA_AWALAN} `);
}

/** Jumlah akun yang diminta: bilangan bulat 1..BATAS_JUMLAH_MAKS, kalau tidak -> galat jelas (bukan diam-diam dibulatkan). */
export function parseJumlah(nilai: string | undefined, bawaan = 100): number {
  if (nilai == null || nilai.trim() === "") return bawaan;
  const n = Number(nilai);
  if (!Number.isInteger(n) || n < 1 || n > BATAS_JUMLAH_MAKS) {
    throw new Error(`LOAD_TEST_COUNT harus bilangan bulat 1-${BATAS_JUMLAH_MAKS}, bukan "${nilai}".`);
  }
  return n;
}

/** Host dari connection string database (tanpa kata sandi). */
export function hostDatabase(url: string | undefined): string {
  if (!url) throw new Error("DATABASE_URL tidak diisi.");
  try {
    return new URL(url).hostname;
  } catch {
    throw new Error("DATABASE_URL bukan URL yang valid.");
  }
}

/** ID proyek Supabase dari connection string database: pengguna "postgres.<id>" (pooler) atau host "db.<id>.supabase.co". */
export function refProyekDariDatabase(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const dariPengguna = /^postgres\.([a-z0-9]+)$/.exec(decodeURIComponent(u.username));
    if (dariPengguna) return dariPengguna[1]!;
    const dariHost = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(u.hostname);
    return dariHost ? dariHost[1]! : null;
  } catch {
    return null;
  }
}

/** ID proyek Supabase dari NEXT_PUBLIC_SUPABASE_URL ("https://<id>.supabase.co"). */
export function refProyekDariSupabaseUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const m = /^([a-z0-9]+)\.supabase\.co$/.exec(new URL(url).hostname);
    return m ? m[1]! : null;
  } catch {
    return null;
  }
}

/**
 * Pengaman: skrip yang menulis/menghapus data massal HANYA jalan kalau pemakai mengetik ID proyek
 * tujuan di LOAD_TEST_CONFIRM_PROJECT. Yang dikonfirmasi ID PROYEK, bukan host: host pooler Supabase
 * sama untuk semua proyek di satu wilayah, jadi host tidak membedakan proyek uji dari production.
 * Database (DATABASE_URL) dan Supabase Auth (NEXT_PUBLIC_SUPABASE_URL) juga harus menunjuk proyek yang
 * SAMA - kalau berbeda, skrip akan membuat akun login di satu proyek dan datanya di proyek lain.
 * Untuk database non-Supabase (mis. lokal) yang dikonfirmasi adalah nama host-nya.
 */
export function pastikanKonfirmasiTujuan(
  urlDatabase: string | undefined,
  urlSupabase: string | undefined,
  konfirmasi: string | undefined,
): string {
  const host = hostDatabase(urlDatabase);
  const refDb = refProyekDariDatabase(urlDatabase);
  const refAuth = refProyekDariSupabaseUrl(urlSupabase);
  if (refDb && refAuth && refDb !== refAuth) {
    throw new Error(
      `Dibatalkan: DATABASE_URL menunjuk proyek "${refDb}" tetapi NEXT_PUBLIC_SUPABASE_URL menunjuk proyek "${refAuth}". ` +
        "Periksa berkas .env yang dipakai - keduanya harus proyek yang sama.",
    );
  }
  const tujuan = refDb ?? refAuth ?? host;
  if (!konfirmasi || konfirmasi.trim() !== tujuan) {
    throw new Error(
      `Dibatalkan demi keamanan. Skrip ini akan menulis ke proyek/database "${tujuan}".\n` +
        `Kalau itu memang tujuannya (dan BUKAN production), jalankan ulang dengan LOAD_TEST_CONFIRM_PROJECT=${tujuan}`,
    );
  }
  return tujuan;
}

/** Kata sandi acak untuk satu kali uji (huruf & angka tanpa karakter membingungkan). */
export function buatSandi(panjang = 16, acak: (maks: number) => number): string {
  const huruf = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: panjang }, () => huruf[acak(huruf.length)]).join("");
}

// ---------------------------------------------------------------------------------------------
// Konten ujian uji beban (dipakai seed-load-test-exam.ts)
// ---------------------------------------------------------------------------------------------

export const PAKET_AWALAN = "Uji Beban";
export const SOAL_AWALAN = "[Uji Beban]";

type Format = "pg" | "pg_kompleks" | "pg_kategori";
type Kesulitan = "mudah" | "sedang" | "sulit";
type Level = "L1" | "L2" | "L3";

export type SoalUji = {
  id: string;
  format: Format;
  teks: string;
  tingkatKesulitan: Kesulitan;
  levelBloom: Level;
  bobot: number;
};
export type OpsiUji = { questionId: string; label: string; teks: string; isCorrect: boolean; urutan: number };
export type KategoriUji = { id: string; questionId: string; label: string; urutan: number };
export type PernyataanUji = { questionId: string; teks: string; correctCategoryId: string; urutan: number };

/** Format soal bergilir: 60% PG, 20% PG Kompleks, 20% PG Kategori - campuran yang mirip ujian sungguhan. */
export function formatUntukNomor(nomor: number): Format {
  const sisa = nomor % 5;
  if (sisa === 0) return "pg_kategori";
  if (sisa === 4) return "pg_kompleks";
  return "pg";
}

/**
 * Susun `jumlah` soal uji lengkap dengan opsi/kategori/pernyataan. Murni (id dibuat lewat `uuid` yang
 * disuntikkan) supaya bisa dites. Aturan yang dijaga sama dengan validasi soal di aplikasi: PG tepat
 * satu kunci, PG Kompleks 2 kunci dari 4 opsi, PG Kategori maksimal 3 pernyataan dengan kategori Benar/Salah.
 */
export function buatKontenSoal(jumlah: number, uuid: () => string) {
  if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > 200) {
    throw new Error(`Jumlah soal harus bilangan bulat 1-200, bukan ${jumlah}.`);
  }
  const questions: SoalUji[] = [];
  const options: OpsiUji[] = [];
  const categories: KategoriUji[] = [];
  const statements: PernyataanUji[] = [];
  const kesulitan: Kesulitan[] = ["mudah", "sedang", "sulit"];
  const level: Level[] = ["L1", "L2", "L3"];
  const huruf = ["A", "B", "C", "D"];

  for (let nomor = 1; nomor <= jumlah; nomor++) {
    const format = formatUntukNomor(nomor);
    const id = uuid();
    questions.push({
      id,
      format,
      teks: `${SOAL_AWALAN} Soal nomor ${nomor}. Pilih jawaban yang paling tepat.`,
      tingkatKesulitan: kesulitan[nomor % 3]!,
      levelBloom: level[nomor % 3]!,
      bobot: 1,
    });

    if (format === "pg" || format === "pg_kompleks") {
      const kunci = new Set<number>(format === "pg" ? [nomor % 4] : [nomor % 4, (nomor + 1) % 4]);
      huruf.forEach((label, i) => {
        options.push({ questionId: id, label, teks: `Pilihan ${label} untuk soal ${nomor}`, isCorrect: kunci.has(i), urutan: i });
      });
    } else {
      const benar = { id: uuid(), questionId: id, label: "Benar", urutan: 0 };
      const salah = { id: uuid(), questionId: id, label: "Salah", urutan: 1 };
      categories.push(benar, salah);
      for (let k = 0; k < 3; k++) {
        statements.push({
          questionId: id,
          teks: `Pernyataan ${k + 1} untuk soal ${nomor}`,
          correctCategoryId: (nomor + k) % 2 === 0 ? benar.id : salah.id,
          urutan: k,
        });
      }
    }
  }
  return { questions, options, categories, statements };
}
