"use client";

import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FilterTanggal } from "@/components/analytics/filter-tanggal";
import { Input, Label } from "@/components/ui/input";
import { competencyTier } from "@/lib/exam/competency-color";
import { formatSkor } from "@/lib/hasil-tryout/format";
import { KETERANGAN_JENIS, LABEL_FILTER_JENIS, LABEL_JENIS_TRYOUT, type FilterJenis, type JenisTryOut } from "@/lib/hasil-tryout/jenis";
import { cn } from "@/lib/utils/cn";

/** Elemen kecil yang dipakai bersama halaman Rapor Siswa, Peringkat Siswa, dan Performa Paket (admin sekolah). */

const VARIAN_JENIS: Record<JenisTryOut, "info" | "success" | "warning"> = { mandiri: "info", sekolah: "success", nasional: "warning" };

export function BadgeJenis({ jenis }: { jenis: JenisTryOut }) {
  return (
    <Badge variant={VARIAN_JENIS[jenis]} data-jenis={jenis} className="whitespace-nowrap">
      {LABEL_JENIS_TRYOUT[jenis]}
    </Badge>
  );
}

const TITIK_JENIS: Record<JenisTryOut, string> = { mandiri: "bg-indigo-500", sekolah: "bg-emerald-500", nasional: "bg-amber-500" };

/**
 * Berapa kali siswa mengerjakan tiap jenis try out: jumlah seluruhnya di baris atas, lalu rincian Mandiri, Sekolah, dan
 * Nasional (yang nol dipudarkan). Dipakai di tabel peringkat supaya jelas dari mana nilai rata-ratanya.
 */
