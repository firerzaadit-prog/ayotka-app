import type { Vonis } from "./daya-serap";

/**
 * Pemformatan tampilan daya serap yang SAMA untuk halaman web, PDF, dan Excel, supaya angka dan istilah yang sama
 * tidak tampil berbeda di tiga tempat. Murni; tanpa "server-only".
 */

/** 34,1% (koma desimal Indonesia); "-" bila tidak ada nilai. */
export function formatPersen(n: number | null | undefined, digit = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return `${n.toFixed(digit).replace(".", ",")}%`;
}

/** +12,3 poin / -5,0 poin / 0,0 poin; "-" bila tidak ada nilai. Selisih terhadap rerata nasional. */
export function formatSelisih(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  const teks = Math.abs(n).toFixed(1).replace(".", ",");
  if (Math.abs(n) < 0.05) return "0,0 poin";
  return `${n > 0 ? "+" : "-"}${teks} poin`;
}

export const VARIAN_VONIS: Record<Vonis, "success" | "info" | "warning" | "neutral"> = {
  di_atas: "success",
  setara: "info",
  perlu_penguatan: "warning",
  data_kurang: "neutral",
  tanpa_pembanding: "neutral",
};

/** Warna teks vonis di PDF (heksadesimal), sejalan dengan varian badge di web. */
export const WARNA_VONIS: Record<Vonis, string> = {
  di_atas: "#059669",
  setara: "#4f46e5",
  perlu_penguatan: "#b45309",
  data_kurang: "#64748b",
  tanpa_pembanding: "#64748b",
};
