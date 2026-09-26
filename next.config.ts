import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Font Unicode untuk rapor PDF dibaca lewat fs saat runtime (lib/pdf/
  // rapor-renderer.ts) - bukan import, jadi tidak otomatis ikut ter-bundle di
  // fungsi serverless Vercel. Kalau file ini tidak ikut, rapor tetap jadi
  // tapi jatuh ke font default tanpa simbol matematika (x², π, ≥, ✓).
  outputFileTracingIncludes: {
    "/api/siswa/attempts/\\[id\\]/rapor": ["./lib/pdf/fonts/**/*"],
  },
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
          // Anti-clickjacking: situs lain tidak boleh memuat halaman AyoTKA di
          // dalam iframe (mis. tombol "Bayar"/"Hapus" disamarkan di bawah
          // tampilan palsu). Aplikasi ini sendiri tidak memakai iframe.
          // X-Frame-Options untuk browser lama, frame-ancestors untuk yang baru.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
