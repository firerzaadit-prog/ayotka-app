import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { sniffGambar } from "@/lib/soal/gambar-format";

/**
 * Sejak 6 Okt 2026 generator soal.ayotka.id tidak lagi menyimpan gambar di payload (base64): berkasnya ditulis ke disk
 * server dan payload.gambar hanya memuat `url`, mis. https://soal.ayotka.id/soal-images/soal-ai-1790585830926-12-jglj.jpg.
 * Generator dan ayotka.id berjalan di VPS yang sama, jadi bila folder berkasnya diketahui (GENERATOR_IMAGES_DIR) gambar
 * dibaca LANGSUNG dari disk: lebih cepat, dan tidak bergantung pada server yang sanggup memanggil alamat publiknya
 * sendiri (hairpin). Bila folder belum diatur atau berkasnya tidak ada, pemanggil jatuh ke unduhan HTTP biasa.
 *
 * Aman terhadap path traversal: hanya URL berawalan GENERATOR_IMAGES_URL_PREFIX yang dibaca, nama berkas dibatasi
 * huruf/angka/titik/garis (tanpa "/", "%", ".."), dan jalur akhirnya diperiksa lagi setelah symlink diselesaikan.
 */
export const AWALAN_URL_GENERATOR_BAWAAN = "https://soal.ayotka.id/soal-images/";
const NAMA_BERKAS_AMAN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

export type KonfigGambarGenerator = { dir: string; awalan: string };

/** null = pembacaan dari disk tidak diaktifkan (GENERATOR_IMAGES_DIR kosong) atau awalan URL tidak valid. */
export function bacaKonfigGambarGenerator(env: Record<string, string | undefined> = process.env): KonfigGambarGenerator | null {
  const dir = env.GENERATOR_IMAGES_DIR?.trim();
  if (!dir) return null;
  try {
    const a = new URL(env.GENERATOR_IMAGES_URL_PREFIX?.trim() || AWALAN_URL_GENERATOR_BAWAAN);
    if (a.protocol !== "https:" && a.protocol !== "http:") return null;
    return { dir: path.resolve(dir), awalan: `${a.origin}${a.pathname.replace(/\/*$/, "/")}` };
  } catch {
    return null;
  }
}

/** Jalur berkas di disk bila `rawUrl` menunjuk gambar generator; null bila bukan, atau nama berkasnya tidak aman. */
export function pathBerkasGenerator(rawUrl: string, konfig: KonfigGambarGenerator): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  const lengkap = `${u.origin}${u.pathname}`;
  if (!lengkap.startsWith(konfig.awalan)) return null;
  const nama = lengkap.slice(konfig.awalan.length);
  if (!NAMA_BERKAS_AMAN.test(nama)) return null;
  const tujuan = path.join(konfig.dir, nama);
  return path.dirname(tujuan) === konfig.dir ? tujuan : null;
}

export type HasilBacaGambarGenerator =
  | { status: "ready"; bytes: Buffer; mime: string; ext: string }
  | { status: "blocked"; reason: string };

/**
 * null = bukan urusan pembacaan disk (tidak diaktifkan, URL luar, atau berkas tidak ada/terbaca) -> pemanggil
 * mencoba unduhan HTTP. Berkas yang ADA tetapi terlalu besar atau bukan gambar diblokir (HTTP akan menyajikan berkas
 * yang sama, jadi tidak ada gunanya mencoba lagi).
 */
export async function bacaGambarGeneratorLokal(
  rawUrl: string,
  maksByte: number,
  konfig: KonfigGambarGenerator | null = bacaKonfigGambarGenerator(),
): Promise<HasilBacaGambarGenerator | null> {
  if (!konfig) return null;
  const berkas = pathBerkasGenerator(rawUrl, konfig);
  if (!berkas) return null;

  try {
    // Symlink di dalam folder tidak boleh membawa pembacaan ke luar folder.
    const nyata = await fs.realpath(berkas);
    const dirNyata = await fs.realpath(konfig.dir);
    if (path.dirname(nyata) !== dirNyata) return null;

    const stat = await fs.stat(nyata);
    if (!stat.isFile()) return null;
    if (stat.size > maksByte) return { status: "blocked", reason: "Ukuran gambar melebihi 5 MB." };

    const bytes = await fs.readFile(nyata);
    const info = sniffGambar(bytes);
    if (!info) {
      return { status: "blocked", reason: "Isi berkas gambar di folder generator bukan gambar PNG/JPEG/WEBP/GIF yang valid." };
    }
    return { status: "ready", bytes, mime: info.mime, ext: info.ext };
  } catch {
    return null;
  }
}
