/** "1 Jam 49 Menit 51 Detik" - jam/menit yang nol di depan dihilangkan, detik selalu tampil. */
export function formatSisaWaktuPanjang(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const jam = Math.floor(s / 3600);
  const menit = Math.floor((s % 3600) / 60);
  const detik = s % 60;
  const bagian: string[] = [];
  if (jam > 0) bagian.push(`${jam} Jam`);
  if (jam > 0 || menit > 0) bagian.push(`${menit} Menit`);
  bagian.push(`${detik} Detik`);
  return bagian.join(" ");
}

/** "1:49:51" atau "49:51" - versi ringkas untuk bar sempit di HP. */
export function formatSisaWaktuRingkas(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const jam = Math.floor(s / 3600);
  const menit = Math.floor((s % 3600) / 60);
  const detik = s % 60;
  const dd = String(detik).padStart(2, "0");
  if (jam > 0) return `${jam}:${String(menit).padStart(2, "0")}:${dd}`;
  return `${menit}:${dd}`;
}

export type NadaWaktu = "normal" | "waspada" | "kritis";

/** Warna peringatan timer: <= 1 menit kritis, <= 5 menit waspada. */
export function nadaWaktu(remainingSeconds: number): NadaWaktu {
  if (remainingSeconds <= 60) return "kritis";
  if (remainingSeconds <= 300) return "waspada";
  return "normal";
}
