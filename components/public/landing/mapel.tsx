"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/reveal";

type Jenjang = "SD" | "SMP";
type Filter = "Semua" | Jenjang;

const strokeProps = { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/**
 * Kompas - dipilih mewakili Matematika (mengukur, menggambar bangun
 * geometri). Sengaja satu kaki lurus & satu kaki bersiku (mirip kompas
 * gambar sungguhan, dengan kaki-kaki kecil di ujung bawah) supaya tidak
 * terbaca seperti huruf "A" di ukuran kecil.
 */
function IconKompas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx="12" cy="4.2" r="1.3" {...strokeProps} />
      <path d="M12 5.5 7 19.5M12 5.5l2.5 5.5L17 19.5" {...strokeProps} />
      <path d="M6.2 19.5h1.6M16.2 19.5h1.6" {...strokeProps} />
    </svg>
  );
}

/** Buku terbuka - dipilih mewakili Bahasa Indonesia (membaca, sastra). */
function IconBuku() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M12 6c-2-1.4-4.6-2-7-1.7v13.4c2.4-.3 5 .3 7 1.7 2-1.4 4.6-2 7-1.7V4.3c-2.4-.3-5 .3-7 1.7Z"
        {...strokeProps}
      />
      <path d="M12 6v13.4" {...strokeProps} />
    </svg>
  );
}

/** Atom - dipilih mewakili IPA (sains). Dua orbit (bukan tiga) supaya tidak terlihat seperti roda gigi di ukuran kecil. */
function IconAtom() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="9" ry="4" stroke="currentColor" strokeWidth={1.5} />
      <ellipse cx="12" cy="12" rx="9" ry="4" stroke="currentColor" strokeWidth={1.5} transform="rotate(90 12 12)" />
    </svg>
  );
}

/** Balon percakapan - dipilih mewakili Bahasa Inggris (percakapan, kosakata). */
function IconPercakapan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6.5L8 18.5V15H6a2 2 0 0 1-2-2V6Z"
        {...strokeProps}
      />
      <path d="M8 8h8M8 11h5" {...strokeProps} />
    </svg>
  );
}

const MAPEL: { icon: () => React.JSX.Element; nama: string; jenjang: Jenjang[]; deskripsi: string }[] = [
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
      <Reveal className="mb-8 max-w-2xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
          Mata pelajaran
        </p>
        <h2 className="mt-2 text-3xl font-bold text-balance text-slate-900">
          Disusun per jenjang, bukan satu paket untuk semua
        </h2>
      </Reveal>
      <Reveal delay={60} className="mb-8 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              f === filter
                ? "rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-400"
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
                    className="rounded-full border border-slate-200 px-2 py-0.5 font-mono text-[0.65rem] text-slate-400"
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
