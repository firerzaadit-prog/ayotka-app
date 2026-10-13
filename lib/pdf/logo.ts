import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Logo AyoTKA untuk kepala PDF, dibaca dari disk (public/logo.png). Memanggil alamat publik sendiri lewat HTTP tidak selalu
 * bisa dari dalam server (lihat laporan sekolah), jadi disk didahulukan. null bila berkas tidak ada: PDF tetap dibuat
 * tanpa logo.
 */
export async function muatLogoPdf(): Promise<Buffer | null> {
  return readFile(path.join(process.cwd(), "public", "logo.png")).catch(() => null);
}
