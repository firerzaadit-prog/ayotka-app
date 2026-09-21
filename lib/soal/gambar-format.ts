/**
 * Aturan gambar untuk impor Excel (murni: tanpa I/O supaya bisa dites terpisah).
 * Ada dua sumber gambar: (1) gambar yang ditempel di sel Excel, (2) link Google
 * Drive di kolom Media Soal atau di dalam sintaks ![](link).
 */

export const MAKS_BYTE_GAMBAR = 5 * 1024 * 1024;

export type InfoGambar = { mime: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; ext: "png" | "jpg" | "webp" | "gif" };

/** Tipe file ditentukan dari isi file (magic bytes), bukan dari nama/ekstensi/header yang bisa salah atau dipalsukan. */
export function sniffGambar(b: Uint8Array): InfoGambar | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return { mime: "image/gif", ext: "gif" };
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) return { mime: "image/webp", ext: "webp" };
  return null;
}

const DRIVE_ID = "[A-Za-z0-9_-]{15,}";

/**
 * Kenali link Google Drive (file/d/ID, open?id=, uc?id=, lh3.googleusercontent.com/d/ID).
 * "folder" = link folder (bukan file gambar); null = bukan link Drive sama sekali.
 */
export function parseDriveUrl(raw: string): { id: string } | "folder" | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();

  if (host === "lh3.googleusercontent.com") {
    const m = u.pathname.match(new RegExp(`^/d/(${DRIVE_ID})`));
    return m ? { id: m[1]! } : null;
  }
  if (host !== "drive.google.com" && host !== "docs.google.com" && host !== "drive.usercontent.google.com") return null;

  if (/\/folders\//.test(u.pathname)) return "folder";
  const path = u.pathname.match(new RegExp(`/file/(?:u/\\d+/)?d/(${DRIVE_ID})`));
  if (path) return { id: path[1]! };
  const q = u.searchParams.get("id");
  if (q && new RegExp(`^${DRIVE_ID}$`).test(q)) return { id: q };
  return null;
}

/** Sama dengan sintaks gambar yang dirender RichText: ![alt](url). */
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

export function findMarkdownImageUrls(text: string): string[] {
  return [...text.matchAll(MARKDOWN_IMAGE)].map((m) => m[2]!);
}

export function mapMarkdownImageUrls(text: string, fn: (url: string) => string): string {
  return text.replace(MARKDOWN_IMAGE, (_all, alt: string, url: string) => `![${alt}](${fn(url)})`);
}

/** Penanda posisi gambar yang ditempel di sel: [gambar], [gambar 1], [gambar2]. */
const PENANDA = /\[\s*gambar\s*(\d+)?\s*\]/gi;

/**
 * Sisipkan gambar-gambar yang ditempel di sebuah sel ke dalam teks sel itu.
 * - Penanda [gambar] (berurutan) atau [gambar 2] (nomor eksplisit, urutan tempel dari atas ke bawah)
 *   diganti dengan ![](url) di posisi penanda - jadi gambar bisa di tengah kalimat.
 * - Gambar yang tidak dipanggil penanda dilekatkan di akhir teks, di baris baru.
 */
export function sisipkanGambar(teks: string, urls: string[]): { teks: string } | { error: string } {
  const dipakai = new Set<number>();
  let error: string | null = null;

  // Nomor eksplisit didahulukan supaya penanda tanpa nomor tidak "mencuri" gambar yang sudah dipesan.
  for (const m of teks.matchAll(PENANDA)) {
    if (m[1] !== undefined) dipakai.add(Number(m[1]));
  }
  const bebas = () => {
    for (let i = 1; i <= urls.length; i++) if (!dipakai.has(i)) return i;
    return null;
  };

  const hasil = teks.replace(PENANDA, (_all, nomor: string | undefined) => {
    let n: number | null;
    if (nomor !== undefined) n = Number(nomor);
    else {
      n = bebas();
      if (n !== null) dipakai.add(n);
    }
    const url = n !== null ? urls[n - 1] : undefined;
    if (!url) {
      error ??= urls.length === 0
        ? "Ada penanda [gambar] tetapi tidak ada gambar yang ditempel di sel ini."
        : `Penanda ${nomor !== undefined ? `[gambar ${nomor}]` : "[gambar]"} tidak punya gambar (sel ini hanya berisi ${urls.length} gambar).`;
      return "";
    }
    return `![](${url})`;
  });
  if (error) return { error };

  const sisa = urls.filter((_u, i) => !dipakai.has(i + 1));
  if (sisa.length === 0) return { teks: hasil };
  const tambahan = sisa.map((u) => `![](${u})`).join("\n");
  return { teks: hasil.trim() === "" ? tambahan : `${hasil}\n${tambahan}` };
}
