import { Reveal } from "@/components/ui/reveal";
import { ExamNumber } from "@/components/public/landing/kit";

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

/** Bukan dua kartu ikon terpisah - satu manifes/daftar bergaya dokumen resmi, dua baris. */
export function Siapa() {
  return (
    <section className="card-paper-texture px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <Reveal className="mx-auto mb-10 max-w-xl text-center">
          <h2 className="font-card-serif text-3xl font-semibold text-balance text-card-ink">
            Dua orang melihat layar yang berbeda
          </h2>
        </Reveal>
        <div className="border border-card-ink/15 bg-white">
          {AUDIENS.map((a, i) => (
            <Reveal key={a.judul} delay={i * 80}>
              <div
                className={`flex items-start gap-5 px-5 py-6 sm:px-8 ${i > 0 ? "border-t border-card-ink/10" : ""}`}
              >
                <ExamNumber className="w-6 shrink-0 pt-0.5 text-sm text-card-ink/35">
                  {String(i + 1).padStart(2, "0")}
                </ExamNumber>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-card-ink/20 text-card-ink">
                  <a.icon />
                </span>
                <div>
                  <h3 className="font-card text-base font-semibold text-card-ink">{a.judul}</h3>
                  <p className="mt-1.5 font-card text-sm leading-relaxed text-card-ink/65">{a.deskripsi}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
