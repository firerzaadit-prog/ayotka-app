import { Reveal } from "@/components/ui/reveal";

const BARIS = [
  { aspek: "Soal sesuai kerangka asesmen resmi Kemendikdasmen", simulasi: true, ayotka: true },
  { aspek: "Format soal sama dengan Tes Kemampuan Akademik", simulasi: true, ayotka: true },
  { aspek: "Ada rincian per materi, bukan cuma nilai akhir", simulasi: false, ayotka: true },
  { aspek: "Riwayat percobaan tersimpan", simulasi: false, ayotka: true },
  { aspek: "Rekomendasi materi lanjutan otomatis", simulasi: false, ayotka: true },
  { aspek: "Guru/sekolah bisa memantau satu kelas sekaligus", simulasi: false, ayotka: true },
];

function Tanda({ ada }: { ada: boolean }) {
  return ada ? (
    <span className="text-emerald-600" aria-label="Ada">✓</span>
  ) : (
    <span className="text-slate-300" aria-label="Tidak ada">–</span>
  );
}

export function Beda() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <Reveal className="mx-auto mb-12 max-w-2xl text-center">
        <h2 className="text-3xl font-bold text-balance text-slate-900">
          Apa kelebihan platform AyoTKA?
        </h2>
      </Reveal>
      <Reveal>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-5 py-3.5 font-mono text-xs font-medium uppercase tracking-wide text-slate-400">
                  Aspek
                </th>
                <th className="px-5 py-3.5 text-center font-mono text-xs font-medium uppercase tracking-wide text-slate-400">
                  Simulasi Kemendikdasmen
                </th>
                <th className="px-5 py-3.5 text-center font-mono text-xs font-medium uppercase tracking-wide text-indigo-600">
                  AyoTKA
                </th>
              </tr>
            </thead>
            <tbody>
              {BARIS.map((b) => (
                <tr key={b.aspek} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3.5 text-slate-700">{b.aspek}</td>
                  <td className="px-5 py-3.5 text-center">
                    <Tanda ada={b.simulasi} />
                  </td>
                  <td className="bg-indigo-50/50 px-5 py-3.5 text-center">
                    <Tanda ada={b.ayotka} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </section>
  );
}
