import "server-only";
import { sniffGambar } from "@/lib/soal/gambar-format";
import type { SoalPayload } from "./source-db";

/**
 * Fase 4 (dokumen Integrasi Bank Soal TKA, Bagian 09): terjemahkan
 * payload.gambar dari soal.ayotka.id jadi bytes siap-unggah. Dipisah dari
 * lib/soal/resolve-gambar.ts (punya fitur impor Excel) karena bentuk
 * sumbernya beda - di sini satu objek `gambar` per soal, bukan gambar
 * tempelan/link Drive - tapi tetap memakai sniffGambar yang sama supaya
 * aturan "tipe file ditentukan dari isinya" konsisten di seluruh aplikasi.
 */

export type SourceGambar = NonNullable<SoalPayload["gambar"]>;

export const MAKS_BYTE_GAMBAR_SUMBER = 5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAKS_REDIRECT = 5;

export type ResolvedSourceImage =
  | { status: "none" }
  | { status: "blocked"; reason: string }
  | { status: "ready"; bytes: Buffer; mime: string; ext: string };

/** Proteksi SSRF dasar - hanya http(s) publik, bukan alamat lokal/privat. Dicek ulang di setiap hop redirect. */
function safeExternalUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host === "127.0.0.1") return null;
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(host)) return null;
  return u;
}

