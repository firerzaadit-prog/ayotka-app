import type { School } from "@prisma/client";

/**
 * Sekolah dianggap aktif kalau statusnya "aktif" DAN (tidak ada tanggal
 * langganan berakhir, atau tanggal itu belum lewat). Satu-satunya definisi
 * "aktif" yang dipakai di seluruh app - baik untuk menolak registrasi baru
 * (lib/schools/lookup.ts), memutus akses login admin sekolah & siswa Jalur A
 * yang sesinya masih hidup setelah langganan berakhir (lib/auth/session.ts,
 * app/api/auth/login/route.ts), maupun ditampilkan di UI admin pusat
 * (app/admin-pusat/sekolah/[id]/page.tsx). Tidak pakai "server-only" -
 * sengaja aman diimpor dari Client Component juga (cuma baca 2 field,
 * tidak sentuh DB/secret). langgananBerakhir boleh string (hasil JSON
 * fetch di client) atau Date (langsung dari Prisma di server).
 */
export function isSchoolActive(
  school: { status: School["status"]; langgananBerakhir: Date | string | null },
  now: Date = new Date(),
): boolean {
  if (school.status !== "aktif") return false;
  if (school.langgananBerakhir && new Date(school.langgananBerakhir) < now) return false;
  return true;
}
