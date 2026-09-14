import { Reveal } from "@/components/ui/reveal";

const LANGKAH = [
  {
    judul: "Kerjakan tryout",
    deskripsi: "Jumlah soal, waktu, dan tingkat kesulitan mengikuti format TKA sesuai jenjangnya.",
  },
  {
    judul: "Jawaban dipetakan",
    deskripsi: "Tiap soal berisi jenis materinya, jadi sistem tahu letak kesalahan ada di materi mana.",
  },
  {
    judul: "Kelebihan, kelemahan & rekomendasi",
    deskripsi: "Dapat analisis kelebihan, kekurangan, dan rekomendasi belajar setelah mengerjakan TKA.",
  },
];

export function CaraKerja() {
  return (
    <section id="cara-kerja" className="scroll-mt-24 bg-slate-50/70 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Cara kerja
          </p>
          <h2 className="mt-2 text-3xl font-bold text-balance text-slate-900">
            Tiga langkah, dari mengerjakan TKA hingga tahu rekomendasi belajarnya
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {LANGKAH.map((l, i) => (
            <Reveal key={l.judul} delay={i * 80}>
              <div className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 font-mono text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{l.judul}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{l.deskripsi}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
