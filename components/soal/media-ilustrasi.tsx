"use client";

import { useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { parseQuestionMedia, type QuestionMediaData } from "@/lib/soal/media-types";

export interface MediaIlustrasiProps {
  media?: string | QuestionMediaData | null;
  alt?: string | null;
  className?: string;
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
 * Komponen render ilustrasi soal dengan dukungan multi-gambar (Tab Diagram & Foto)
 * serta keterangan visualisasi/diagram pendukung, disamakan dengan tampilan generator soal.ayotka.id.
 */
export function MediaIlustrasi({
  media,
  alt,
  className,
  defaultTab = "foto",
}: MediaIlustrasiProps) {
  const mediaData = useMemo(() => {
    if (!media) return null;
    if (typeof media === "object") return media;
    return parseQuestionMedia(media, alt);
  }, [media, alt]);

  // Cari index awal yang cocok dengan defaultTab ("foto" atau "svg")
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
      {/* Baris Keterangan Visualisasi & Switcher Tab */}
      {(mediaData.caption || isMulti) && (
        <div className="space-y-2">
          {/* Visualisasi / Diagram Pendukung Caption */}
          {mediaData.caption && (
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 sm:p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                <ImageIcon className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span>Visualisasi / Diagram Pendukung:</span>
              </div>
              <p className="font-sans italic text-slate-700 text-xs sm:text-[13px] leading-relaxed">
                {mediaData.caption}
              </p>
            </div>
          )}

          {/* Switcher Tab Ilustrasi jika ada lebih dari 1 gambar */}
          {isMulti && (
            <div className="flex items-center justify-end gap-2 pt-0.5">
              <span className="text-[11px] font-medium text-slate-500">
                Tampilan Ilustrasi:
              </span>
              <div
                role="tablist"
                aria-label="Pilihan tampilan ilustrasi soal"
                className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 shadow-2xs"
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
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                        isActive
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                      )}
                    >
                      <span aria-hidden>{isDiagram ? "📊" : "📷"}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Frame Gambar Utama */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 flex items-center justify-center shadow-2xs overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentSrc}
          alt={currentItem.alt || mediaData.caption || currentItem.label}
          className="max-h-[380px] sm:max-h-[440px] max-w-full rounded-lg object-contain block mx-auto transition-opacity duration-200"
          loading="eager"
        />
      </div>
    </div>
  );
}

export default MediaIlustrasi;
