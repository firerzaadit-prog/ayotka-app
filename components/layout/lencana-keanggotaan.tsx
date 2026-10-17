import Link from "next/link";
import { Crown, GraduationCap, Star } from "lucide-react";
import type { JenisKeanggotaan } from "@/lib/billing/keanggotaan-label";

/** Data lencana yang dikirim server (layout siswa) ke DashboardShell: hanya teks sederhana supaya bisa melintas ke komponen klien. */
export type DataLencana = {
  jenis: JenisKeanggotaan;
  /** Teks lengkap, mis. "Member Gratis". */
  label: string;
  /** Keterangan saat kursor diarahkan / dibaca pembaca layar, mis. "Berlaku sampai 20 Nov 2026". */
  keterangan: string;
  href: string;
};

const GAYA: Record<JenisKeanggotaan, string> = {
  gratis: "border-slate-200/90 bg-slate-50 text-slate-700 hover:bg-slate-100 shadow-2xs",
  bulanan: "border-sky-200/90 bg-gradient-to-r from-sky-50 via-blue-50/50 to-sky-50 text-sky-800 hover:border-sky-300 hover:bg-sky-100/80 shadow-2xs",
  semester: "border-amber-300/90 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100/80 shadow-2xs",
  sekolah: "border-emerald-200/90 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100/80 shadow-2xs",
};

const IKON = {
  gratis: null,
  bulanan: Star,
  semester: Crown,
  sekolah: GraduationCap,
} as const;

/**
 * Lencana keanggotaan di pojok kanan atas (di samping nama akun): Member Gratis / Bulanan / Semester / Sekolah. Berupa
 * tautan ke halaman Langganan supaya anggota gratis bisa langsung melihat paket. Di layar sempit (< 420px) kata "Member"
 * dilepas supaya nama akun tetap terbaca; teks lengkap tetap tersedia untuk pembaca layar lewat aria-label.
 */
export function LencanaKeanggotaan({ lencana }: { lencana: DataLencana }) {
  const Ikon = IKON[lencana.jenis];
  const singkat = lencana.label.replace(/^Member\s+/, "");
  return (
    <Link
      href={lencana.href}
      data-lencana-keanggotaan={lencana.jenis}
      aria-label={`${lencana.label}. ${lencana.keterangan}`}
      title={`${lencana.label} · ${lencana.keterangan}`}
      className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${GAYA[lencana.jenis]}`}
    >
      {Ikon && <Ikon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
      <span className="hidden min-[420px]:inline" aria-hidden="true">
        {lencana.label}
      </span>
      <span className="min-[420px]:hidden" aria-hidden="true">
        {singkat}
      </span>
    </Link>
  );
}
