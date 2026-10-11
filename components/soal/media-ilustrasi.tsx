"use client";

import { useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { parseQuestionMedia, type QuestionMediaData } from "@/lib/soal/media-types";

export interface MediaIlustrasiProps {
  media?: string | QuestionMediaData | null;
  alt?: string | null;
  className?: string;
  /** Tab yang terbuka lebih dulu bila soal punya dua gambar. Bawaan = diagram, sama seperti tampilan di soal.ayotka.id. */
  defaultTab?: "foto" | "svg";
}

/**
 * Konversi SVG content menjadi data URI yang aman untuk src <img>.
 * Browser mengisolasi <img> dari eksekusi skrip secara bawaan, sehingga aman dari risiko XSS.
 */
function svgToDataUri(svg: string): string {
  const trimmed = svg.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`;
}

/**
 * Komponen render ilustrasi soal dengan dukungan multi-gambar (tab Diagram Presisi & Foto Ilustrasi) serta keterangan
 * "Visualisasi / Diagram Pendukung", disamakan dengan tampilan soal di generator soal.ayotka.id:
 * judul di kiri dan keterangan miring di kanan (di HP keterangan turun ke bawah judul), lalu satu bingkai abu-abu berisi
 * "Tampilan Ilustrasi:" + tab di bagian atas dan gambarnya di bawah.
 */
export function MediaIlustrasi({
  media,
  alt,
  className,
  defaultTab = "svg",
}: MediaIlustrasiProps) {
  const mediaData = useMemo(() => {
    if (!media) return null;
    if (typeof media === "object") return media;
    return parseQuestionMedia(media, alt);
  }, [media, alt]);

  // Cari index awal yang cocok dengan defaultTab ("svg" atau "foto")
  const initialIndex = useMemo(() => {
    if (!mediaData || mediaData.items.length <= 1) return 0;
    const found = mediaData.items.findIndex((it) => it.tipe === defaultTab);
    return found !== -1 ? found : 0;
  }, [mediaData, defaultTab]);

  // Tab pilihan siswa hanya berlaku untuk media yang sedang tampil. Berpindah ke soal lain (media berbeda) kembali ke tab
  // awal - bukan membawa indeks lama ke soal yang mungkin hanya punya satu gambar (komponen ini dipakai ulang antar soal).
  const [pilihan, setPilihan] = useState<{ untuk: QuestionMediaData | null; indeks: number }>({ untuk: null, indeks: 0 });
  const activeIndex = pilihan.untuk === mediaData ? pilihan.indeks : initialIndex;
  const setActiveIndex = (indeks: number) => setPilihan({ untuk: mediaData, indeks });

  if (!mediaData || mediaData.items.length === 0) return null;

  const currentItem = mediaData.items[activeIndex] ?? mediaData.items[0];
  if (!currentItem) return null;

  const isMulti = mediaData.items.length > 1;

  // Sumber gambar aktif
  let currentSrc = currentItem.url;
  if (!currentSrc && currentItem.svgContent) {
    currentSrc = svgToDataUri(currentItem.svgContent);
  }
  if (!currentSrc) return null;

  return (
    <div className={cn("space-y-2 select-none", className)}>
      {/* Judul + keterangan visualisasi */}
      {mediaData.caption && (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
            <span>Visualisasi / Diagram Pendukung</span>
          </div>
          <p className="min-w-0 flex-1 font-sans text-xs italic leading-relaxed text-slate-500 sm:text-[13px]">
            {mediaData.caption}
          </p>
        </div>
      )}

      {/* Bingkai: pemilih tampilan (hanya bila ada lebih dari 1 gambar) di atas, gambar aktif di bawahnya */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-5">
        {isMulti && (
          <div className="mb-3 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
            <span className="text-[11px] font-medium text-slate-500 sm:text-xs">Tampilan Ilustrasi:</span>
            <div
              role="tablist"
              aria-label="Pilihan tampilan ilustrasi soal"
              className="grid w-full grid-cols-2 gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5 sm:inline-flex sm:w-auto sm:max-w-full"
            >
              {mediaData.items.map((item, idx) => {
                const isActive = activeIndex === idx;
                const isDiagram = item.tipe === "svg" || item.tipe === "diagram";
                return (
                  <button
                    key={idx}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveIndex(idx)}
                    className={cn(
                      "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-center text-xs font-semibold leading-tight transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900",
                    )}
                  >
                    <span aria-hidden className="shrink-0">{isDiagram ? "📊" : "📷"}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentSrc}
            alt={currentItem.alt || mediaData.caption || currentItem.label}
            className="mx-auto block max-h-[380px] max-w-full rounded-lg object-contain sm:max-h-[440px]"
            loading="eager"
          />
        </div>
      </div>
    </div>
  );
}

export default MediaIlustrasi;
