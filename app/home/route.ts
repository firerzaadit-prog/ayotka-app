import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Halaman iklan /home (landing Meta Ads, terpisah dari beranda "/"). Isinya satu berkas HTML mandiri
 * (content/landing/home.html: gaya, skrip, dan logo di dalamnya) yang disajikan apa adanya lewat Route Handler,
 * sengaja TIDAK lewat layout aplikasi supaya CSS-nya tidak bercampur dengan Tailwind aplikasi dan hasil di peramban
 * persis sama dengan desainnya. Mengubah teks/harga/ID Meta Pixel = ubah berkas HTML itu lalu deploy.
 *
 * /home tidak masuk daftar rute berlogin di proxy.ts, jadi terbuka untuk umum. Dibaca dari disk tiap permintaan
 * (berkas kecil) dan dijaga cache pendek di peramban supaya perubahan setelah deploy cepat terlihat.
 */
const BERKAS = path.join(process.cwd(), "content", "landing", "home.html");

export async function GET() {
  let html: string;
  try {
    html = await readFile(BERKAS, "utf8");
  } catch (err) {
    console.error("[home] gagal membaca content/landing/home.html:", err);
    return new Response("Halaman belum tersedia. Silakan coba lagi sebentar.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
