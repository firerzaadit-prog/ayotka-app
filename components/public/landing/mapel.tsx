"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/reveal";
import { IconKompas, IconBuku, IconAtom, IconPercakapan } from "@/components/icons/mapel-icons";

type Jenjang = "SD" | "SMP";
type Filter = "Semua" | Jenjang;

const MAPEL: {
  icon: (props: { className?: string }) => React.JSX.Element;
  nama: string;
  jenjang: Jenjang[];
  deskripsi: string;
}[] = [
  {
    icon: IconKompas,
    nama: "Matematika",
    jenjang: ["SD", "SMP"],
    deskripsi: "Berisi soal dengan materi Bilangan, Aljabar, Geometri, Pengukuran, Data, dan Peluang.",
  },
  {
    icon: IconBuku,
    nama: "Bahasa Indonesia",
    jenjang: ["SD", "SMP"],
    deskripsi: "Pemahaman tekstual, pemahaman inferensial, evaluasi, dan apresiasi.",
  },
  {
    icon: IconAtom,
    nama: "IPA",
    jenjang: ["SMP"],
    deskripsi: "Konsep sains dasar sesuai jenjang SMP.",
  },
  {
    icon: IconPercakapan,
    nama: "Bahasa Inggris",
    jenjang: ["SMP"],
    deskripsi: "Vocabulary, grammar, dan reading comprehension.",
  },
];

const FILTERS: Filter[] = ["Semua", "SD", "SMP"];

export function Mapel() {
  const [filter, setFilter] = useState<Filter>("Semua");
  const daftar = MAPEL.filter((m) => filter === "Semua" || m.jenjang.includes(filter));

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <Reveal className="mb-6 max-w-2xl">
          <h2 className="font-card-serif text-3xl font-semibold text-balance text-card-ink">
            Disusun per jenjang, bukan satu paket untuk semua
          </h2>
        </Reveal>
        <Reveal delay={60} className="mb-6 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={
                f === filter
                  ? "border border-card-ink bg-card-ink px-4 py-1.5 font-card-mono text-xs uppercase tracking-wide text-card-paper"
                  : "border border-card-ink/25 px-4 py-1.5 font-card-mono text-xs uppercase tracking-wide text-card-ink/60 transition-colors hover:border-card-ink/50"
              }
            >
              {f}
            </button>
          ))}
        </Reveal>
        <div className="border border-card-ink/15 bg-white">
          {daftar.map((m, i) => (
            <div
              key={m.nama}
              className={`flex gap-5 px-5 py-5 sm:px-8 ${i > 0 ? "border-t border-card-ink/10" : ""}`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-card-ink/20 text-card-ink">
                <m.icon />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-card text-base font-semibold text-card-ink">{m.nama}</h3>
                  <div className="flex gap-1">
                    {m.jenjang.map((j) => (
                      <span
                        key={j}
                        className="border border-card-ink/20 px-1.5 py-0.5 font-card-mono text-[0.65rem] text-card-ink/55"
                      >
                        {j}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="mt-1.5 font-card text-sm text-card-ink/65">{m.deskripsi}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
