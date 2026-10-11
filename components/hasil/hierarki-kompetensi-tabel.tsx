import { formatScoreBadge } from "@/components/hasil/daya-serap-indikator";
import type { BarisHierarkiKompetensi } from "@/lib/exam/hierarki-kompetensi";

/**
 * Peta Kompetensi bentuk hierarki di rapor siswa - satu bahasa visual dengan tabel hierarki di Analitik Admin Sekolah dan
 * dengan tabel daya serap per indikator: Elemen > Subelemen > Kompetensi, tiap simpul dengan skor berwarna (ambang sama
 * dengan grafik lama: Baik >= 70%, Cukup 50-69%, Perlu latihan < 50%) dan jumlah benar dari soalnya. Data berasal dari
 * competency_scores sehingga tampil untuk SEMUA percobaan, termasuk soal lama yang belum tertaut ke indikator resmi.
 *
 * Hanya dua kolom (jumlah benar/soal di bawah lencana skor) karena kartu rapor sempit - dengan kolom ketiga kalimat
 * kompetensi yang panjang terbungkus sampai belasan baris, terutama di ponsel.
 */
export function HierarkiKompetensiTabel({ baris }: { baris: BarisHierarkiKompetensi[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-xs font-bold text-slate-700">
                <th scope="col" className="px-3 py-3 font-bold uppercase tracking-wider sm:px-4">
                  Hierarki
                </th>
                <th
                  scope="col"
                  className="w-24 min-w-[5.5rem] border-l border-indigo-100 bg-indigo-50/70 px-3 py-3 text-right font-bold uppercase tracking-wider text-indigo-900"
                >
                  Skor kamu
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {baris.map((b) => {
                const gaya =
                  b.level === 1
                    ? "border-b border-slate-200 bg-slate-50/90 font-bold text-slate-900"
                    : b.level === 2
                      ? "border-b border-slate-100 bg-white font-semibold text-slate-800 hover:bg-slate-50/40"
                      : "border-b border-slate-100 bg-white font-normal text-slate-600 hover:bg-slate-50/40";
                const indentasi = b.level === 1 ? "pl-3 sm:pl-4" : b.level === 2 ? "pl-6 sm:pl-8" : "pl-9 sm:pl-12";
                return (
                  <tr key={b.id} className={`transition-colors ${gaya}`} data-level={b.level}>
                    <td className={`py-2.5 pr-3 ${indentasi} ${b.level === 3 ? "text-[11.5px] leading-snug" : "text-xs leading-relaxed"}`}>
                      {b.level === 1 ? (
                        <span className="text-sm font-bold text-slate-900">
                          {b.nomor}. {b.teks}
                        </span>
                      ) : (
                        <span>› {b.teks}</span>
                      )}
                    </td>
                    <td className="border-l border-slate-100 bg-indigo-50/20 px-3 py-2.5 text-right align-top font-mono text-xs">
                      <div className="flex flex-col items-end gap-0.5">
                        {formatScoreBadge(b.persentase, 0)}
                        {b.jmlSoal > 0 && (
                          <span className="whitespace-nowrap text-[10px] font-normal text-slate-500">
                            {b.jmlBenar}/{b.jmlSoal} benar
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
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
