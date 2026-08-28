import { redirect } from "next/navigation";

/**
 * Halaman verifikasi-pembayaran (plan-based) tidak lagi digunakan setelah
 * redesign billing Bagian 7.3. Redirect ke verifikasi try out mapel.
 */
export default function VerifikasiPembayaranRedirectPage() {
  redirect("/admin-pusat/verifikasi-tryout-mapel");
}
