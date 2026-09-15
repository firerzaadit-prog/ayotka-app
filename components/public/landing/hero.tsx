import Link from "next/link";
import { Globe, Phone } from "lucide-react";

const KOMPETENSI = [
  { label: "Bilangan", nilai: 84, warna: "bg-emerald-500" },
  { label: "Aljabar & Pola", nilai: 64, warna: "bg-amber-500" },
  { label: "Geometri", nilai: 36, warna: "bg-rose-500" },
];

/**
 * Hero baru (menggantikan HeroSection foto split-screen) - panel kanan
 * sengaja bukan foto, tapi pratinjau produk nyata (kartu hasil tryout +
 * peta kompetensi), supaya pembeda utama AyoTKA (learning analytics per
 * materi, bukan cuma skor akhir) langsung kelihatan wujudnya, bukan cuma
 * diklaim lewat teks.
 */
export function Hero() {
  return (
    <section className="bg-[#B5C8F4]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-24">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            AyoTKA.id — Tes Kemampuan Akademik SD &amp; SMP
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-balance text-slate-900 sm:text-5xl">
            Nilai Tes Kemampuan Akademik 68. Tapi kelebihan &amp; kelemahan materi di sebelah mana?
          </h1>
          <div className="my-6 h-1.5 w-24 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600" />
          <p className="max-w-lg text-base leading-relaxed text-slate-600">
            Tidak hanya menunjukkan skor akhir saja. AyoTKA memberikan tiap hasil tryout jadi peta
            kompetensi per materi lewat sistem learning analytics, supaya jelas materi mana yang
            perlu dilatih lagi — bukan cuma angka di akhir.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/registrasi"
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-black px-6 py-3 text-center text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-all hover:scale-[1.02] hover:shadow-md hover:shadow-indigo-600/30"
            >
              Daftar sebagai siswa
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-center text-sm font-medium text-slate-700 shadow-sm transition-all hover:scale-[1.02] hover:border-slate-300 hover:bg-slate-50"
            >
              Masuk ke akunmu
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
              <span>ayotka.id</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
              <span>(0341) 551312</span>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <div className="flex gap-1.5 border-b border-slate-100 px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-violet-400" />
            <span className="h-2 w-2 rounded-full bg-slate-200" />
            <span className="h-2 w-2 rounded-full bg-slate-200" />
          </div>
          <div className="px-6 py-5">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[0.65rem] tracking-wide text-slate-500">HASIL TRYOUT</span>
              <span className="text-sm font-semibold text-slate-900">Matematika</span>
            </div>
            <p className="mt-1 text-4xl font-extrabold text-slate-900">
              68<span className="text-base font-medium text-slate-400">/100</span>
            </p>
            <div className="mt-5 flex flex-col gap-4">
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
            <Link
              href="/registrasi"
              className="mt-5 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Lihat peta lengkap →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
