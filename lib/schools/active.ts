import type { School } from "@prisma/client";

/**
 * Sekolah dianggap aktif kalau statusnya "aktif". Sejak redesign entitlements
 * (Jalur B, Bagian 5 dokumen rencana), akses try out siswa sekolah ditentukan
 * oleh seatQuota/validUntil di model School lewat lib/billing/entitlements.ts,
 * bukan status ini — isSchoolActive cuma dipakai untuk gerbang login/dashboard.
 */
export function isSchoolActive(
  school: { status: School["status"] },
  _now: Date = new Date(),
): boolean {
  return school.status === "aktif";
}
