import type { Jenjang, LevelKognitif, QuestionFormat, StimulusTipe, TingkatKesulitan } from "@prisma/client";

/** PG | PGK_MCMA | PGK_KATEGORI -> pg | pg_kompleks | pg_kategori (dokumen Bagian 06). */
export function translateBentukSoal(bentukSoal: string): QuestionFormat {
  const b = (bentukSoal || "").trim().toUpperCase();
  switch (b) {
    case "PG":
      return "pg";
    case "PGK_MCMA":
    case "PG_KOMPLEKS":
    case "PGK":
      return "pg_kompleks";
    case "PGK_KATEGORI":
    case "PG_KATEGORI":
    case "KATEGORI":
      return "pg_kategori";
    default:
      if (b.includes("KATEGORI")) return "pg_kategori";
      if (b.includes("KOMPLEKS") || b.includes("MCMA")) return "pg_kompleks";
      if (b.includes("PG") || b.includes("GANDA")) return "pg";
      throw new Error(`bentuk_soal tidak dikenal dari soal.ayotka.id: "${bentukSoal}"`);
  }
}

/** rendah | sedang | tinggi -> mudah | sedang | sulit (dokumen Bagian 06). */
export function translateTingkatKesulitan(tingkat: string): TingkatKesulitan {
  const t = (tingkat || "").trim().toLowerCase();
  switch (t) {
    case "rendah":
    case "mudah":
      return "mudah";
    case "sedang":
      return "sedang";
    case "tinggi":
    case "sulit":
    case "sukar":
      return "sulit";
    default:
      return "sedang";
  }
}

/** TKA cuma SD & SMP - jenjang lain di luar cakupan ayotka-app. */
export function translateJenjang(jenjang: string): Jenjang {
  const j = (jenjang || "").trim().toUpperCase();
  if (j === "SD" || j.startsWith("SD") || j.includes("MI")) {
    return "SD";
  }
  if (j === "SMP" || j.startsWith("SMP") || j.includes("MTS")) {
    return "SMP";
  }
  throw new Error(`jenjang tidak didukung ayotka-app: "${jenjang}"`);
}

/** teks | data - nilainya identik di kedua sistem, ini cuma memvalidasi tipenya. */
export function translateStimulusTipe(tipe: string): StimulusTipe {
  if (tipe === "teks" || tipe === "data") return tipe;
  throw new Error(`tipe stimulus tidak dikenal dari soal.ayotka.id: "${tipe}"`);
}

/**
 * Menerjemahkan level kognitif dari generator soal (soal.ayotka.id / GENERATOR-SOAL-TKA)
 * ke standar LevelKognitif ("L1" | "L2" | "L3").
 *
 * Mengikuti standar taksonomi Kemendikdasmen (STANDAR_TAKSONOMI_DAN_RAPOR_TKA.md):
 * - Bahasa Indonesia:
 *   - "Pemahaman Tekstual" / "Menemukan Informasi" -> L1
 *   - "Pemahaman Inferensial" / "Menginterpretasi dan Mengintegrasikan" -> L2
 *   - "Evaluasi dan Apresiasi" / "Mengevaluasi dan Merefleksi" -> L3
 * - Matematika & Mapel Lain:
 *   - "Pengetahuan dan Pemahaman" -> L1
 *   - "Aplikasi" / "Penerapan" -> L2
 *   - "Penalaran" -> L3
 * - Format kode atau level langsung:
 *   - "L1", "Level 1", "1", "C1", "C2" -> L1
 *   - "L2", "Level 2", "2", "C3", "C4" -> L2
 *   - "L3", "Level 3", "3", "C5", "C6" -> L3
 * - Tingkat kesulitan yang ada di kolom level kognitif:
 *   - "Rendah" / "Mudah" -> L1
 *   - "Sedang" -> L2
 *   - "Tinggi" / "Sulit" / "Sukar" -> L3
 * - Fallback:
 *   - Berdasarkan tingkat kesulitan (jika diberikan), atau default ke "L1".
 *   - Menjamin proses impor dari soal.ayotka.id tidak terblokir penyesuaian manual
 *     sehingga paket soal langsung masuk ke Draft Bank Soal.
 */
export function translateLevelKognitif(
  levelKognitif: string | null,
  tingkatKesulitan?: string | null,
): LevelKognitif {
  if (levelKognitif) {
    const normalized = levelKognitif
      .replace(/^\d+\.\s*/, "")
      .trim()
      .toLowerCase();

    // 1. Level 1: Tekstual, Pengetahuan, Pemahaman, Informasi
    if (
      normalized.includes("tekstual") ||
      normalized.includes("menemukan informasi") ||
      normalized.includes("pengetahuan") ||
      normalized === "pemahaman" ||
      normalized === "l1" ||
      normalized === "level 1" ||
      normalized === "level i" ||
      normalized === "1" ||
      normalized === "c1" ||
      normalized === "c2" ||
      normalized === "rendah" ||
      normalized === "mudah"
    ) {
      return "L1";
    }

    // 2. Level 2: Inferensial, Aplikasi, Penerapan, Interpretasi
    if (
      normalized.includes("inferensial") ||
      normalized.includes("aplikasi") ||
      normalized.includes("penerapan") ||
      normalized.includes("terapan") ||
      normalized.includes("interpretasi") ||
      normalized.includes("integrasi") ||
      normalized === "l2" ||
      normalized === "level 2" ||
      normalized === "level ii" ||
      normalized === "2" ||
      normalized === "c3" ||
      normalized === "c4" ||
      normalized === "sedang"
    ) {
      return "L2";
    }

    // 3. Level 3: Evaluasi, Apresiasi, Penalaran, Refleksi
    if (
      normalized.includes("evaluasi") ||
      normalized.includes("apresiasi") ||
      normalized.includes("penalaran") ||
      normalized.includes("nalar") ||
      normalized.includes("merefleksi") ||
      normalized.includes("refleksi") ||
      normalized === "l3" ||
      normalized === "level 3" ||
      normalized === "level iii" ||
      normalized === "3" ||
      normalized === "c5" ||
      normalized === "c6" ||
      normalized === "tinggi" ||
      normalized === "sulit" ||
      normalized === "sukar"
    ) {
      return "L3";
    }
  }

  // Fallback berdasarkan tingkat kesulitan jika levelKognitif kosong / tidak cocok
  if (tingkatKesulitan) {
    const tk = tingkatKesulitan.trim().toLowerCase();
    if (tk === "rendah" || tk === "mudah") return "L1";
    if (tk === "sedang") return "L2";
    if (tk === "tinggi" || tk === "sulit" || tk === "sukar") return "L3";
  }

  // Fallback aman agar tidak pernah null / memblokir impor
  return "L1";
}
