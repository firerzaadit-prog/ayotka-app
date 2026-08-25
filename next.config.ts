import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [{ protocol: "https", hostname: supabaseHostname }]
      : [],
  },
  // Tiket 8.1 (Bagian 9 brief): HSTS. Browser mengabaikan header ini kalau
  // halaman dimuat lewat HTTP biasa (mis. localhost saat dev) - aman selalu
  // dikirim, baru benar-benar berlaku begitu situs sungguhan diakses lewat
  // HTTPS. Sengaja TANPA "preload" - itu komitmen submit ke daftar preload
  // browser yang susah dibatalkan, sebaiknya langkah terpisah & disengaja
  // setelah HTTPS produksi benar-benar stabil, bukan efek samping di sini.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
