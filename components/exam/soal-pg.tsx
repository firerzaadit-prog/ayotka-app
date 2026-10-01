"use client";

import { RichText } from "@/components/soal/rich-text";
import type { ExamOption, PgJawaban } from "@/components/exam/types";

/** Tiket 4.5: PG - radio button, pilih 1. */
export function SoalPg({
  options,
  value,
  onChange,
}: {
  options: ExamOption[];
  value: PgJawaban | undefined;
  onChange: (jawaban: PgJawaban) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <label
          key={opt.id}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
            value?.option_id === opt.id
              ? "border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500/30"
              : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
          }`}
        >
          <input
            type="radio"
            className="mt-0.5 h-4 w-4 accent-indigo-600"
            checked={value?.option_id === opt.id}
            onChange={() => onChange({ option_id: opt.id })}
          />
          <span className="flex-1">
            <span className="mr-1 font-semibold text-slate-700">{opt.label}.</span>
            <RichText text={opt.teks} />
            {opt.media && (
              <img src={opt.media} alt="" className="mt-2 max-w-xs rounded-md border" />
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
