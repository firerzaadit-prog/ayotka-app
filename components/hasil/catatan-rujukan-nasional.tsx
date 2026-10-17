import { CATATAN_RUJUKAN_NASIONAL } from "@/lib/indikator/sumber-nasional";

/**
 * Catatan sumber di bawah tabel/daftar yang memuat rerata nasional: "Rujukan nasional berdasarkan data hasil TKA tahun
 * ajaran 2025/2026." Satu komponen dan satu kalimat (lib/indikator/sumber-nasional.ts) dipakai semua tampilan web;
 * penanda data-catatan-rujukan-nasional dipakai tes dan uji browser untuk memastikan catatannya tampil.
 */
export function CatatanRujukanNasional({ className = "" }: { className?: string }) {
  return (
    <p data-catatan-rujukan-nasional className={`text-[11px] leading-snug text-slate-500 ${className}`.trim()}>
      {CATATAN_RUJUKAN_NASIONAL}
    </p>
  );
}
