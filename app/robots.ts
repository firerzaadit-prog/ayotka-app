import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/site-url";

/**
 * Halaman berbasis token (reset-password, konfirmasi email) dan semua area
 * yang sudah butuh login (siswa/admin-*) tidak ada nilainya diindeks mesin
 * pencari, dan mengizinkan crawler ke situ cuma memancing 404/redirect-ke-
 * login yang sia-sia. /admin/ (form login admin) ikut ditutup - sama sekali
 * tidak butuh muncul di hasil pencarian.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/siswa/",
        "/admin/",
        "/admin-pusat/",
        "/admin-sekolah/",
        "/reset-password",
        "/konfirmasi",
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
