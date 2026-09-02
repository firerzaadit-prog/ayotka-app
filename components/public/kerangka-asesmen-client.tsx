"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Footer } from "@/components/public/footer";
import { PublicHeader } from "@/components/public/header";
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

export function KerangkaAsesmenClient() {
  const [jenjang, setJenjang] = useState<Jenjang>("SD");
  const [mapel, setMapel] = useState<MataPelajaran>("matematika");
  const [tab, setTab] = useState<Tab>("definisi");

  const content = KERANGKA_ASESMEN[jenjang][mapel];

  return (
    <main className="min-h-screen bg-white">
      <PublicHeader active="/kerangka-asesmen" />

      <section className="mx-auto max-w-3xl px-6 pb-4 pt-20 text-center sm:pt-24">
        <Reveal className="mx-auto mb-6 flex h-12 w-12 items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
              <path
                d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-indigo-600">Panduan Resmi</p>
        </Reveal>
        <Reveal delay={200}>
          <h1 className="mt-3 text-4xl font-bold text-balance text-slate-900">Kerangka Asesmen TKA</h1>
        </Reveal>
        <Reveal delay={300}>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
            Cakupan materi dan kompetensi yang diujikan pada Tes Kemampuan Akademik, disusun berdasarkan
            kerangka resmi Pusat Asesmen Pendidikan, Kementerian Pendidikan Dasar dan Menengah RI.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="flex flex-col items-center gap-5 border-b border-slate-100 pb-10 pt-8">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
            {(["SD", "SMP"] as const).map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setJenjang(j)}
                className={cn(
                  "rounded-full px-6 py-1.5 text-sm font-medium transition-colors",
                  jenjang === j ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
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
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  mapel === m
                    ? "border-transparent bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                {MAPEL_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 flex gap-1 overflow-x-auto border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "shrink-0 border-b-2 px-5 py-3 text-sm font-medium transition-colors",
                tab === t
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700",
              )}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        <Reveal key={tab} className="mt-10">
          {tab === "definisi" && (
            <p className="text-base leading-relaxed text-slate-700">{content.definisi}</p>
          )}

          {tab === "muatan" && content.mapel === "Matematika" && (
            <div className="flex flex-col gap-4 text-base leading-relaxed text-slate-700">
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
            <div className="flex flex-col gap-4 text-base leading-relaxed text-slate-700">
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
            <div className="flex flex-col gap-4 text-base leading-relaxed text-slate-700">
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
              <p className="text-base leading-relaxed text-slate-700">{content.kompetensi.intro}</p>
              {content.kompetensi.level.map((lvl) => (
                <div key={lvl.label} className="rounded-xl border border-slate-200 p-6">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 px-3 py-1 text-xs font-semibold text-white">
                      {lvl.label}
                    </span>
                    <span className="font-semibold text-slate-900">{lvl.nama}</span>
                  </div>
                  <dl className="flex flex-col gap-3">
                    {lvl.proses.map((p) => (
                      <div key={p.nama}>
                        <dt className="text-sm font-semibold text-slate-800">{p.nama}</dt>
                        <dd className="mt-0.5 text-sm leading-relaxed text-slate-600">{p.deskripsi}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}

          {tab === "kompetensi" && content.mapel === "Bahasa Indonesia" && (
            <div className="flex flex-col gap-6">
              <div className="text-base leading-relaxed text-slate-700">
                <p>{content.kompetensi.aspekIntro}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {content.kompetensi.aspek.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
              <p className="text-base leading-relaxed text-slate-700">{content.kompetensi.kelompokIntro}</p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                {content.kompetensi.kelompok.map((k) => (
                  <div key={k.label} className="rounded-xl border border-slate-200 p-5">
                    <p className="font-semibold text-slate-900">{k.label}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{k.deskripsi}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "matriks" && content.mapel === "Matematika" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">Elemen</th>
                    <th className="px-5 py-3.5 font-medium">Sub-elemen</th>
                    <th className="px-5 py-3.5 font-medium">Kompetensi</th>
                    <th className="px-5 py-3.5 font-medium">Batasan</th>
                  </tr>
                </thead>
                <tbody>
                  {content.matriks.map((row, i) => (
                    <tr
                      key={`${row.elemen}-${row.subElemen}-${i}`}
                      className="border-b border-slate-100 align-top last:border-0"
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-900">{row.elemen}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-700">{row.subElemen}</td>
                      <td className="px-5 py-3.5 text-slate-600">
                        <p>{row.kompetensiIntro}</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                          {row.poin.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{row.batasan ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "matriks" && content.mapel === "Bahasa Indonesia" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">Kompetensi</th>
                    <th className="px-5 py-3.5 font-medium">Subkompetensi</th>
                  </tr>
                </thead>
                <tbody>
                  {content.matriks.map((row) => (
                    <tr key={row.kompetensi} className="border-b border-slate-100 align-top last:border-0">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{row.kompetensi}</td>
                      <td className="px-5 py-3.5 text-slate-600">
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
            </div>
          )}
        </Reveal>

        <p className="mt-14 text-center text-xs text-slate-400">
          Sumber: Kementerian Pendidikan Dasar dan Menengah Republik Indonesia — Pusat Asesmen Pendidikan.{" "}
          <a
            href={SUMBER_URL[jenjang]}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate-600"
          >
            Lihat kerangka lengkap
          </a>
        </p>
      </section>

      <Footer />
    </main>
  );
}
