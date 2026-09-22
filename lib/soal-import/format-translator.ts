import type { Jenjang, LevelKognitif, QuestionFormat, StimulusTipe, TingkatKesulitan } from "@prisma/client";

/** PG | PGK_MCMA | PGK_KATEGORI -> pg | pg_kompleks | pg_kategori (dokumen Bagian 06). */
export function translateBentukSoal(bentukSoal: string): QuestionFormat {
  switch (bentukSoal) {
    case "PG":
      return "pg";
    case "PGK_MCMA":
      return "pg_kompleks";
    case "PGK_KATEGORI":
      return "pg_kategori";
    default:
      throw new Error(`bentuk_soal tidak dikenal dari soal.ayotka.id: "${bentukSoal}"`);
  }
}

/** rendah | sedang | tinggi -> mudah | sedang | sulit (dokumen Bagian 06). */
export function translateTingkatKesulitan(tingkat: string): TingkatKesulitan {
  switch (tingkat) {
    case "rendah":
      return "mudah";
    case "sedang":
      return "sedang";
    case "tinggi":
      return "sulit";
    default:
      throw new Error(`tingkat_kesulitan tidak dikenal dari soal.ayotka.id: "${tingkat}"`);
  }
}

/** TKA cuma SD & SMP - jenjang lain di luar cakupan ayotka-app. */
export function translateJenjang(jenjang: string): Jenjang {
  switch (jenjang) {
    case "SD/MI":
    case "SD":
      return "SD";
    case "SMP/MTs":
    case "SMP":
      return "SMP";
    default:
      throw new Error(`jenjang tidak didukung ayotka-app: "${jenjang}"`);
  }
}

/** teks | data - nilainya identik di kedua sistem, ini cuma memvalidasi tipenya. */
export function translateStimulusTipe(tipe: string): StimulusTipe {
  if (tipe === "teks" || tipe === "data") return tipe;
  throw new Error(`tipe stimulus tidak dikenal dari soal.ayotka.id: "${tipe}"`);
}

/**
 * level_kognitif di soal.ayotka.id itu kolom teks bebas (tidak ber-enum di
 * sumbernya), dan data produksi terbukti tidak konsisten - dicek langsung ke
 * database, ada baris yang nilainya justru label kompetensi ("Pemahaman
 * Tekstual", "Evaluasi dan Apresiasi") atau tingkat kesulitan ("sedang",
 * "Rendah") yang nyasar ke kolom ini, bukan level kognitif sungguhan.
 *
 * Sengaja TIDAK menebak: hanya 3 label kognitif standar TKA yang dikenali
 * (dengan/tanpa prefix angka seperti "1. Pengetahuan dan Pemahaman", juga
 * terbukti dipakai di data produksi). Nilai lain dikembalikan null supaya
 * pemanggil memperlakukannya sebagai "belum bisa ditentukan" - bukan salah
 * petakan diam-diam.
 */
export function translateLevelKognitif(levelKognitif: string | null): LevelKognitif | null {
  if (!levelKognitif) return null;
  const normalized = levelKognitif
    .replace(/^\d+\.\s*/, "")
    .trim()
    .toLowerCase();
  switch (normalized) {
    case "pengetahuan dan pemahaman":
      return "L1";
    case "aplikasi":
      return "L2";
    case "penalaran":
      return "L3";
    default:
      return null;
  }
}
