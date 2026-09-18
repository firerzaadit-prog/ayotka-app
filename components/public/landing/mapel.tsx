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
    <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <Reveal className="mx-auto mb-8 max-w-2xl text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
          Mata pelajaran
        </p>
        <h2 className="mt-2 text-3xl font-bold text-balance text-slate-900">
          Disusun per jenjang, bukan satu paket untuk semua
        </h2>
      </Reveal>
      <Reveal delay={60} className="mb-8 flex justify-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              f === filter
                ? "rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20"
                : "rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
            }
          >
            {f}
          </button>
        ))}
      </Reveal>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {daftar.map((m) => (
          <div
            key={m.nama}
            className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <m.icon />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">{m.nama}</h3>
              <div className="mt-1 flex gap-1.5">
                {m.jenjang.map((j) => (
                  <span
                    key={j}
                    className="rounded-full border border-slate-200 px-2 py-0.5 font-mono text-[0.65rem] text-slate-500"
                  >
                    {j}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-sm text-slate-600">{m.deskripsi}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
