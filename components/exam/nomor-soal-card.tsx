"use client";

import { cn } from "@/lib/utils/cn";

type Props = {
  /** Id soal sesuai urutan tampil. */
  questionIds: string[];
  currentIndex: number;
  /** Soal yang jawabannya sudah terisi. */
  answeredIds: Set<string>;
  /** Soal yang ditandai ragu-ragu. */
  raguIds: Set<string>;
  onSelect: (index: number) => void;
};

type Status = "aktif" | "ragu" | "terjawab" | "kosong";

const STATUS_LABEL: Record<Status, string> = {
  aktif: "sedang dibuka",
  ragu: "ragu-ragu",
  terjawab: "sudah dijawab",
  kosong: "belum dijawab",
};

const STATUS_CLASS: Record<Status, string> = {
  aktif: "border-transparent bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md ring-2 ring-indigo-300",
  ragu: "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200",
  terjawab: "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
  kosong: "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100",
};

/** Kartu "Nomor Soal": grid nomor berwarna (belum dijawab / dijawab / ragu / aktif) + keterangan. */
export function NomorSoalCard({ questionIds, currentIndex, answeredIds, raguIds, onSelect }: Props) {
  const terjawab = questionIds.filter((id) => answeredIds.has(id)).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">Nomor Soal</p>
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-emerald-700">{terjawab}</span> / {questionIds.length} terjawab
        </p>
      </div>

      <div className="mt-3 grid max-h-72 grid-cols-5 gap-2 overflow-y-auto pr-0.5">
        {questionIds.map((id, i) => {
          const status: Status =
            i === currentIndex ? "aktif" : raguIds.has(id) ? "ragu" : answeredIds.has(id) ? "terjawab" : "kosong";
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`Soal nomor ${i + 1}, ${STATUS_LABEL[status]}`}
              aria-current={i === currentIndex ? "step" : undefined}
              className={cn(
                "h-10 rounded-lg border text-sm font-semibold transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
                STATUS_CLASS[status],
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-600">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-transparent bg-gradient-to-br from-indigo-600 to-violet-600" />
          Sedang dibuka
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-emerald-200 bg-emerald-100" />
          Sudah dijawab
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-rose-200 bg-rose-50" />
          Belum dijawab
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-amber-300 bg-amber-100" />
          Ragu-ragu
        </li>
      </ul>
    </div>
  );
}
