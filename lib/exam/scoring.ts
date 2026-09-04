/**
 * Tiket 4.10 (Bagian 6.1 brief, "Mesin Skoring — Biner untuk Semua Format"):
 * semua format dinilai penuh/0, tidak ada skor pecahan. Fungsi murni (tidak
 * menyentuh Prisma) supaya gampang diuji unit - dipanggil dari route submit
 * yang menyediakan data soal & jawaban.
 *
 * Bentuk jawaban_json per format (persis Bagian 6.1):
 * - pg: { option_id }
 * - pg_kompleks: { option_ids: string[] }
 * - pg_kategori: { [statementId]: categoryId } - dipakai relasional lewat
 *   attempt_answer_statements untuk skoring, jawaban_json cuma catatan.
 */

export type PgJawaban = { option_id: string };
export type PgKompleksJawaban = { option_ids: string[] };
export type PgKategoriJawaban = Record<string, string>;

export function isJawabanKosong(jawabanJson: unknown): boolean {
  if (jawabanJson == null) return true;
  if (typeof jawabanJson !== "object") return true;
  const obj = jawabanJson as Record<string, unknown>;
  if ("option_id" in obj) return !obj.option_id;
  if ("option_ids" in obj) return !Array.isArray(obj.option_ids) || obj.option_ids.length === 0;
  return Object.keys(obj).length === 0;
}

export function scorePg(
  jawaban: PgJawaban | null | undefined,
  options: { id: string; isCorrect: boolean }[],
): boolean {
  if (!jawaban?.option_id) return false;
  const correct = options.find((o) => o.isCorrect);
  return correct !== undefined && correct.id === jawaban.option_id;
}

export function scorePgKompleks(
  jawaban: PgKompleksJawaban | null | undefined,
  options: { id: string; isCorrect: boolean }[],
): boolean {
  if (!jawaban?.option_ids || jawaban.option_ids.length === 0) return false;
  const correctIds = new Set(options.filter((o) => o.isCorrect).map((o) => o.id));
  const selected = new Set(jawaban.option_ids);
  if (selected.size !== correctIds.size) return false;
  for (const id of selected) {
    if (!correctIds.has(id)) return false;
  }
  return true;
}

export function scorePgKategori(
  jawaban: PgKategoriJawaban | null | undefined,
  statements: { id: string; correctCategoryId: string }[],
): boolean {
  if (!jawaban || statements.length === 0) return false;
  for (const s of statements) {
    if (jawaban[s.id] !== s.correctCategoryId) return false;
  }
  return true;
}

type QuestionForScoring = {
  format: "pg" | "pg_kompleks" | "pg_kategori";
  bobot: number;
  options: { id: string; isCorrect: boolean }[];
  statements: { id: string; correctCategoryId: string }[];
};

/** Skor per soal: bobot penuh kalau benar, 0 kalau salah/kosong - tidak pernah pecahan. */
export function scoreQuestion(
  question: QuestionForScoring,
  jawabanJson: unknown,
): { isCorrect: boolean; skor: number; skorMaks: number } {
  let isCorrect = false;
  if (question.format === "pg") {
    isCorrect = scorePg(jawabanJson as PgJawaban, question.options);
  } else if (question.format === "pg_kompleks") {
    isCorrect = scorePgKompleks(jawabanJson as PgKompleksJawaban, question.options);
  } else {
    isCorrect = scorePgKategori(jawabanJson as PgKategoriJawaban, question.statements);
  }
  return { isCorrect, skor: isCorrect ? question.bobot : 0, skorMaks: question.bobot };
}

/** skor_akhir = (Σ skor diperoleh / Σ skor maksimum) × 100 (Bagian 6.1 brief), tanpa nilai minus. */
export function computeSkorAkhir(skorMentah: number, skorMaksTotal: number): number {
  if (skorMaksTotal <= 0) return 0;
  return Math.max(0, (skorMentah / skorMaksTotal) * 100);
}

/** Agregasi per kompetensi: total skor diperoleh ÷ total skor maksimum (bukan sekadar jumlah benar). */
export function aggregateCompetency(
  answers: { kompetensiId: string; skor: number; skorMaks: number }[],
): { kompetensiId: string; jmlBenar: number; jmlSoal: number; persentase: number }[] {
  const byKompetensi = new Map<
    string,
    { jmlBenar: number; jmlSoal: number; skorTotal: number; skorMaksTotal: number }
  >();

  for (const a of answers) {
    const bucket = byKompetensi.get(a.kompetensiId) ?? {
      jmlBenar: 0,
      jmlSoal: 0,
      skorTotal: 0,
      skorMaksTotal: 0,
    };
    bucket.jmlSoal += 1;
    if (a.skor >= a.skorMaks && a.skorMaks > 0) bucket.jmlBenar += 1;
    bucket.skorTotal += a.skor;
    bucket.skorMaksTotal += a.skorMaks;
    byKompetensi.set(a.kompetensiId, bucket);
  }

  return Array.from(byKompetensi.entries()).map(([kompetensiId, b]) => ({
    kompetensiId,
    jmlBenar: b.jmlBenar,
    jmlSoal: b.jmlSoal,
    persentase: b.skorMaksTotal > 0 ? (b.skorTotal / b.skorMaksTotal) * 100 : 0,
  }));
}

export type KategoriKesiapan = "kurang" | "memadai" | "baik" | "istimewa";

/**
 * Batas nilai kategori capaian TKA, sumber: infografis resmi Kemendikdasmen
 * "Deskripsi Capaian TKA SMP/MTs/Sederajat 2026" (Badan Kebijakan Pendidikan
 * Dasar dan Menengah). Angka SD tidak dipublikasikan resmi (dokumen setara
 * SD cuma berisi deskripsi kualitatif tanpa rentang nilai) - atas persetujuan
 * pemilik produk, angka SMP dipakai juga untuk SD supaya sistemnya konsisten,
 * BUKAN klaim bahwa ini angka resmi khusus SD (lihat catatan di UI kesiapan).
 * Predikat Istimewa (nilai >= 95 per mata pelajaran) berlaku sama di kedua
 * jenjang dan didahulukan di atas "Baik" - lihat klasifikasiKesiapan.
 */
const KESIAPAN_THRESHOLDS: Record<string, { memadai: number; baik: number }> = {
  Matematika: { memadai: 33.33, baik: 56.67 },
  "Bahasa Indonesia": { memadai: 50, baik: 76.67 },
};

const KESIAPAN_ISTIMEWA_MIN = 95;

/** Mata pelajaran yang cakupan kategori kesiapannya sudah didukung (di luar ini, mis. IPA/Bahasa Inggris, belum ada standarnya). */
export function isSubjectKesiapanDidukung(subjectNama: string): boolean {
  return Object.prototype.hasOwnProperty.call(KESIAPAN_THRESHOLDS, subjectNama);
}

/**
 * Klasifikasikan skor akhir (0-100) ke kategori capaian resmi TKA. Null
 * kalau mata pelajarannya di luar cakupan (bukan Matematika/Bahasa Indonesia).
 */
export function klasifikasiKesiapan(subjectNama: string, skorAkhir: number): KategoriKesiapan | null {
  const t = KESIAPAN_THRESHOLDS[subjectNama];
  if (!t) return null;
  if (skorAkhir >= KESIAPAN_ISTIMEWA_MIN) return "istimewa";
  if (skorAkhir >= t.baik) return "baik";
  if (skorAkhir >= t.memadai) return "memadai";
  return "kurang";
}
