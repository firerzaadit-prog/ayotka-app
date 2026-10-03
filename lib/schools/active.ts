import type { School } from "@prisma/client";

/**
 * Sekolah dianggap aktif kalau statusnya "aktif". Akses try out siswa sekolah ditentukan oleh periode
 * langganan (lib/billing/periode-sekolah.ts) lewat lib/billing/entitlements.ts, bukan status ini -
 * isSchoolActive cuma dipakai untuk gerbang login/dashboard. Langganan yang berakhir tidak membuat sekolah
 * "tidak aktif" (hanya dibekukan), jadi parameter waktu tidak dipakai.
 */
export function isSchoolActive(
  school: { status: School["status"] },
  _now: Date = new Date(),
): boolean {
  return school.status === "aktif";
}
