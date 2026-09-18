export type CompetencyTier = "baik" | "cukup" | "kurang";

/**
 * Ambang 3 warna Peta Kompetensi (Bagian 8.7 brief) - dipakai SAMA persis di
 * web (app/siswa/hasil/[id]/page.tsx, lewat COMPETENCY_TIER_CLASS) dan PDF
 * (lib/pdf/rapor-renderer.ts, lewat COMPETENCY_TIER_HEX) supaya siswa tidak
 * melihat warna berbeda untuk persentase yang sama di dua tempat. Fungsi
 * murni (tanpa I/O) sengaja TANPA "server-only" - dipakai server (agregasi
 * PDF) maupun client (chart di halaman hasil).
 */
export function competencyTier(persentase: number): CompetencyTier {
  if (persentase >= 70) return "baik";
  if (persentase >= 50) return "cukup";
  return "kurang";
}

export const COMPETENCY_TIER_HEX: Record<CompetencyTier, string> = {
  baik: "#059669",
  cukup: "#d97706",
  kurang: "#dc2626",
};

export const COMPETENCY_TIER_CLASS: Record<CompetencyTier, { bar: string; text: string }> = {
  baik: { bar: "bg-emerald-600", text: "text-emerald-700" },
  cukup: { bar: "bg-amber-600", text: "text-amber-700" },
  kurang: { bar: "bg-rose-600", text: "text-rose-700" },
};
