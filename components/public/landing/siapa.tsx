import { Reveal } from "@/components/ui/reveal";

const AUDIENS = [
  {
    inisial: "S",
    judul: "Siswa",
    deskripsi:
      "Tahu persis harus belajar apa hari ini — tidak lagi buka semua bab, cukup yang memang perlu dilatih.",
  },
  {
    inisial: "G",
    judul: "Guru & Sekolah",
    deskripsi:
      "Satu layar untuk satu kelas — langsung kelihatan siswa mana yang lemah di bagian mana, jadi tahu apa yang perlu dibahas bareng.",
  },
];

export function Siapa() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <Reveal className="mx-auto mb-12 max-w-xl text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
          Siapa yang pakai
        </p>
        <h2 className="mt-2 text-3xl font-bold text-balance text-slate-900">
          Dua orang melihat layar yang berbeda
        </h2>
      </Reveal>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {AUDIENS.map((a, i) => (
          <Reveal key={a.judul} delay={i * 80}>
            <div className="h-full rounded-2xl border border-slate-200 bg-white p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-base font-bold text-white">
                {a.inisial}
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{a.judul}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{a.deskripsi}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
