import { requireRole } from "@/lib/auth/session";
import { getDinasWilayah } from "@/lib/dinas/wilayah";
import { KesiapanAntarSekolahView } from "@/components/analytics/kesiapan-antar-sekolah-view";

export const dynamic = "force-dynamic";

/**
 * Dashboard dinas pendidikan: kesiapan TKA lintas sekolah - lihat components/analytics/kesiapan-antar-sekolah-view.tsx.
 * Wilayah cakupan akun (provinsi atau kota/kabupaten) dikunci di filter; server tetap menegakkannya sendiri.
 */
export default async function DinasPendidikanDashboardPage() {
  const user = await requireRole("dinas_pendidikan");
  const cakupan = await getDinasWilayah(user.id);
  return <KesiapanAntarSekolahView studentDetailHrefBase="/dinas-pendidikan/siswa" cakupan={cakupan} />;
}
