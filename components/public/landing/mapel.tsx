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
