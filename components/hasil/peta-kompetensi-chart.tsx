import { competencyTier, COMPETENCY_TIER_CLASS } from "@/lib/exam/competency-color";

type MateriScore = { materiNama: string; jmlBenar: number; jmlSoal: number; persentase: number };

/**
 * Grafik batang horizontal 3 warna per Materi (Bagian 8.7 brief) - ambang
 * warna sama persis dengan versi PDF, lihat lib/exam/competency-color.ts.
 */
export function PetaKompetensiChart({ scores }: { scores: MateriScore[] }) {
  return (
    <div className="flex flex-col gap-3">
      {scores.map((s) => {
        const tier = competencyTier(s.persentase);
        const cls = COMPETENCY_TIER_CLASS[tier];
        return (
          <div key={s.materiNama}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-slate-900">{s.materiNama}</span>
              <span className={`font-mono text-xs font-semibold ${cls.text}`}>
                {s.persentase.toFixed(0)}% ({s.jmlBenar}/{s.jmlSoal})
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${cls.bar}`}
                style={{ width: `${Math.max(3, Math.min(100, s.persentase))}%` }}
              />
            </div>
          </div>
        );
      })}
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-600" /> Baik (≥70%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-600" /> Cukup (50-69%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-600" /> Perlu latihan (&lt;50%)
        </span>
      </div>
    </div>
  );
}
