import { Reveal } from "@/components/ui/reveal";

const KOMPETENSI = [
  { label: "Bilangan", nilai: 84, warna: "bg-emerald-500" },
  { label: "Pengukuran", nilai: 70, warna: "bg-emerald-500" },
  { label: "Aljabar & Pola", nilai: 64, warna: "bg-amber-500" },
  { label: "Geometri", nilai: 36, warna: "bg-rose-500" },
  { label: "Pengolahan Data", nilai: 86, warna: "bg-emerald-500" },
];

/** Tiket homepage: pratinjau produk nyata untuk Learning Analytics - contoh rapor lengkap, bukan cuma diklaim lewat teks. */
export function Analitik() {
  return (
    <section className="bg-slate-50/70 px-6 py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
        <Reveal>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Learning analytics
          </p>
          <h2 className="mt-2 text-3xl font-bold text-balance text-slate-900">
            Bukan hanya nilai akhir — AyoTKA juga memberikan kelebihan, kekurangan &amp; rekomendasi
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Tiap tryout menghasilkan peta kompetensi per materi, lengkap dengan kelebihan, kekurangan,
            dan rekomendasi materi — supaya siswa tahu mana yang kurang dan perlu ditingkatkan.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                Contoh rapor — Bilal, Kelas 6
              </p>
              <p className="mt-0.5 text-sm text-slate-500">Tryout Matematika, percobaan ke-3 · 8 September</p>
            </div>
            <div className="px-6 py-5">
              <div className="flex flex-col gap-4">
                {KOMPETENSI.map((k) => (
                  <div key={k.label}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="text-slate-700">{k.label}</span>
                      <span className="font-mono text-slate-500">{k.nilai}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${k.warna}`} style={{ width: `${k.nilai}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-r-lg border-l-[3px] border-violet-400 bg-violet-50/70 px-4 py-3.5 text-sm text-slate-600">
                <strong className="text-slate-900">Catatan:</strong> dari 8 soal Geometri, 6 salah di
                soal yang melibatkan bangun ruang. Konsep dasarnya sudah dipahami, tapi soal cerita
                bangun ruang masih perlu banyak latihan.
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
