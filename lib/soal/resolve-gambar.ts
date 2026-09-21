import "server-only";
import { createHash } from "node:crypto";
import { headerOf, type ColKey, type ExcelRow, type RowError } from "@/lib/soal/excel-format";
import { KOLOM_GAMBAR, type BarisSheet } from "@/lib/soal/excel-io";
import {
  MAKS_BYTE_GAMBAR,
  findMarkdownImageUrls,
  mapMarkdownImageUrls,
  parseDriveUrl,
  sisipkanGambar,
  sniffGambar,
  type InfoGambar,
} from "@/lib/soal/gambar-format";
import { importImagePath, publicImageUrl } from "@/lib/supabase/storage";

export const MAKS_GAMBAR_DRIVE = 100;
const MAKS_TOTAL_BYTE = 80 * 1024 * 1024;
const DRIVE_TIMEOUT_MS = 15_000;
const MAKS_REDIRECT = 5;
const DRIVE_PARALLEL = 4;

export type GambarTertunda = { path: string; url: string; bytes: Buffer; mime: string };

type HasilUnduh = { ok: true; bytes: Buffer; info: InfoGambar } | { ok: false; pesan: string };

/** Host yang boleh dikunjungi saat mengunduh dari Drive - mencegah unduhan diarahkan ke alamat lain (SSRF). */
function hostDriveDiizinkan(host: string): boolean {
  const h = host.toLowerCase();
  return h === "drive.google.com" || h === "docs.google.com" || h === "drive.usercontent.google.com" || h.endsWith(".googleusercontent.com");
}

const PESAN_AKSES =
  "File Drive tidak bisa diakses. Buka Drive, klik kanan file > Bagikan > Akses umum: ubah ke \"Siapa saja yang memiliki link\" (Viewer), lalu coba lagi.";

async function unduhDrive(id: string): Promise<HasilUnduh> {
  let url = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
  try {
    for (let hop = 0; hop <= MAKS_REDIRECT; hop++) {
      const res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(DRIVE_TIMEOUT_MS),
        headers: { "user-agent": "Mozilla/5.0 (compatible; AyoTKA-import)" },
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { ok: false, pesan: PESAN_AKSES };
        const next = new URL(loc, url);
        if (!hostDriveDiizinkan(next.hostname)) return { ok: false, pesan: PESAN_AKSES };
        url = next.toString();
        continue;
      }
      if (res.status === 404) return { ok: false, pesan: "File Drive tidak ditemukan. Periksa kembali linknya." };
      if (!res.ok) return { ok: false, pesan: `${PESAN_AKSES} (Google membalas ${res.status})` };

      const len = Number(res.headers.get("content-length") ?? 0);
      if (len > MAKS_BYTE_GAMBAR) return { ok: false, pesan: "Ukuran gambar di Drive melebihi 5 MB." };

      const reader = res.body?.getReader();
      if (!reader) return { ok: false, pesan: "Gagal membaca file dari Drive." };
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAKS_BYTE_GAMBAR) {
          await reader.cancel();
          return { ok: false, pesan: "Ukuran gambar di Drive melebihi 5 MB." };
        }
        chunks.push(value);
      }
      const bytes = Buffer.concat(chunks);
      const info = sniffGambar(bytes);
      if (!info) {
        return {
          ok: false,
          pesan: `Isi link Drive ini bukan gambar (PNG/JPEG/WEBP/GIF). Kalau file sudah benar, pastikan akses "Siapa saja yang memiliki link".`,
        };
      }
      return { ok: true, bytes, info };
    }
    return { ok: false, pesan: PESAN_AKSES };
  } catch {
    return { ok: false, pesan: "Gagal mengunduh dari Drive (koneksi terlalu lama atau terputus). Coba lagi." };
  }
}

function daftarkan(bytes: Buffer, info: InfoGambar, tertunda: Map<string, GambarTertunda>): string {
  const path = importImagePath(createHash("sha256").update(bytes).digest("hex"), info.ext);
  const ada = tertunda.get(path);
  if (ada) return ada.url;
  const url = publicImageUrl(path);
  tertunda.set(path, { path, url, bytes, mime: info.mime });
  return url;
}

/**
 * Ubah semua gambar di file Excel menjadi URL final SEBELUM validasi soal:
 *  - gambar yang ditempel di sel  -> disisipkan ke teks sel (di posisi penanda [gambar], atau di akhir)
 *  - link Google Drive di Media Soal / dalam ![](link) -> diunduh
 * Tidak ada yang diunggah di sini: hasilnya `tertunda` (path -> isi) yang baru diunggah
 * pemanggil setelah SELURUH file lolos validasi (semua-atau-tidak-sama-sekali).
 */