export function RincianJenisTryOut({ perJenis, total }: { perJenis: Record<JenisTryOut, number>; total: number }) {
  return (
    <div data-rincian-jenis>
      <p className="text-base font-semibold text-slate-900" data-total-tryout>
        {total}
      </p>
      <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
        {(["mandiri", "sekolah", "nasional"] as const).map((j) => (
          <li key={j} data-rincian={j} className={cn("flex items-center gap-1 whitespace-nowrap", perJenis[j] === 0 && "opacity-45")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", TITIK_JENIS[j])} aria-hidden="true" />
            {LABEL_JENIS_TRYOUT[j].replace("Try Out ", "")} <span className="font-semibold text-slate-900">{perJenis[j]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const URUTAN_TAB: FilterJenis[] = ["semua", "mandiri", "sekolah", "nasional"];

/**
 * Pilihan jenis try out (Semua, Mandiri, Sekolah, Nasional) dengan jumlah di tiap pilihan dan keterangan singkat di
 * bawahnya, supaya admin langsung paham apa bedanya. `satuan` = kata untuk hitungan di layar pembaca ("rapor", "siswa", "paket").
 */
export function TabJenis({
  nilai,
  onChange,
  jumlah,
  satuan,
  id,
}: {
  nilai: FilterJenis;
  onChange: (jenis: FilterJenis) => void;
  jumlah?: Partial<Record<FilterJenis, number>> | null;
  satuan: string;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-2" data-tab-jenis>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div role="tablist" aria-label="Jenis try out" className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">
          {URUTAN_TAB.map((j) => {
            const aktif = nilai === j;
            const n = jumlah?.[j];
            return (
              <button
                key={j}
                type="button"
                role="tab"
                id={`${id}-${j}`}
                aria-selected={aktif}
                data-jenis-tab={j}
                onClick={() => onChange(j)}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  aktif ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
                )}
              >
                {LABEL_FILTER_JENIS[j]}
                {n !== undefined && (
                  <span
                    className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", aktif ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600")}
                    aria-label={`${n} ${satuan}`}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-slate-500" data-keterangan-jenis>
        {KETERANGAN_JENIS[nilai]}
      </p>
    </div>
  );
}

/** Tautan unduh rapor PDF satu percobaan (rute yang sama dipakai siswa; admin sekolah dibatasi ke siswa sekolahnya). */
export function TombolPdf({ attemptId, nama }: { attemptId: string; nama: string }) {
  return (
    <a
      href={`/api/siswa/attempts/${attemptId}/rapor`}
      download
      data-unduh-pdf={attemptId}
      aria-label={`Unduh rapor PDF ${nama}`}
      title={`Unduh rapor PDF ${nama}`}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
    >
      <Download size={14} aria-hidden="true" />
      Unduh PDF
    </a>
  );
}

const WARNA_PERINGKAT: Record<number, string> = {
  1: "bg-amber-100 text-amber-800 ring-amber-300",
  2: "bg-slate-200 text-slate-900 ring-slate-400",
  3: "bg-orange-100 text-orange-800 ring-orange-300",
};

/** Nomor peringkat; tiga teratas diberi warna (emas, perak, perunggu). */
export function LencanaPeringkat({ peringkat }: { peringkat: number | null }) {
  if (peringkat == null) return <span className="text-slate-400">-</span>;
  return (
    <span
      data-peringkat={peringkat}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-bold",
        WARNA_PERINGKAT[peringkat] ? `${WARNA_PERINGKAT[peringkat]} ring-1` : "text-slate-600",
      )}
    >
      {peringkat}
    </span>
  );
}

/** Nilai dengan warna tingkat yang sama dengan peta kompetensi: hijau (70 ke atas), kuning (50-69), merah (di bawah 50). */
export function NilaiTingkat({ skor, tebal = true }: { skor: number | null | undefined; tebal?: boolean }) {
  if (skor == null) return <span className="text-slate-400">-</span>;
  const tingkat = competencyTier(skor);
  const warna = tingkat === "baik" ? "text-emerald-700" : tingkat === "cukup" ? "text-amber-700" : "text-rose-700";
  return <span className={cn(warna, tebal && "font-semibold")}>{formatSkor(skor)}</span>;
}

export function KotakCari({
  nilai,
  onChange,
  placeholder = "Cari nama atau NISN...",
  id = "cariLaporan",
}: {
  nilai: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  return (
    <div className="min-w-56 flex-1">
      <Label htmlFor={id}>Cari siswa</Label>
      <Input id={id} type="search" value={nilai} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={100} autoComplete="off" />
    </div>
  );
}

const kelasPilihan =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10";

export function Pilihan({
  id,
  label,
  nilai,
  onChange,
  opsi,
  className,
}: {
  id: string;
  label: string;
  nilai: string;
  onChange: (v: string) => void;
  opsi: Array<{ nilai: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={cn("min-w-44", className)}>
      <Label htmlFor={id}>{label}</Label>
      <select id={id} value={nilai} onChange={(e) => onChange(e.target.value)} className={kelasPilihan}>
        {opsi.map((o) => (
          <option key={o.nilai} value={o.nilai}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Pemilih tanggal dilipat supaya layar tidak ramai: ringkasan syarat tampil di judulnya, isian lengkap dibuka bila perlu. */
export function FilterTanggalLipat({ dari, sampai, onChange }: { dari: string; sampai: string; onChange: (r: { dari: string; sampai: string }) => void }) {
  const aktif = Boolean(dari || sampai);
  return (
    <details className="group rounded-xl border border-slate-200 bg-white px-4 py-2.5" open={aktif} data-filter-tanggal>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-700">
        <span>
          Periode tanggal:{" "}
          <span className={aktif ? "text-indigo-700" : "text-slate-500"}>
            {aktif ? `${dari || "awal"} s.d. ${sampai || "sekarang"}` : "semua waktu"}
          </span>
        </span>
        <span className="text-xs text-slate-400 group-open:hidden">Ubah</span>
        <span className="hidden text-xs text-slate-400 group-open:inline">Tutup</span>
      </summary>
      <div className="mt-3 border-t border-slate-100 pt-3">
        <FilterTanggal dari={dari} sampai={sampai} onChange={onChange} id="tanggalLaporan" />
      </div>
    </details>
  );
}

export function SakelarAlumni({ ikut, onChange }: { ikut: boolean; onChange: (ikut: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={ikut}
        onChange={(e) => onChange(e.target.checked)}
        data-sakelar-alumni
        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      Sertakan alumni
    </label>
  );
}
