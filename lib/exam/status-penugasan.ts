/**
 * Status satu penugasan "Try Out Bersama" menurut waktu. Satu definisi yang dipakai daftar admin sekolah dan tes,
 * dan SAMA dengan penyaring server pada getActiveAssignmentsFor (lib/exam/visibility.ts): terbuka bila
 * mulai <= sekarang <= selesai (kedua batas termasuk).
 */
export type StatusPenugasan = "nonaktif" | "akan_datang" | "berlangsung" | "selesai";

type Waktu = Date | string;
const ms = (v: Waktu) => (v instanceof Date ? v : new Date(v)).getTime();

export function statusPenugasan(
  penugasan: { isActive: boolean; mulai: Waktu; selesai: Waktu },
  sekarang: Date = new Date(),
): StatusPenugasan {
  if (!penugasan.isActive) return "nonaktif";
  const t = sekarang.getTime();
  if (t < ms(penugasan.mulai)) return "akan_datang";
  if (t <= ms(penugasan.selesai)) return "berlangsung";
  return "selesai";
}

export const LABEL_STATUS_PENUGASAN: Record<StatusPenugasan, string> = {
  nonaktif: "Nonaktif",
  akan_datang: "Akan datang",
  berlangsung: "Berlangsung",
  selesai: "Selesai",
};
