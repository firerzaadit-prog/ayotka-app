import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Kit bersama identitas visual "Kartu Peserta Ujian" (arah desain new-work
 * impeccable, index 7/7 - lihat DESIGN.md). Dipakai di semua section landing
 * supaya bahasa visualnya konsisten: bingkai bersudut siku bergaya dokumen
 * resmi (bukan rounded-card SaaS generik), bukan lingkaran/kertas foto.
 */

const CORNER_BASE = "absolute h-3 w-3 border-card-ink/40";

export function KartuFrame({
  children,
  className,
  paper = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { paper?: boolean }) {
  return (
    <div
      className={cn(
        "relative border border-card-ink/15 bg-white",
        paper && "card-paper-texture",
        className,
      )}
      {...props}
    >
      <span className={cn(CORNER_BASE, "left-0 top-0 border-l-2 border-t-2")} aria-hidden="true" />
      <span className={cn(CORNER_BASE, "right-0 top-0 border-r-2 border-t-2")} aria-hidden="true" />
      <span className={cn(CORNER_BASE, "bottom-0 left-0 border-b-2 border-l-2")} aria-hidden="true" />
      <span className={cn(CORNER_BASE, "bottom-0 right-0 border-b-2 border-r-2")} aria-hidden="true" />
      {children}
    </div>
  );
}

/** Garis "sobek di sini" antar-bagian kartu - motif tiket/dokumen resmi berlubang. */
export function Perforation({ className }: { className?: string }) {
  return <div className={cn("card-perforation", className)} aria-hidden="true" />;
}

/** Label kecil bergaya bidang formulir (mengganti pola kicker/eyebrow yang generik). */
export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "font-card-mono text-[0.7rem] uppercase tracking-[0.14em] text-card-ink/55",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Nomor bergaya ujian/ID - dipakai untuk penomoran section, tanggal, skor, dsb. */
export function ExamNumber({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-card-mono tabular-nums text-card-ink", className)}>{children}</span>;
}

/** Cap/stempel kecil - dipakai untuk status "resmi/terverifikasi" pada kartu. */
export function Seal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-card-seal/50 bg-card-seal/10 px-2.5 py-1 font-card-mono text-[0.65rem] uppercase tracking-wide text-card-seal",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-card-seal" />
      {children}
    </span>
  );
}
