import { KesiapanAntarSekolahView } from "@/components/analytics/kesiapan-antar-sekolah-view";

/** Dashboard dinas pendidikan: kesiapan TKA lintas sekolah - lihat components/analytics/kesiapan-antar-sekolah-view.tsx. */
export default function DinasPendidikanDashboardPage() {
  return <KesiapanAntarSekolahView studentDetailHrefBase="/dinas-pendidikan/siswa" />;
}
