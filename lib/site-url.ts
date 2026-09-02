/**
 * Base URL absolut untuk metadata (metadataBase, robots.ts, sitemap.ts) -
 * fallback ke localhost dipakai saat env belum diset (mis. build lokal),
 * konsisten dengan default di .env.example.
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
