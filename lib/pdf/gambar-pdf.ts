import "server-only";
import { sniffGambar } from "@/lib/soal/gambar-format";
import type { MediaItem } from "@/lib/soal/media-types";
import { validasiSvgSumber } from "@/lib/soal-import/media";

/**
 * Gambar untuk rapor PDF: mengambil berkas (alamat http/https, jalur dari akar situs, atau data URI), memastikan
 * bentuknya yang bisa dipasang PDFKit (PNG/JPEG), dan menyiapkan diagram SVG. Semua kegagalan menghasilkan null (gambar
 * dilewati dengan keterangan di rapor), tidak pernah melempar: satu gambar rusak tidak boleh menggagalkan seluruh rapor.
 */
export const TIMEOUT_GAMBAR_MS = 8_000;
export const MAKS_BYTE_GAMBAR_PDF = 6 * 1024 * 1024;
/** Batas ukuran SVG yang digambar (diagram generator jauh di bawah ini). */
export const MAKS_BYTE_SVG_PDF = 1024 * 1024;

type Pengambil = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; arrayBuffer(): Promise<ArrayBuffer>; headers?: { get(nama: string): string | null } }>;

export type OpsiGambar = {
  /** Asal situs (mis. https://ayotka.id) untuk alamat berawalan "/". Kosong = alamat seperti itu tidak bisa diambil. */
  asalSitus?: string | null;
  /** Untuk tes. */
  ambil?: Pengambil;
};

function dariDataUri(src: string): Buffer | null {
  const koma = src.indexOf(",");
  if (koma < 0) return null;
  const kepala = src.slice(0, koma).toLowerCase();
  if (!kepala.startsWith("data:image/")) return null;
  const isi = src.slice(koma + 1);
  try {
    const bytes = kepala.includes(";base64") ? Buffer.from(isi.replace(/\s+/g, ""), "base64") : Buffer.from(decodeURIComponent(isi), "utf8");
    return bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
}

/**
 * Host yang tidak boleh diambil server atas permintaan isi soal: localhost, alamat jaringan pribadi/loopback/link-local
 * (termasuk alamat metadata awan 169.254.x.x), dan nama internal. Isi soal (alamat gambar) ditulis admin/guru, jadi tanpa
 * ini rapor bisa dipakai menyentuh layanan internal server. Alamat yang ditulis sebagai angka (2130706433, 0x7f000001)
 * sudah dinormalkan menjadi 127.0.0.1 oleh parser URL sebelum sampai sini. Host situs sendiri dikecualikan oleh pemanggil.
 */
export function hostTerlarang(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || /\.(localhost|local|internal|lan|home)$/.test(h)) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(":")) {
    return h === "::" || h === "::1" || /^(fc|fd|fe[89ab])/.test(h) || h.startsWith("::ffff:");
  }
  return false;
}

/** Alamat yang boleh diambil server: http(s) mutlak, jalur dari akar situs (dilengkapi asalSitus), atau data URI gambar. */
export function alamatGambarLengkap(src: string, asalSitus: string | null | undefined): string | null {
  const s = src.trim();
  if (!s) return null;
  if (/^data:image\//i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/") && !s.startsWith("//") && asalSitus && /^https?:\/\//i.test(asalSitus)) {
    return `${asalSitus.replace(/\/+$/, "")}${s}`;
  }
  return null;
}

/** Ambil berkas gambar mentah (tanpa konversi). null bila gagal, terlalu besar, atau bukan alamat yang diizinkan. */
export async function ambilBerkasGambar(src: string, opsi: OpsiGambar = {}): Promise<Buffer | null> {
  const alamat = alamatGambarLengkap(src, opsi.asalSitus);
  if (!alamat) return null;
  if (alamat.startsWith("data:")) {
    const bytes = dariDataUri(alamat);
    return bytes && bytes.length <= MAKS_BYTE_GAMBAR_PDF ? bytes : null;
  }
  try {
    const tujuan = new URL(alamat);
    const asalHost = opsi.asalSitus && /^https?:\/\//i.test(opsi.asalSitus) ? new URL(opsi.asalSitus).host : null;
    if (hostTerlarang(tujuan.hostname) && tujuan.host !== asalHost) return null;
    const ambil: Pengambil = opsi.ambil ?? ((u, init) => fetch(u, init));
    const res = await ambil(alamat, { signal: AbortSignal.timeout(TIMEOUT_GAMBAR_MS) });
    if (!res.ok) return null;
    const panjang = Number(res.headers?.get("content-length") ?? "");
    if (Number.isFinite(panjang) && panjang > MAKS_BYTE_GAMBAR_PDF) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return bytes.length > 0 && bytes.length <= MAKS_BYTE_GAMBAR_PDF ? bytes : null;
  } catch {
    return null;
  }
}