/** Sama pola dengan unduhDrive di lib/soal/resolve-gambar.ts: redirect diikuti manual (host tiap hop divalidasi), ukuran dibatasi sambil membaca (bukan menunggu penuh baru dicek). */
async function downloadImage(rawUrl: string): Promise<ResolvedSourceImage> {
  let current = safeExternalUrl(rawUrl);
  if (!current) return { status: "blocked", reason: `URL gambar tidak valid atau tidak diizinkan: "${rawUrl}".` };

  try {
    for (let hop = 0; hop <= MAKS_REDIRECT; hop++) {
      const res = await fetch(current.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "Mozilla/5.0 (compatible; AyoTKA-import)" },
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { status: "blocked", reason: "Gagal mengunduh gambar (redirect tanpa alamat tujuan)." };
        const next = safeExternalUrl(new URL(loc, current).toString());
        if (!next) return { status: "blocked", reason: "Gagal mengunduh gambar (redirect ke alamat yang tidak diizinkan)." };
        current = next;
        continue;
      }
      if (!res.ok) return { status: "blocked", reason: `Gagal mengunduh gambar dari soal.ayotka.id (status ${res.status}).` };

      const declaredLen = Number(res.headers.get("content-length") ?? 0);
      if (declaredLen > MAKS_BYTE_GAMBAR_SUMBER) return { status: "blocked", reason: "Ukuran gambar melebihi 5 MB." };

      const reader = res.body?.getReader();
      if (!reader) return { status: "blocked", reason: "Gagal membaca isi gambar dari soal.ayotka.id." };
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAKS_BYTE_GAMBAR_SUMBER) {
          await reader.cancel();
          return { status: "blocked", reason: "Ukuran gambar melebihi 5 MB." };
        }
        chunks.push(value);
      }
      const bytes = Buffer.concat(chunks);
      const info = sniffGambar(bytes);
      if (!info) return { status: "blocked", reason: "Isi URL bukan gambar PNG/JPEG/WEBP/GIF yang valid." };
      return { status: "ready", bytes, mime: info.mime, ext: info.ext };
    }
    return { status: "blocked", reason: "Gagal mengunduh gambar (terlalu banyak redirect)." };
  } catch (err) {
    return {
      status: "blocked",
      reason: `Gagal mengunduh gambar (koneksi timeout atau terputus): ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Bukan parser XML lengkap (sengaja, tanpa dependensi baru) - tapi cukup untuk menangkap
 * kesalahan nyata yang ditemukan di data produksi soal.ayotka.id: SVG dengan atribut yang
 * ditulis dua kali di tag yang sama, mis. <line x=".." y=".." x=".." y=".."/> (seharusnya
 * x1/y1/x2/y2). Itu XML tidak valid - browser gagal me-render SELURUH gambar, bukan cuma
 * elemen itu, dan sebelum perbaikan ini gagalnya diam-diam (gambar rusak baru ketahuan siswa).
 */
function cariAtributGandaSvg(content: string): string | null {
  const tagPattern = /<([a-zA-Z][\w:-]*)((?:\s+[^<>]*)?)\/?>/g;
  let tag: RegExpExecArray | null;
  while ((tag = tagPattern.exec(content))) {
    const [, tagName, attrString = ""] = tag;
    const attrPattern = /([a-zA-Z_:][\w:.-]*)\s*=\s*['"]/g;
    const seen = new Set<string>();
    let attr: RegExpExecArray | null;
    while ((attr = attrPattern.exec(attrString))) {
      const name = attr[1]!;
      if (seen.has(name)) {
        return `atribut "${name}" ditulis dua kali di tag <${tagName}> (kemungkinan salah tulis di sumber, mis. seharusnya x1/x2 bukan x/x)`;
      }
      seen.add(name);
    }
  }
  return null;
}

/** svg_content dari soal.ayotka.id sudah berupa markup SVG utuh (bukan file terpisah) - tinggal divalidasi & dibungkus jadi bytes. */
function encodeSvg(svgContent: string | undefined): ResolvedSourceImage {
  const content = (svgContent ?? "").trim();
  if (!content) return { status: "blocked", reason: "Tipe gambar svg tapi svg_content kosong di sumber." };
  if (!/^(<\?xml|<svg)/i.test(content)) {
    return { status: "blocked", reason: "svg_content di sumber tidak terlihat seperti markup SVG yang valid." };
  }
  const masalahAtribut = cariAtributGandaSvg(content);
  if (masalahAtribut) {
    return { status: "blocked", reason: `SVG di sumber tidak valid: ${masalahAtribut}.` };
  }
  if (Buffer.byteLength(content, "utf-8") > MAKS_BYTE_GAMBAR_SUMBER) {
    return { status: "blocked", reason: "Ukuran SVG melebihi 5 MB." };
  }
  return { status: "ready", bytes: Buffer.from(content, "utf-8"), mime: "image/svg+xml", ext: "svg" };
}

/**
 * Ubah satu payload.gambar jadi bytes siap-unggah. HANYA dipanggil saat eksekusi
 * impor (bukan saat preview) - unduhan sungguhan ke soal.ayotka.id cukup sekali,
 * tepat sebelum commit, konsisten dengan pola lib/soal/resolve-gambar.ts.
 */
export async function resolveSourceImage(gambar: SourceGambar | null | undefined): Promise<ResolvedSourceImage> {
  if (!gambar) return { status: "none" };
  switch (gambar.tipe) {
    case "perlu_ilustrasi":
      return {
        status: "blocked",
        reason: "Gambar untuk soal ini belum dibuat ilustrator di soal.ayotka.id (status: perlu ilustrasi).",
      };
    case "ilustrasi_kontekstual":
      // Ditemukan di data produksi (16 soal, tidak disebut di dokumen rencana) - tidak tahu
      // pasti bentuk datanya seperti apa, jadi diblokir jelas daripada menebak & salah proses.
      return {
        status: "blocked",
        reason: "Gambar bertipe \"ilustrasi_kontekstual\" belum didukung fitur impor - beri tahu tim AyoTKA untuk mendukungnya.",
      };
    case "svg":
      return encodeSvg(gambar.svg_content);
    case "url":
      if (!gambar.url) return { status: "blocked", reason: "Tipe gambar url tapi url kosong di sumber." };
      return downloadImage(gambar.url);
    default:
      return { status: "blocked", reason: `Tipe gambar tidak dikenal dari soal.ayotka.id: "${String((gambar as { tipe: unknown }).tipe)}".` };
  }
}

/**
 * Pemeriksaan yang TIDAK butuh jaringan (dipakai preview.ts, supaya masalahnya kelihatan
 * di preview - bukan baru ketahuan nanti saat konfirmasi impor, konsisten dengan cara
 * masalah taksonomi/format lain sudah ditampilkan). SVG divalidasi PENUH di sini (murah,
 * CPU-only). URL hanya dicek bentuknya; unduhan sungguhan tetap ditunda sampai eksekusi
 * (lib/soal-import/execute.ts) - satu-satunya bagian yang benar-benar butuh koneksi keluar.
 */
export function precheckSourceGambar(gambar: SourceGambar | null | undefined): string | null {
  if (!gambar) return null;
  if (gambar.tipe === "svg") {
    const hasil = encodeSvg(gambar.svg_content);
    return hasil.status === "blocked" ? hasil.reason : null;
  }
  if (gambar.tipe === "url") {
    if (!gambar.url) return "Tipe gambar url tapi url kosong di sumber.";
    if (!safeExternalUrl(gambar.url)) return `URL gambar tidak valid atau tidak diizinkan: "${gambar.url}".`;
    return null;
  }
  return null; // perlu_ilustrasi/ilustrasi_kontekstual: sudah punya pesan sendiri di preview.ts
}

/**
 * Untuk tampilan PREVIEW saja (tidak mengunduh apa pun di server): tipe "url"
 * dimuat langsung oleh browser admin dari sumbernya, tipe "svg" dibungkus jadi
 * data URI supaya bisa dipakai langsung sebagai src <img> tanpa render HTML
 * mentah (dangerouslySetInnerHTML) yang berisiko.
 */
export function previewImageSrc(gambar: SourceGambar | null | undefined): string | null {
  if (!gambar) return null;
  if (gambar.tipe === "url" && gambar.url) return gambar.url;
  if (gambar.tipe === "svg" && gambar.svg_content) {
    // Sudah pasti gagal dirender (lihat precheckSourceGambar) - jangan tampilkan ikon gambar
    // rusak di sebelah pesan kesalahannya, cukup pesannya saja yang tampil.
    if (encodeSvg(gambar.svg_content).status === "blocked") return null;
    return `data:image/svg+xml;base64,${Buffer.from(gambar.svg_content, "utf-8").toString("base64")}`;
  }
  return null;
}
