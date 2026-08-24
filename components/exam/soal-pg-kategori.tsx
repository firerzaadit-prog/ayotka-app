"use client";

import { RichText } from "@/components/soal/rich-text";
import type { ExamCategory, ExamStatement, PgKategoriJawaban } from "@/components/exam/types";

/**
 * Tiket 4.7: PG Kategori - tabel (baris=pernyataan, maks 3; kolom=kategori,
 * selalu Benar/Salah, TIDAK PERNAH diacak). Dua layout terpisah: tabel
 * biasa di desktop/tablet, kartu bertumpuk di HP (Bagian 3.3 brief) supaya
 * tidak ada scroll horizontal sama sekali di viewport <=375px.
 */
export function SoalPgKategori({
  categories,
  statements,
  value,
  onChange,
}: {
  categories: ExamCategory[];
  statements: ExamStatement[];
  value: PgKategoriJawaban | undefined;
  onChange: (jawaban: PgKategoriJawaban) => void;
}) {
  const answers = value ?? {};

  function pick(statementId: string, categoryId: string) {
    onChange({ ...answers, [statementId]: categoryId });
  }

  return (
    <div>
      {/* Desktop/tablet: tabel biasa */}
      <table className="hidden w-full border-collapse text-left text-sm sm:table">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-4 font-medium">Pernyataan</th>
            {categories.map((c) => (
              <th key={c.id} className="w-24 py-2 text-center font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {statements.map((s) => (
            <tr key={s.id} className="border-b border-slate-100 last:border-0">
              <td className="py-3 pr-4">
                <RichText text={s.teks} />
                {s.media && <img src={s.media} alt="" className="mt-2 max-w-xs rounded-md border" />}
              </td>
              {categories.map((c) => (
                <td key={c.id} className="py-3 text-center">
                  <input
                    type="radio"
                    name={`kategori-${s.id}`}
                    checked={answers[s.id] === c.id}
                    onChange={() => pick(s.id, c.id)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* HP: kartu bertumpuk, tanpa scroll horizontal */}
      <div className="flex flex-col gap-3 sm:hidden">
        {statements.map((s) => (
          <div key={s.id} className="rounded-md border border-slate-200 p-3">
            <p className="text-sm">
              <RichText text={s.teks} />
            </p>
            {s.media && <img src={s.media} alt="" className="mt-2 max-w-full rounded-md border" />}
            <div className="mt-3 flex gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(s.id, c.id)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                    answers[s.id] === c.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
