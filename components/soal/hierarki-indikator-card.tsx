"use client";

import React from "react";
import { Layers } from "lucide-react";

interface HierarkiIndikatorCardProps {
  mapel: string;
  elemen?: string | null;
  subElemen?: string | null;
  kompetensi?: string | null;
  indikator?: string | null;
  indikatorResmiId?: string | null;
  className?: string;
}

export function HierarkiIndikatorCard({
  mapel,
  elemen,
  subElemen,
  kompetensi,
  indikator,
  indikatorResmiId,
  className = "",
}: HierarkiIndikatorCardProps) {
  const isBahasa =
    mapel.toLowerCase().includes("indonesia") ||
    mapel.toLowerCase().includes("inggris") ||
    mapel.toLowerCase().includes("bind") ||
    mapel.toLowerCase().includes("binp") ||
    mapel.toLowerCase().includes("abing") ||
    mapel.toLowerCase().includes("abinw");

  if (isBahasa) {
    // -------------------------------------------------------------
    // HIERARKI RESMI BAHASA (3 TINGKAT SESUAI PUSMENDIK KEMENDIKDASMEN):
    // 1. Kompetensi (Pemahaman Tekstual / Inferensial / Evaluasi dan Apresiasi)
    // 2. Subkompetensi (Cakupan kemampuan membaca)
    // 3. Indikator (Rumusan butir soal)
    // -------------------------------------------------------------
    let kompetensiName = "Pemahaman Tekstual";
    let subkompetensiName = subElemen || "–";

    const rawKompetensi = kompetensi || elemen || "";

    if (rawKompetensi.includes(":")) {
      const parts = rawKompetensi.split(":");
      kompetensiName = parts[0]!.trim();
      const subFromKom = parts.slice(1).join(":").trim();
      subkompetensiName = subFromKom || subElemen || "–";
    } else if (
      rawKompetensi.includes("Pemahaman") ||
      rawKompetensi.includes("Evaluasi")
    ) {
      kompetensiName = rawKompetensi.trim();
      subkompetensiName =
        subElemen && subElemen !== kompetensiName ? subElemen : "–";
    } else if (subElemen) {
      subkompetensiName = subElemen;
    }

    return (
      <div
        className={`rounded-2xl border border-blue-200/90 bg-blue-50/70 p-4 sm:p-5 text-xs font-sans shadow-sm ${className}`}
      >
        <div className="mb-3.5 flex items-center justify-between border-b border-blue-200/60 pb-2.5 text-sm font-bold text-blue-900">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 shrink-0 text-blue-600" />
            <span>Hierarki Indikator</span>
          </div>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
            Bahasa Indonesia (3 Tingkat)
          </span>
        </div>

        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-2">
            <span className="font-semibold text-slate-500 sm:col-span-1">
              Kompetensi:
            </span>
            <span className="font-semibold text-slate-900 sm:col-span-3">
              {kompetensiName}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-2">
            <span className="font-semibold text-slate-500 sm:col-span-1">
              Subkompetensi:
            </span>
            <span className="leading-relaxed text-slate-800 sm:col-span-3">
              {subkompetensiName}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-2">
            <span className="font-semibold text-slate-500 sm:col-span-1">
              Indikator:
            </span>
            <div className="sm:col-span-3 flex flex-wrap items-baseline gap-1.5">
              <span className="font-semibold leading-relaxed text-blue-950">
                {indikator || "–"}
              </span>
              {indikatorResmiId && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800">
                  Resmi Pusmendik
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // HIERARKI RESMI MATEMATIKA & SAINS (4 TINGKAT SESUAI PUSMENDIK):
  // 1. Elemen (Bilangan / Aljabar / Geometri / Data)
  // 2. Subelemen (Bilangan Real / Rasional / dll)
  // 3. Kompetensi (Kemampuan memahami, mengaplikasikan...)
  // 4. Indikator (Rumusan indikator soal)
  // -------------------------------------------------------------
  return (
    <div
      className={`rounded-2xl border border-blue-200/90 bg-blue-50/70 p-4 sm:p-5 text-xs font-sans shadow-sm ${className}`}
    >
      <div className="mb-3.5 flex items-center justify-between border-b border-blue-200/60 pb-2.5 text-sm font-bold text-blue-900">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 shrink-0 text-blue-600" />
          <span>Hierarki Indikator</span>
        </div>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
          Matematika (4 Tingkat)
        </span>
      </div>

      <div className="space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-2">
          <span className="font-semibold text-slate-500 sm:col-span-1">
            Elemen:
          </span>
          <span className="font-semibold text-slate-900 sm:col-span-3">
            {elemen || "–"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-2">
          <span className="font-semibold text-slate-500 sm:col-span-1">
            Subelemen:
          </span>
          <span className="leading-relaxed text-slate-800 sm:col-span-3">
            {subElemen || "–"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-2">
          <span className="font-semibold text-slate-500 sm:col-span-1">
            Kompetensi:
          </span>
          <span className="leading-relaxed text-slate-800 sm:col-span-3">
            {kompetensi || "–"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-2">
          <span className="font-semibold text-slate-500 sm:col-span-1">
            Indikator:
          </span>
          <div className="sm:col-span-3 flex flex-wrap items-baseline gap-1.5">
            <span className="font-semibold leading-relaxed text-blue-950">
              {indikator || "–"}
            </span>
            {indikatorResmiId && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800">
                Resmi Pusmendik
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
