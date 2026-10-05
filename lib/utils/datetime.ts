import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { id as localeId } from "date-fns/locale";

/**
 * Konvensi waktu AyoTKA (Tiket 1.8, Bagian 7.2 brief): semua timestamp
 * disimpan di database dalam UTC (default Postgres `timestamptz` + `Date`
 * JS selalu UTC secara internal), dan HANYA diformat ke WIB (UTC+7) di
 * lapisan tampilan lewat fungsi-fungsi di file ini. Jangan pernah
 * menampilkan Date mentah (mis. `date.toString()`) langsung ke UI.
 */
const WIB_TIMEZONE = "Asia/Jakarta";

export function formatWIB(date: Date | string, pattern = "d MMMM yyyy HH:mm"): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return `${formatInTimeZone(value, WIB_TIMEZONE, pattern, { locale: localeId })} WIB`;
}

export function formatWIBDate(date: Date | string): string {
  return formatWIB(date, "d MMMM yyyy");
}

/** Hari + tanggal lengkap WIB, mis. "Jumat, 25 September 2026" - untuk jadwal terbit/buka paket. */
export function formatWIBHariTanggal(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(value, WIB_TIMEZONE, "EEEE, d MMMM yyyy", { locale: localeId });
}

/** Jam WIB dengan titik, mis. "20.32 WIB" - pasangan formatWIBHariTanggal untuk baris kedua. */
export function formatWIBJam(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return `${formatInTimeZone(value, WIB_TIMEZONE, "HH.mm", { locale: localeId })} WIB`;
}

/** Hari + tanggal + jam sebaris, mis. "Jumat, 25 September 2026 pukul 20.32 WIB". */
export function formatWIBHariTanggalJam(date: Date | string): string {
  return `${formatWIBHariTanggal(date)} pukul ${formatWIBJam(date)}`;
}

export function formatWIBTime(date: Date | string): string {
  return formatWIB(date, "HH:mm");
}

/** Tiket 6.11: kunci "periode_bulan" usage_counters, dalam WIB supaya konsisten dengan tanggal yang dilihat admin. */
export function periodeBulanWIB(date: Date = new Date()): string {
  return formatInTimeZone(date, WIB_TIMEZONE, "yyyy-MM");
}

const BULAN_SINGKAT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/** Ubah periode "yyyy-MM" (lihat periodeBulanWIB) jadi label ringkas mis. "Jan 2027", dipakai di sumbu grafik tren. */
export function labelPeriodeBulan(periode: string): string {
  const [tahun, bulan] = periode.split("-");
  const label = BULAN_SINGKAT[Number(bulan) - 1];
  return `${label ?? bulan} ${tahun}`;
}

/**
 * Tiket 6.9: tanggal kalender WIB (bukan selisih jam mentah) - dipakai
 * buat cocokkan "H-7/H-3/H-0" supaya tidak meleset sehari gara-gara jam
 * berakhir_at vs jam cron berbeda (mis. berakhir jam 23:00, cron jalan jam
 * 01:00 - tetap dihitung hari yang sama di WIB).
 */
export function tanggalWIB(date: Date = new Date()): string {
  return formatInTimeZone(date, WIB_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Tiket 7.3: ubah tanggal kalender WIB ("yyyy-MM-dd", dari input date HTML)
 * jadi awal hari itu (00:00) dalam UTC - kebalikan dari tanggalWIB. WIB
 * tidak kenal DST (selalu UTC+7 sepanjang tahun), jadi aman ditambah 24 jam
 * mentah kalau perlu batas akhir hari (exclusive upper bound).
 */
export function startOfDayWIB(dateStr: string): Date {
  return fromZonedTime(`${dateStr}T00:00:00`, WIB_TIMEZONE);
}

/** true kalau `dateStr` berbentuk "yyyy-MM-dd" dan benar-benar ada di kalender (menolak mis. 2026-02-31). */
export function adalahTanggalKalender(dateStr: string): boolean {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!cocok) return false;
  const [tahun, bulan, hari] = [Number(cocok[1]), Number(cocok[2]), Number(cocok[3])];
  const d = new Date(Date.UTC(tahun, bulan - 1, hari));
  return d.getUTCFullYear() === tahun && d.getUTCMonth() === bulan - 1 && d.getUTCDate() === hari;
}

/**
 * Ubah tanggal kalender WIB ("yyyy-MM-dd") jadi detik terakhir hari itu (23:59:59.999 WIB) dalam UTC -
 * dipakai untuk "berlaku sampai {tanggal}" supaya tanggal itu benar-benar berlaku sepanjang hari (tanpa ini,
 * tanggal dari input date HTML putus pukul 07.00 WIB). Aman dihitung sebagai awal hari + 24 jam - 1 ms
 * karena WIB tidak kenal DST (lihat startOfDayWIB).
 */
export function akhirHariWIB(dateStr: string): Date {
  return new Date(startOfDayWIB(dateStr).getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Pukul 06:00 WIB PERTAMA yang jatuh SETELAH `date` (tepat pukul 06:00:00.000
 * dihitung sudah lewat, jadi hasilnya 06:00 hari berikutnya) - dipakai jeda
 * "satu paket baru per hari" pada seri Try Out Mandiri (lib/exam/seri-jadwal.ts):
 * selesai Selasa siang -> terbuka Rabu 06:00; selesai Rabu 02:00 dini hari ->
 * terbuka Rabu 06:00 hari itu juga. Sama persis dengan hasil cron harian
 * pukul 06:00 yang memeriksa siapa yang sudah selesai. WIB tidak kenal DST
 * (lihat startOfDayWIB), jadi aman dihitung sebagai offset jam tetap dari awal
 * hari kalender WIB `date`.
 */
export function jam6WIBBerikutnya(date: Date): Date {
  const jam6HariIni = startOfDayWIB(tanggalWIB(date)).getTime() + 6 * 60 * 60 * 1000;
  return new Date(date.getTime() < jam6HariIni ? jam6HariIni : jam6HariIni + 24 * 60 * 60 * 1000);
}
