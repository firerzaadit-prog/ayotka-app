import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

type RankingRow = { peringkat: number; nama: string; skor: number; andaSendiri: boolean };
type RankingBoard = { peringkatSaya: number; totalPeserta: number; papan: RankingRow[] };

/**
 * Bagian 8/10 (permintaan user): "setiap ada try out ada ranking siswa" -
 * nama peserta ditampilkan apa adanya (keputusan user), beda dari watermark
 * rapor yang menyamarkan identitas. Dipakai di halaman hasil (per attempt)
 * MAUPUN widget dashboard (try out terakhir, dipoll berkala) - lihat
 * components/dashboard/ranking-widget.tsx.
 */
export function RankingBoardCard({
  ranking,
  title = "Ranking Try Out",
  footer,
}: {
  ranking: RankingBoard;
  title?: string;
  footer?: ReactNode;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">
          Peringkat kamu: <span className="font-semibold text-indigo-700">#{ranking.peringkatSaya}</span> dari{" "}
          {ranking.totalPeserta} peserta
        </p>
      </div>
      <div className="flex flex-col divide-y divide-slate-100">
        {ranking.papan.map((r) => (
          <div
            key={`${r.peringkat}-${r.nama}`}
            className={`flex items-center justify-between py-2 text-sm ${
              r.andaSendiri ? "-mx-3 rounded-lg bg-indigo-50 px-3 font-semibold text-indigo-700" : "text-slate-700"
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-right font-mono text-xs text-slate-400">#{r.peringkat}</span>
              {r.nama}
              {r.andaSendiri && <span className="text-xs">(kamu)</span>}
            </span>
            <span>{r.skor.toFixed(0)}</span>
          </div>
        ))}
      </div>
      {footer}
    </Card>
  );
}
