"use client";

import { RichText } from "@/components/soal/rich-text";
import type { ExamOption, PgKompleksJawaban } from "@/components/exam/types";

/**
 * Tiket 4.6: PG Kompleks - checkbox, pilih >=1. Sengaja tidak ada indikasi
 * jumlah jawaban benar di UI mana pun (Bagian 3.3 brief).
 */
export function SoalPgKompleks({
  options,
  value,
  onChange,
}: {
  options: ExamOption[];
  value: PgKompleksJawaban | undefined;
  onChange: (jawaban: PgKompleksJawaban) => void;
}) {
  const selected = new Set(value?.option_ids ?? []);

  function toggle(optionId: string) {
    const next = new Set(selected);
    if (next.has(optionId)) next.delete(optionId);
    else next.add(optionId);
    onChange({ option_ids: Array.from(next) });
  }

  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <label
          key={opt.id}
          className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 text-sm ${
            selected.has(opt.id) ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50"
          }`}
        >
          <input
            type="checkbox"
            className="mt-0.5"
            checked={selected.has(opt.id)}
            onChange={() => toggle(opt.id)}
          />
          <span className="flex-1">
            <span className="mr-1 font-medium">{opt.label}.</span>
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
