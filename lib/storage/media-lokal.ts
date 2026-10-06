import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Penyimpanan gambar soal di disk server sendiri (alternatif Supabase Storage), dilayani nginx sebagai berkas statis.
 * Aktif hanya bila STORAGE_DRIVER=local; tanpa itu aplikasi tetap memakai Supabase Storage seperti sebelumnya.
 *
 *   STORAGE_DRIVER=local
 *   MEDIA_DIR=/var/www/ayotka-media/soal-media            folder tempat berkas ditulis (path relatif bucket = di bawahnya)
 *   MEDIA_PUBLIC_BASE_URL=https://ayotka.id/media/soal-media   alamat publik folder yang sama
 *
 * Path berkas (uuid.ext atau impor/<sha256>.ext) dibuat server sendiri, tetapi tetap divalidasi ketat di sini supaya
 * tidak mungkin keluar dari MEDIA_DIR ('..', awalan '/', backslash, berkas tersembunyi).
 */

export function pakaiPenyimpananLokal(): boolean {
  return process.env.STORAGE_DRIVER === "local";
}

function konfigurasi(): { dir: string; baseUrl: string } {
  const dir = process.env.MEDIA_DIR?.trim();
  const baseUrl = process.env.MEDIA_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (!dir || !baseUrl) {
    throw new Error("STORAGE_DRIVER=local membutuhkan MEDIA_DIR dan MEDIA_PUBLIC_BASE_URL.");
  }
  return { dir, baseUrl };
}

// Tiap segmen harus diawali huruf/angka - otomatis menolak '.', '..', dan berkas tersembunyi.
const POLA_PATH = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

/** true bila path relatif aman dipakai di bawah MEDIA_DIR. */
export function pathMediaAman(p: string): boolean {
  return POLA_PATH.test(p);
}

/** URL publik berkas (dihitung lokal, tanpa menyentuh disk). */
export function urlPublikLokal(p: string): string {
  if (!pathMediaAman(p)) throw new Error(`Path media tidak valid: ${p}`);
  return `${konfigurasi().baseUrl}/${p}`;
}

/**
 * Menulis berkas. timpa=false: gagal bila sudah ada (setara upsert:false di Supabase); timpa=true: diganti secara
 * atomik (tulis ke berkas sementara lalu rename), jadi pembaca tidak pernah melihat berkas setengah jadi.
 */
export async function simpanBerkasLokal(
  p: string,
  bytes: Uint8Array,
  opsi: { timpa: boolean },
): Promise<{ error: string } | null> {
  if (!pathMediaAman(p)) return { error: "Path berkas tidak valid." };
  try {
    const { dir } = konfigurasi();
    const tujuan = path.join(dir, ...p.split("/"));
    await fs.mkdir(path.dirname(tujuan), { recursive: true });
    if (!opsi.timpa) {
      await fs.writeFile(tujuan, bytes, { flag: "wx" });
      return null;
    }
    const sementara = `${tujuan}.${randomUUID()}.tmp`;
    await fs.writeFile(sementara, bytes);
    await fs.rename(sementara, tujuan);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
