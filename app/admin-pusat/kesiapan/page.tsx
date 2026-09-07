import { KesiapanAntarSekolahView } from "@/components/analytics/kesiapan-antar-sekolah-view";

/**
 * Kesiapan TKA lintas sekolah untuk admin pusat - datanya sama persis
 * dengan dashboard dinas pendidikan (endpoint sudah mengizinkan admin_pusat
 * juga), sebelumnya cuma bisa dilihat per sekolah lewat "Kelola sekolah ini".
 * Lihat components/analytics/kesiapan-antar-sekolah-view.tsx.
 */
export default function AdminPusatKesiapanPage() {
  return <KesiapanAntarSekolahView />;
}
