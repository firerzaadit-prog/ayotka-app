"use client";

import { useState } from "react";
import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { KERANGKA_ASESMEN, type Jenjang, type MataPelajaran } from "@/lib/content/kerangka-asesmen";

const MAPEL_LABEL: Record<MataPelajaran, string> = {
  matematika: "Matematika",
  "bahasa-indonesia": "Bahasa Indonesia",
};

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white"
          : "rounded-full border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-400"
      }
    >
      {children}
    </button>
  );
}

export function KerangkaAsesmenTeaser() {
  const [jenjang, setJenjang] = useState<Jenjang>("SD");
  const [mapel, setMapel] = useState<MataPelajaran>("matematika");
  const definisi = KERANGKA_ASESMEN[jenjang][mapel].definisi;

  return (
    <section className="bg-slate-50/70 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Panduan resmi
          </p>
          <h2 className="mt-2 text-3xl font-bold text-balance text-slate-900">
            Kerangka Asesmen TKA
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            Cakupan materi dan kompetensi yang diujikan pada Tes Kemampuan Akademik, disusun
            berdasarkan kerangka resmi Pusat Asesmen Pendidikan, Kementerian Pendidikan Dasar dan
            Menengah RI.
          </p>
        </Reveal>

        <Reveal delay={100}>
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 text-left sm:p-8">
            <div className="flex flex-wrap gap-2">
              <PillButton active={jenjang === "SD"} onClick={() => setJenjang("SD")}>
                SD
              </PillButton>
              <PillButton active={jenjang === "SMP"} onClick={() => setJenjang("SMP")}>
                SMP
              </PillButton>
              <div className="ml-auto flex flex-wrap gap-2">
                <PillButton active={mapel === "matematika"} onClick={() => setMapel("matematika")}>
                  {MAPEL_LABEL.matematika}
                </PillButton>
                <PillButton
                  active={mapel === "bahasa-indonesia"}
                  onClick={() => setMapel("bahasa-indonesia")}
                >
                  {MAPEL_LABEL["bahasa-indonesia"]}
                </PillButton>
              </div>
            </div>
            <p className="mt-5 border-t border-slate-100 pt-5 text-sm leading-relaxed text-slate-600">
              {definisi}
            </p>
            <p className="mt-4 text-xs text-slate-500">
              Sumber: Kementerian Pendidikan Dasar dan Menengah Republik Indonesia — Pusat Asesmen
              Pendidikan.
            </p>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <Link
            href="/kerangka-asesmen"
            className="mt-8 inline-block rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
          >
            Lihat kerangka lengkap SD &amp; SMP →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
