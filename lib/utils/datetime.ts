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
