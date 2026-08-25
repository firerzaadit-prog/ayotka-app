import { formatInTimeZone } from "date-fns-tz";
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

/**
 * Tiket 6.9: tanggal kalender WIB (bukan selisih jam mentah) - dipakai
 * buat cocokkan "H-7/H-3/H-0" supaya tidak meleset sehari gara-gara jam
 * berakhir_at vs jam cron berbeda (mis. berakhir jam 23:00, cron jalan jam
 * 01:00 - tetap dihitung hari yang sama di WIB).
 */
export function tanggalWIB(date: Date = new Date()): string {
  return formatInTimeZone(date, WIB_TIMEZONE, "yyyy-MM-dd");
}
