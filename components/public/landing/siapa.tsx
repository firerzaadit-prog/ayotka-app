import { Reveal } from "@/components/ui/reveal";

const strokeProps = { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Siswa - figur orang dengan tali ransel, mewakili murid. */
function IconSiswa() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx="12" cy="6.5" r="2.2" {...strokeProps} />
      <path d="M6.8 19v-2a5.2 5.2 0 0 1 10.4 0v2" {...strokeProps} />
      <path d="M9.6 11.2v3.2M14.4 11.2v3.2" {...strokeProps} />
    </svg>
  );
}

/** Sekolah - siluet gedung dengan menara lonceng, mewakili guru & sekolah. */
function IconSekolah() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M10.5 5V2.5h3V5M4.5 10 12 4.5 19.5 10" {...strokeProps} />
      <path d="M6 10v9.5h12V10M10.2 19.5v-4a1.8 1.8 0 0 1 3.6 0v4M8 13h1.6M14.4 13H16" {...strokeProps} />
    </svg>
  );
}

const AUDIENS: { icon: () => React.JSX.Element; judul: string; deskripsi: string }[] = [
  {
    icon: IconSiswa,
    judul: "Siswa",
    deskripsi:
      "Tahu persis harus belajar apa hari ini — tidak lagi buka semua bab, cukup yang memang perlu dilatih.",
  },
  {
    icon: IconSekolah,
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
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
                <a.icon />
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
