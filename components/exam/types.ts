export type ExamOption = { id: string; label: string; teks: string; media: string | null };
export type ExamCategory = { id: string; label: string };
export type ExamStatement = { id: string; teks: string; media: string | null };

export type ExamQuestion = {
  id: string;
  format: "pg" | "pg_kompleks" | "pg_kategori";
  teks: string;
  media: string | null;
  bobot: number;
  options: ExamOption[];
  categories: ExamCategory[];
  statements: ExamStatement[];
};

export type PgJawaban = { option_id: string };
export type PgKompleksJawaban = { option_ids: string[] };
export type PgKategoriJawaban = Record<string, string>;
export type ExamJawaban = PgJawaban | PgKompleksJawaban | PgKategoriJawaban;
