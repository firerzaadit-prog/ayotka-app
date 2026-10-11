/**
 * Struktur dan utilitas media/ilustrasi soal AyoTKA.
 * Mendukung soal 1 gambar (klasik), soal bergambar ganda (mis. Diagram Presisi SVG + Foto Ilustrasi),
 * serta deskripsi teks/caption visualisasi pendukung dari generator soal.ayotka.id.
 */

export type MediaItemTipe = "svg" | "foto" | "diagram" | "url";

export interface MediaItem {
  tipe: MediaItemTipe;
  label: string; // misal "Diagram Presisi (SVG)" atau "Foto Ilustrasi"
  url?: string;
  svgContent?: string;
  alt?: string;
}

export interface QuestionMediaData {
  tipe: "multi" | "single";
  caption?: string | null; // teks visualisasi / deskripsi_alt
  items: MediaItem[];
}

type ObjekMentah = Record<string, unknown>;

function adalahObjek(v: unknown): v is ObjekMentah {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** String tak kosong (setelah dipangkas) atau undefined. */
function teksAtauUndefined(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

/**
 * Alamat gambar yang boleh ditampilkan di <img>: http(s), jalur dari akar situs, atau data URI gambar. Skema lain
 * (javascript:, data:text/html, file:, dst.) ditolak. <img> tidak menjalankan skrip, tetapi nilai ini berasal dari
 * database dan diteruskan ke atribut src, jadi tidak ada alasan menerima yang bukan gambar.
 */
export function urlGambarAman(v: string | undefined): string | undefined {
  if (!v) return undefined;
  return /^(https?:\/\/|\/(?![\\/])|data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,])/i.test(v) ? v : undefined;
}

/**
 * Normalisasi data media soal dari string database (bisa URL mentah, JSON string, atau data URI).
 * Sepenuhnya backwards-compatible dengan semua format media lama.
 *
 * Mengembalikan null bila tidak ada satu pun gambar yang bisa ditampilkan - termasuk untuk JSON yang rusak atau bukan
 * format media (lebih baik tidak menampilkan apa-apa daripada gambar rusak dengan JSON sebagai alamatnya).
 */
export function parseQuestionMedia(
  raw: string | null | undefined,
  defaultAlt?: string | null,
): QuestionMediaData | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // JSON array bukan format media.
  if (s.startsWith("[")) return null;

  // Format JSON (soal dengan multiple ilustrasi atau terstruktur). Alamat gambar tidak pernah diawali "{".
  if (s.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(s);
    } catch {
      return null;
    }
    if (!adalahObjek(parsed) || !Array.isArray(parsed.items)) return null;

    const caption = teksAtauUndefined(parsed.caption) ?? teksAtauUndefined(defaultAlt) ?? null;
    const items: MediaItem[] = [];
    for (const mentah of parsed.items as unknown[]) {
      if (!adalahObjek(mentah)) continue;
      const jenis = teksAtauUndefined(mentah.tipe) ?? teksAtauUndefined(mentah.type);
      const isSvg = jenis === "svg" || jenis === "diagram";
      const url = urlGambarAman(teksAtauUndefined(mentah.url));
      const svgContent = teksAtauUndefined(mentah.svgContent);
      // Item tanpa sumber gambar apa pun tidak ada gunanya (dan akan membuat tab kosong).
      if (!url && !svgContent) continue;
      items.push({
        tipe: isSvg ? "svg" : "foto",
        label: teksAtauUndefined(mentah.label) ?? (isSvg ? "Diagram Presisi (SVG)" : "Foto Ilustrasi"),
        url,
        svgContent,
        alt: teksAtauUndefined(mentah.alt) ?? caption ?? undefined,
      });
    }
    if (items.length === 0) return null;
    return { tipe: items.length > 1 ? "multi" : "single", caption, items };
  }

  // Format klasik: URL gambar tunggal atau data URI
  const url = urlGambarAman(s);
  if (!url) return null;
  const isSvg = url.includes("image/svg+xml") || /\.svg(\?|$)/i.test(url);
  return {
    tipe: "single",
    caption: defaultAlt?.trim() || null,
    items: [
      {
        tipe: isSvg ? "svg" : "foto",
        label: isSvg ? "Diagram Presisi (SVG)" : "Foto Ilustrasi",
        url,
        alt: defaultAlt?.trim() || undefined,
      },
    ],
  };
}

/**
 * Format payload QuestionMediaData menjadi string JSON siap disimpan ke kolom Question.media.
 */
export function formatQuestionMedia(data: QuestionMediaData): string {
  // Bila hanya 1 item dan tidak ada caption/svgContent khusus, simpan URL langsung untuk keringkasan
  if (data.items.length === 1 && !data.caption && !data.items[0]?.svgContent && data.items[0]?.url) {
    return data.items[0].url;
  }
  return JSON.stringify(data);
}

/**
 * Nilai kolom "Media Soal" untuk ekspor Excel. Kolom itu hanya menerima SATU alamat gambar http(s) (lihat validasi
 * impor di lib/soal/excel-format.ts), sedangkan media ganda disimpan sebagai JSON; JSON mentah di sel akan ditolak
 * saat file yang sama diimpor lagi dan bisa melewati batas 32.767 karakter sel Excel. Jadi untuk media ganda diekspor
 * alamat foto pertama yang http(s) (diagram SVG dan keterangan tidak ikut). Tanpa foto http(s) = kosong.
 */
export function mediaUntukExcel(raw: string | null | undefined): string {
  const data = parseQuestionMedia(raw);
  if (!data) return "";
  const foto = data.items.find((it) => it.url && /^https?:\/\//i.test(it.url));
  return foto?.url ?? "";
}
