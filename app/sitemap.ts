import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/site-url";

/**
 * Hanya halaman publik yang bisa langsung dibuka tanpa prasyarat (bukan
 * halaman berbasis token seperti /reset-password atau /konfirmasi, dan bukan
 * form login admin - lihat app/robots.ts untuk alasan yang sama).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${APP_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/kerangka-asesmen`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${APP_URL}/registrasi`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${APP_URL}/registrasi/sekolah`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/registrasi/mandiri`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${APP_URL}/forgot-password`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