/** true bila isinya SVG (teks yang memuat elemen <svg>). */
export function adalahSvg(bytes: Uint8Array): boolean {
  const awal = Buffer.from(bytes.subarray(0, 600)).toString("utf8").toLowerCase();
  return awal.includes("<svg");
}

/**
 * Pastikan gambar berbentuk PNG atau JPEG (satu-satunya yang bisa dipasang PDFKit). Bentuk lain (WebP, GIF) diubah ke
 * PNG lewat sharp bila tersedia di server; bila tidak, null. SVG tidak diproses di sini (lihat siapkanMedia).
 */
export async function normalisasiRaster(bytes: Buffer): Promise<Buffer | null> {
  const info = sniffGambar(bytes);
  if (!info) return null;
  if (info.mime === "image/png" || info.mime === "image/jpeg") return bytes;
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(bytes).png().toBuffer();
  } catch {
    return null;
  }
}

/** Foto/gambar dari alamat -> Buffer PNG/JPEG yang siap dipasang, atau null. */
export async function ambilGambarRaster(src: string, opsi: OpsiGambar = {}): Promise<Buffer | null> {
  const bytes = await ambilBerkasGambar(src, opsi);
  if (!bytes) return null;
  // SVG yang diambil lewat alamat tidak bisa dipasang sebagai gambar raster
  if (adalahSvg(bytes)) return null;
  return normalisasiRaster(bytes);
}

export type MediaSiap =
  | { jenis: "raster"; label: string; buffer: Buffer }
  | { jenis: "svg"; label: string; svg: string }
  | { jenis: "gagal"; label: string };

/**
 * Satu item media soal (diagram SVG atau foto) -> bahan gambar PDF. Diagram: isi SVG-nya (dari svgContent, atau berkas
 * .svg di alamatnya) yang lolos pemeriksaan yang sama dengan saat impor; foto: berkas raster. Gagal = jenis "gagal"
 * (rapor mencetak keterangan singkat, bukan galat).
 */
export async function siapkanMedia(item: MediaItem, opsi: OpsiGambar = {}): Promise<MediaSiap> {
  const label = item.label;
  if (item.tipe === "svg") {
    let svg = item.svgContent;
    if (!svg && item.url) {
      const bytes = await ambilBerkasGambar(item.url, opsi);
      if (bytes && adalahSvg(bytes)) svg = bytes.toString("utf8");
      else if (bytes) {
        // alamatnya ternyata gambar raster
        const raster = await normalisasiRaster(bytes);
        return raster ? { jenis: "raster", label, buffer: raster } : { jenis: "gagal", label };
      }
    }
    if (!svg || Buffer.byteLength(svg, "utf8") > MAKS_BYTE_SVG_PDF || validasiSvgSumber(svg) !== null) return { jenis: "gagal", label };
    return { jenis: "svg", label, svg };
  }
  if (!item.url) return { jenis: "gagal", label };
  const bytes = await ambilBerkasGambar(item.url, opsi);
  if (!bytes) return { jenis: "gagal", label };
  if (adalahSvg(bytes)) {
    const svg = bytes.toString("utf8");
    return Buffer.byteLength(svg, "utf8") <= MAKS_BYTE_SVG_PDF && validasiSvgSumber(svg) === null ? { jenis: "svg", label, svg } : { jenis: "gagal", label };
  }
  const raster = await normalisasiRaster(bytes);
  return raster ? { jenis: "raster", label, buffer: raster } : { jenis: "gagal", label };
}