export async function resolveGambar(rows: BarisSheet[]): Promise<{
  rows: Array<{ row: number; cells: ExcelRow }>;
  tertunda: Map<string, GambarTertunda>;
  errors: RowError[];
}> {
  const errors: RowError[] = [];
  const tertunda = new Map<string, GambarTertunda>();

  // 1) Kumpulkan link Drive unik (dari Media Soal atau ![](...)) lalu unduh paralel terbatas.
  const driveIds = new Set<string>();
  for (const { cells } of rows) {
    for (const key of KOLOM_GAMBAR) {
      const t = (cells[key] ?? "").trim();
      if (!t) continue;
      const kandidat = key === "media" ? [t] : findMarkdownImageUrls(t);
      for (const u of kandidat) {
        const d = parseDriveUrl(u);
        if (d && d !== "folder") driveIds.add(d.id);
      }
    }
  }
  if (driveIds.size > MAKS_GAMBAR_DRIVE) {
    errors.push({ row: 0, kolom: "-", pesan: `Terlalu banyak gambar dari link Drive (${driveIds.size}). Maksimal ${MAKS_GAMBAR_DRIVE} gambar per file - pecah file menjadi beberapa bagian.` });
    return { rows: rows.map(({ row, cells }) => ({ row, cells })), tertunda, errors };
  }

  const unduhan = new Map<string, HasilUnduh>();
  const antrean = [...driveIds];
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(DRIVE_PARALLEL, antrean.length) }, async () => {
      while (idx < antrean.length) {
        const id = antrean[idx++]!;
        unduhan.set(id, await unduhDrive(id));
      }
    }),
  );

  const urlDrive = (id: string): string | null => {
    const h = unduhan.get(id);
    return h?.ok ? daftarkan(h.bytes, h.info, tertunda) : null;
  };

  // 2) Susun ulang isi tiap sel.
  const hasil = rows.map(({ row, cells, gambar }) => {
    const baru: ExcelRow = { ...cells };
    const err = (key: ColKey, pesan: string) => errors.push({ row, kolom: headerOf(key), pesan });

    for (const key of KOLOM_GAMBAR) {
      const asli = (cells[key] ?? "");
      const tempel = gambar[key] ?? [];

      // a) gambar tempelan -> URL
      const urls: string[] = [];
      for (const [i, g] of tempel.entries()) {
        const info = sniffGambar(g.buffer);
        if (!info) {
          err(key, `Gambar ke-${i + 1} di sel ini bukan PNG/JPEG/WEBP/GIF (Excel kadang menyimpan gambar tempelan/grafik dalam format lain). Simpan gambarnya sebagai PNG lalu sisipkan lagi.`);
          continue;
        }
        if (g.buffer.length > MAKS_BYTE_GAMBAR) {
          err(key, `Gambar ke-${i + 1} di sel ini lebih dari 5 MB.`);
          continue;
        }
        urls.push(daftarkan(g.buffer, info, tertunda));
      }
      if (tempel.length > 0 && urls.length !== tempel.length) continue; // sudah ada error di atas

      if (key === "media") {
        const t = asli.trim();
        if (urls.length > 1) { err(key, "Media Soal hanya boleh berisi 1 gambar. Gambar tambahan bisa ditaruh di Teks Soal dengan penanda [gambar]."); continue; }
        if (urls.length === 1 && t) { err(key, "Media Soal berisi gambar tempelan DAN teks/link sekaligus. Pilih salah satu."); continue; }
        if (urls.length === 1) { baru.media = urls[0]!; continue; }
        if (!t) continue;
        const d = parseDriveUrl(t);
        if (d === "folder") { err(key, "Ini link FOLDER Drive. Gunakan link ke satu file gambar (klik kanan gambar > Bagikan > Salin link)."); continue; }
        if (d) {
          const h = unduhan.get(d.id);
          if (h && !h.ok) err(key, h.pesan);
          else { const u = urlDrive(d.id); if (u) baru.media = u; }
        }
        continue;
      }

      // b) sisipkan gambar tempelan ke teks
      let teks = asli;
      if (tempel.length > 0 || /\[\s*gambar\s*\d*\s*\]/i.test(asli)) {
        const r = sisipkanGambar(asli, urls);
        if ("error" in r) { err(key, r.error); continue; }
        teks = r.teks;
      }

      // c) link Drive di dalam ![](...)
      const sebelum = errors.length;
      teks = mapMarkdownImageUrls(teks, (u) => {
        const d = parseDriveUrl(u);
        if (!d) return u;
        if (d === "folder") { err(key, "Ada link FOLDER Drive di dalam ![](...). Gunakan link ke satu file gambar."); return u; }
        const h = unduhan.get(d.id);
        if (h && !h.ok) { err(key, h.pesan); return u; }
        return urlDrive(d.id) ?? u;
      });
      if (errors.length === sebelum) baru[key] = teks;
    }
    return { row, cells: baru };
  });

  // 3) Batas total ukuran (jaga memori & waktu proses).
  let total = 0;
  for (const g of tertunda.values()) total += g.bytes.length;
  if (total > MAKS_TOTAL_BYTE) {
    errors.push({ row: 0, kolom: "-", pesan: `Total ukuran semua gambar terlalu besar (${Math.round(total / 1024 / 1024)} MB, maksimal 80 MB per file). Pecah menjadi beberapa file.` });
  }

  return { rows: hasil, tertunda, errors };
}
