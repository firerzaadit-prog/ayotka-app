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

/** Host dari connection string database (tanpa kata sandi), untuk ditampilkan & dikonfirmasi. */
export function hostDatabase(url: string | undefined): string {
  if (!url) throw new Error("DATABASE_URL tidak diisi.");
  try {
    return new URL(url).hostname;
  } catch {
    throw new Error("DATABASE_URL bukan URL yang valid.");
  }
}

/**
 * Pengaman: skrip yang menulis/menghapus data massal HANYA jalan kalau pemakai mengetik host
 * database yang dituju di LOAD_TEST_CONFIRM_HOST. Memaksa membaca ke database mana skrip
 * akan menulis (hanya ada satu proyek Supabase = production, jadi salah arah itu berbahaya).
 */
export function pastikanKonfirmasiHost(urlDatabase: string | undefined, konfirmasi: string | undefined): string {
  const host = hostDatabase(urlDatabase);
  if (!konfirmasi || konfirmasi.trim() !== host) {
    throw new Error(
      `Dibatalkan demi keamanan. Skrip ini akan menulis ke database "${host}".\n` +
        `Kalau itu memang tujuannya, jalankan ulang dengan LOAD_TEST_CONFIRM_HOST=${host}`,
    );
  }
  return host;
}

/** Kata sandi acak untuk satu kali uji (huruf & angka tanpa karakter membingungkan). */
export function buatSandi(panjang = 16, acak: (maks: number) => number): string {
  const huruf = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: panjang }, () => huruf[acak(huruf.length)]).join("");
}
