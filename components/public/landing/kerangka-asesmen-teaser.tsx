"use client";

import { useState } from "react";
import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { KERANGKA_ASESMEN, type Jenjang, type MataPelajaran } from "@/lib/content/kerangka-asesmen";
import { KartuFrame, FieldLabel } from "@/components/public/landing/kit";

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
          ? "border border-card-ink bg-card-ink px-3.5 py-1.5 font-card-mono text-xs uppercase tracking-wide text-card-paper"
          : "border border-card-ink/25 px-3.5 py-1.5 font-card-mono text-xs uppercase tracking-wide text-card-ink/55 transition-colors hover:border-card-ink/50"
      }
    >
      {children}
    </button>
  );
}

/**
 * Cuma cuplikan/teaser (definisi tiap kombinasi jenjang & mapel) yang
 * mengarahkan ke halaman /kerangka-asesmen yang sudah lengkap (muatan,
 * kompetensi, matriks asesmen penuh) - sumber datanya sama persis dengan
 * halaman itu (lib/content/kerangka-asesmen.ts) supaya tidak ada isi yang
 * beda sendiri/basi di sini.
 */
export function KerangkaAsesmenTeaser() {
  const [jenjang, setJenjang] = useState<Jenjang>("SD");
  const [mapel, setMapel] = useState<MataPelajaran>("matematika");
  const definisi = KERANGKA_ASESMEN[jenjang][mapel].definisi;

  return (
    <section className="card-paper-texture px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <h2 className="font-card-serif text-3xl font-semibold text-balance text-card-ink">
            Kerangka Asesmen TKA
          </h2>
          <p className="mx-auto mt-3 max-w-2xl font-card text-base leading-relaxed text-card-ink/65">
            Cakupan materi dan kompetensi yang diujikan pada Tes Kemampuan Akademik, disusun
            berdasarkan kerangka resmi Pusat Asesmen Pendidikan, Kementerian Pendidikan Dasar dan
            Menengah RI.
          </p>
        </Reveal>

        <Reveal delay={100}>
          <KartuFrame className="mx-auto mt-8 max-w-2xl bg-white p-6 text-left sm:p-8">
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
            <p className="mt-5 border-t border-card-ink/10 pt-5 font-card text-sm leading-relaxed text-card-ink/70">
              {definisi}
            </p>
            <FieldLabel className="mt-4 block normal-case tracking-normal text-card-ink/45">
              Sumber: Kementerian Pendidikan Dasar dan Menengah Republik Indonesia — Pusat Asesmen
              Pendidikan.
            </FieldLabel>
          </KartuFrame>
        </Reveal>

        <Reveal delay={150}>
          <Link
            href="/kerangka-asesmen"
            className="mt-8 inline-block border border-card-ink/30 bg-white px-6 py-3 font-card text-sm font-semibold text-card-ink transition-colors hover:border-card-ink/60"
          >
            Lihat kerangka lengkap SD &amp; SMP →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
