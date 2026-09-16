"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Reveal } from "@/components/ui/reveal";
import { Footer } from "@/components/public/footer";
import { PublicHeader } from "@/components/public/header";
import { KartuFrame, FieldLabel, ExamNumber } from "@/components/public/landing/kit";
import {
  KERANGKA_ASESMEN,
  SUMBER_URL,
  type Jenjang,
  type MataPelajaran,
} from "@/lib/content/kerangka-asesmen";

const TABS = ["definisi", "muatan", "kompetensi", "matriks"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  definisi: "Definisi",
  muatan: "Muatan",
  kompetensi: "Kompetensi",
  matriks: "Matriks Asesmen",
};

const MAPEL_LABEL: Record<MataPelajaran, string> = {
  matematika: "Matematika",
  "bahasa-indonesia": "Bahasa Indonesia",
};

/**
 * Identitas "Kartu Peserta Ujian" (sama dengan homepage - lihat DESIGN.md),
 * diterapkan dengan tekanan lebih pada keterbacaan karena halaman ini mode
 * Read (dokumentasi), bukan Persuade: Domine cuma untuk H1, sisanya Public
 * Sans supaya daftar/tabel panjang tetap nyaman dibaca.
 */
export function KerangkaAsesmenClient() {
  const [jenjang, setJenjang] = useState<Jenjang>("SD");
  const [mapel, setMapel] = useState<MataPelajaran>("matematika");
  const [tab, setTab] = useState<Tab>("definisi");

  const content = KERANGKA_ASESMEN[jenjang][mapel];

  return (
    <main className="min-h-screen bg-card-paper font-card text-card-ink">
      <PublicHeader active="/kerangka-asesmen" />

      <section className="card-paper-texture px-4 pb-6 pt-16 text-center sm:px-6 sm:pt-20">
        <Reveal>
          <FieldLabel>Panduan Resmi &middot; Kemendikdasmen</FieldLabel>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="mt-3 font-card-serif text-4xl font-semibold text-balance text-card-ink">
            Kerangka Asesmen TKA
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="mx-auto mt-4 max-w-2xl font-card text-base leading-relaxed text-card-ink/65">
            Cakupan materi dan kompetensi yang diujikan pada Tes Kemampuan Akademik, disusun berdasarkan
            kerangka resmi Pusat Asesmen Pendidikan, Kementerian Pendidikan Dasar dan Menengah RI.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        <div className="flex flex-col items-center gap-5 border-b border-card-ink/15 pb-10 pt-8">
          <div className="inline-flex border border-card-ink/25">
            {(["SD", "SMP"] as const).map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setJenjang(j)}
                className={cn(
                  "px-6 py-1.5 font-card-mono text-sm uppercase tracking-wide transition-colors",
                  jenjang === j ? "bg-card-ink text-card-paper" : "text-card-ink/55 hover:text-card-ink",
                )}
              >
                {j}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {(["matematika", "bahasa-indonesia"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMapel(m)}
                className={cn(
                  "border px-4 py-2 font-card text-sm font-medium transition-colors",
                  mapel === m
                    ? "border-card-ink bg-card-ink text-card-paper"
                    : "border-card-ink/25 text-card-ink/65 hover:border-card-ink/50",
                )}
              >
                {MAPEL_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 flex gap-1 overflow-x-auto border-b border-card-ink/15">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "shrink-0 border-b-2 px-5 py-3 font-card text-sm font-medium transition-colors",
                tab === t ? "border-card-ink text-card-ink" : "border-transparent text-card-ink/50 hover:text-card-ink/80",
              )}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        <Reveal key={tab} className="mt-10">
          {tab === "definisi" && (
            <p className="font-card text-base leading-relaxed text-card-ink/75">{content.definisi}</p>
          )}

          {tab === "muatan" && content.mapel === "Matematika" && (
            <div className="flex flex-col gap-4 font-card text-base leading-relaxed text-card-ink/75">
              <p>{content.muatan.intro}</p>
              <ul className="list-disc space-y-1 pl-5">
                {content.muatan.elemen.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <p>{content.muatan.outro}</p>
            </div>
          )}

          {tab === "muatan" && content.mapel === "Bahasa Indonesia" && (
            <div className="flex flex-col gap-4 font-card text-base leading-relaxed text-card-ink/75">
              <p>{content.muatan.intro}</p>
              <ul className="list-disc space-y-2 pl-5">
                {content.muatan.jenisTeks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p>{content.muatan.karakteristikIntro}</p>
              <ul className="list-disc space-y-2 pl-5">
                {content.muatan.karakteristik.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </div>
          )}

          {tab === "kompetensi" && content.mapel === "Matematika" && content.kompetensi.bentuk === "daftar" && (
            <div className="flex flex-col gap-4 font-card text-base leading-relaxed text-card-ink/75">
              <p>{content.kompetensi.intro}</p>
              <ul className="list-disc space-y-1 pl-5">
                {content.kompetensi.poin.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {tab === "kompetensi" && content.mapel === "Matematika" && content.kompetensi.bentuk === "level" && (
            <div className="flex flex-col gap-7">
              <p className="font-card text-base leading-relaxed text-card-ink/75">{content.kompetensi.intro}</p>
              {content.kompetensi.level.map((lvl) => (
                <KartuFrame key={lvl.label} className="bg-white p-6">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <ExamNumber className="border border-card-ink/25 px-2.5 py-1 text-xs uppercase tracking-wide">
                      {lvl.label}
                    </ExamNumber>
                    <span className="font-card text-base font-semibold text-card-ink">{lvl.nama}</span>
                  </div>
                  <dl className="flex flex-col gap-3">
                    {lvl.proses.map((p) => (
                      <div key={p.nama}>
                        <dt className="font-card text-sm font-semibold text-card-ink/85">{p.nama}</dt>
                        <dd className="mt-0.5 font-card text-sm leading-relaxed text-card-ink/65">{p.deskripsi}</dd>
                      </div>
                    ))}
                  </dl>
                </KartuFrame>
              ))}
            </div>
          )}

          {tab === "kompetensi" && content.mapel === "Bahasa Indonesia" && (
            <div className="flex flex-col gap-6">
              <div className="font-card text-base leading-relaxed text-card-ink/75">
                <p>{content.kompetensi.aspekIntro}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {content.kompetensi.aspek.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
              <p className="font-card text-base leading-relaxed text-card-ink/75">{content.kompetensi.kelompokIntro}</p>
              <div className="border border-card-ink/15 bg-white sm:grid sm:grid-cols-3">
                {content.kompetensi.kelompok.map((k, i) => (
                  <div
                    key={k.label}
                    className={cn(
                      "p-5",
                      i > 0 && "border-t border-card-ink/10 sm:border-l sm:border-t-0",
                    )}
                  >
                    <p className="font-card text-sm font-semibold text-card-ink">{k.label}</p>
                    <p className="mt-2 font-card text-sm leading-relaxed text-card-ink/65">{k.deskripsi}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "matriks" && content.mapel === "Matematika" && (
            <KartuFrame className="overflow-x-auto bg-white">
              <table className="w-full text-left font-card text-sm">
                <thead className="border-b border-card-ink/15">
                  <tr>
                    <th className="px-5 py-3.5">
                      <FieldLabel>Elemen</FieldLabel>
                    </th>
                    <th className="px-5 py-3.5">
                      <FieldLabel>Sub-elemen</FieldLabel>
                    </th>
                    <th className="px-5 py-3.5">
                      <FieldLabel>Kompetensi</FieldLabel>
                    </th>
                    <th className="px-5 py-3.5">
                      <FieldLabel>Batasan</FieldLabel>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {content.matriks.map((row, i) => (
                    <tr
                      key={`${row.elemen}-${row.subElemen}-${i}`}
                      className="border-b border-card-ink/10 align-top last:border-0"
                    >
                      <td className="px-5 py-3.5 font-medium text-card-ink">{row.elemen}</td>
                      <td className="px-5 py-3.5 font-medium text-card-ink/80">{row.subElemen}</td>
                      <td className="px-5 py-3.5 text-card-ink/70">
                        <p>{row.kompetensiIntro}</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                          {row.poin.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-5 py-3.5 text-card-ink/50">{row.batasan ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </KartuFrame>
          )}

          {tab === "matriks" && content.mapel === "Bahasa Indonesia" && (
            <KartuFrame className="overflow-x-auto bg-white">
              <table className="w-full text-left font-card text-sm">
                <thead className="border-b border-card-ink/15">
                  <tr>
                    <th className="px-5 py-3.5">
                      <FieldLabel>Kompetensi</FieldLabel>
                    </th>
                    <th className="px-5 py-3.5">
                      <FieldLabel>Subkompetensi</FieldLabel>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {content.matriks.map((row) => (
                    <tr key={row.kompetensi} className="border-b border-card-ink/10 align-top last:border-0">
                      <td className="px-5 py-3.5 font-medium text-card-ink">{row.kompetensi}</td>
                      <td className="px-5 py-3.5 text-card-ink/70">
                        <ul className="list-disc space-y-1 pl-4">
                          {row.subkompetensi.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </KartuFrame>
          )}
        </Reveal>

        <FieldLabel className="mt-14 block text-center normal-case tracking-normal text-card-ink/45">
          Sumber: Kementerian Pendidikan Dasar dan Menengah Republik Indonesia — Pusat Asesmen Pendidikan.{" "}
          <a
            href={SUMBER_URL[jenjang]}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-card-ink/70"
          >
            Lihat kerangka lengkap
          </a>
        </FieldLabel>
      </section>

      <Footer />
    </main>
  );
}
