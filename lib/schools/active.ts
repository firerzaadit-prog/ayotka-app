import type { School } from "@prisma/client";

/**
 * Sekolah dianggap aktif kalau statusnya "aktif". Sejak redesign billing
 * (Bagian 7.3 brief), tidak ada lagi langgananBerakhir di model School —
 * akses sekolah ditentukan oleh SchoolSubjectQuota yang di-set admin pusat,
 * bukan durasi berlangganan. isSchoolActive sekarang hanya cek status saja.
 */
export function isSchoolActive(
  school: { status: School["status"] },
  _now: Date = new Date(),
): boolean {
  return school.status === "aktif";
}
