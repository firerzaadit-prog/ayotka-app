"use client";

import { useMemo, useState } from "react";
import {
  getOfficialHierarchyData,
  type JenjangResmi,
  type MapelKey,
  type SkorKategoriTryOut,
} from "@/lib/indikator/hierarki-resmi";
import { formatPersen } from "@/lib/indikator/tampilan";
import {
  BarChart3,
  BookOpen,
  Users,
  TrendingUp,
  GraduationCap,
} from "lucide-react";

export interface CategoryCounts {
  totalSiswa?: number;
  totalAttempts?: number;
  mandiriAttempts?: number;
  sekolahAttempts?: number;
  nasionalAttempts?: number;
}

interface KemendikdasmenDayaSerapViewProps {
  /** Jenjang bawaan sekolah (SMP / SD). */
  initialJenjang?: JenjangResmi;
  /** Mapel aktif. */
  initialMapel?: MapelKey;
  /** Nama sekolah. */
  namaSekolah?: string;
  /** Data daya serap gabungan sekolah: Map<teks, { dayaSerap, jmlSoal }>. */
  schoolScores?: Map<string, { dayaSerap: number; jmlSoal: number }> | null;
  /** Rincian daya serap terpisah per kategori: mandiri, sekolah, nasional. */
  categoryScores?: SkorKategoriTryOut | null;
  /** Ringkasan jumlah siswa dan attempt. */
  counts?: CategoryCounts | null;
  /** Opsi untuk mengizinkan ganti filter/mapel. */
  allowFilterSwitch?: boolean;
  /** Callback jika mapel berubah. */
  onFilterChange?: (filter: { jenjang: JenjangResmi; mapelKey: MapelKey }) => void;
  /** Slot untuk ranking siswa & kesiapan. */
  rankingSlot?: React.ReactNode;
}

function formatScoreBadge(score: number | null | undefined) {
  if (score == null) {
    return <span className="text-slate-400 font-normal">–</span>;
  }
  const colorClass =
    score >= 70
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : score >= 50
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-rose-700 bg-rose-50 border-rose-200";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${colorClass}`}>
      {formatPersen(score, 2)}
    </span>
  );
}

export function KemendikdasmenDayaSerapView({
  initialJenjang = "SMP",
  initialMapel = "matematika",
  namaSekolah,
  schoolScores,
  categoryScores,
  counts,
  onFilterChange,
  rankingSlot,
}: KemendikdasmenDayaSerapViewProps) {
  const jenjang = initialJenjang;
  const [mapelKey, setMapelKey] = useState<MapelKey>(initialMapel);
  const [modeTampilan, setModeTampilan] = useState<"capaian-kompetensi" | "statistik-nilai" | "ranking-siswa">("capaian-kompetensi");

  // Filter kolom try out (Poin 2 & 3: Mandiri, Sekolah, Nasional)
  const [filterMode, setFilterMode] = useState<"semua" | "mandiri" | "sekolah" | "nasional" | "custom">("semua");
  const [showMandiri, setShowMandiri] = useState(true);
  const [showSekolah, setShowSekolah] = useState(true);
  const [showNasional, setShowNasional] = useState(true);

  // Sync state bila prop mapel berubah dari parent
  const [prevInitialMapel, setPrevInitialMapel] = useState(initialMapel);
  if (initialMapel !== prevInitialMapel) {
    setPrevInitialMapel(initialMapel);
    setMapelKey(initialMapel);
  }

  const handleMapelChange = (nextMapel: MapelKey) => {
    setMapelKey(nextMapel);
    onFilterChange?.({ jenjang, mapelKey: nextMapel });
  };

  const hierarchyData = useMemo(() => {
    return getOfficialHierarchyData(jenjang, mapelKey, schoolScores, categoryScores);
  }, [jenjang, mapelKey, schoolScores, categoryScores]);

  const {
    mapel: namaMapel,
    isMatematika,
    ringkasan,
    grafikData,
    hierarkiRows,
  } = hierarchyData;

  const labelTingkat1 = isMatematika ? "ELEMEN" : "KOMPETENSI";

  return (
    <div className="flex flex-col gap-6">
      {/* 1. HEADER UTAMA ADMIN SEKOLAH (AyoTKA Modern, Tanpa Banner Kemendikdasmen) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
                  Analitik Daya Serap & Capaian Kompetensi
                </h1>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
                  {jenjang}
                </span>
                {namaSekolah && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
                    {namaSekolah}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Pemetaan hasil pengerjaan try out siswa per Elemen, Subelemen, Kompetensi, dan Indikator.
              </p>
            </div>
          </div>

          {/* Mode Tampilan Navigation Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setModeTampilan("capaian-kompetensi")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                modeTampilan === "capaian-kompetensi"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span>Daya Serap Hierarki</span>
            </button>

            <button
              type="button"
              onClick={() => setModeTampilan("statistik-nilai")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                modeTampilan === "statistik-nilai"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Ringkasan & Grafik Nilai</span>
            </button>

            {rankingSlot && (
              <button
                type="button"
                onClick={() => setModeTampilan("ranking-siswa")}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  modeTampilan === "ranking-siswa"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Ranking Siswa</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. KONTEN BERDASARKAN MODE */}
      {modeTampilan === "capaian-kompetensi" && (
        <div className="flex flex-col gap-6">
          {/* Panel Kontrol Mapel & Filter Try Out (Poin 2 & 3) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-4">
              {/* Selector Mata Pelajaran (Khusus Jenjang Sekolah, misal SMP) */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Mata Pelajaran:
                </span>
                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => handleMapelChange("bahasa-indonesia")}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      mapelKey === "bahasa-indonesia"
                        ? "bg-white text-indigo-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Bahasa Indonesia ({jenjang})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMapelChange("matematika")}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      mapelKey === "matematika"
                        ? "bg-white text-indigo-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Matematika ({jenjang})</span>
                  </button>
                </div>
              </div>

              {/* Filter Tipe Try Out Preset & Checkboxes (Poin 2 & 3) */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Filter Try Out:
                </span>
                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("semua");
                      setShowMandiri(true);
                      setShowSekolah(true);
                      setShowNasional(true);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                      filterMode === "semua"
                        ? "bg-white text-slate-900 font-bold shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("mandiri");
                      setShowMandiri(true);
                      setShowSekolah(false);
                      setShowNasional(false);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                      filterMode === "mandiri"
                        ? "bg-white text-sky-700 font-bold shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Mandiri Saja
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("sekolah");
                      setShowMandiri(false);
                      setShowSekolah(true);
                      setShowNasional(false);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                      filterMode === "sekolah"
                        ? "bg-white text-emerald-700 font-bold shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Sekolah Saja
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("nasional");
                      setShowMandiri(false);
                      setShowSekolah(false);
                      setShowNasional(true);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                      filterMode === "nasional"
                        ? "bg-white text-indigo-700 font-bold shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Nasional Saja
                  </button>
                </div>

                {/* Checkbox toggle untuk custom kolaborasi */}
                <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showMandiri}
                      onChange={(e) => {
                        setShowMandiri(e.target.checked);
                        setFilterMode("custom");
                      }}
                      className="rounded text-sky-600 focus:ring-sky-500 h-3.5 w-3.5"
                    />
                    <span className="font-medium">Mandiri</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSekolah}
                      onChange={(e) => {
                        setShowSekolah(e.target.checked);
                        setFilterMode("custom");
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                    />
                    <span className="font-medium">Sekolah</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showNasional}
                      onChange={(e) => {
                        setShowNasional(e.target.checked);
                        setFilterMode("custom");
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                    />
                    <span className="font-medium">Nasional</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Kotak Ringkasan Info Filter & Peserta */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 rounded-xl p-3 text-xs border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[11px]">Sekolah</span>
                <span className="font-semibold text-slate-800">{namaSekolah || "Sekolah Saya"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Jenjang & Mapel</span>
                <span className="font-semibold text-slate-800">{namaMapel} ({jenjang})</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Peserta Mengerjakan</span>
                <span className="font-semibold text-slate-800">
                  {counts?.totalSiswa ?? 0} Siswa ({counts?.totalAttempts ?? 0} Ujian Selesai)
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Kolom Ditampilkan</span>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  {showMandiri && <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.2 rounded">Mandiri</span>}
                  {showSekolah && <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">Sekolah</span>}
                  {showNasional && <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded">Nasional</span>}
                  {!showMandiri && !showSekolah && !showNasional && <span className="text-[10px] text-slate-400">Tidak ada</span>}
                </div>
              </div>
            </div>
          </div>

          {/* TABEL HIERARKI DAYA SERAP UTAMA (Poin 2: HIERARKI, TRY OUT MANDIRI, TRY OUT SEKOLAH, TRY OUT NASIONAL) */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-200">
                    <th className="py-3.5 px-4 uppercase tracking-wider font-bold">HIERARKI</th>
                    {showMandiri && (
                      <th className="py-3.5 px-4 text-right uppercase tracking-wider font-bold text-sky-800 bg-sky-50/70 border-l border-sky-100 w-44">
                        TRY OUT MANDIRI
                      </th>
                    )}
                    {showSekolah && (
                      <th className="py-3.5 px-4 text-right uppercase tracking-wider font-bold text-emerald-800 bg-emerald-50/70 border-l border-emerald-100 w-44">
                        TRY OUT SEKOLAH
                      </th>
                    )}
                    {showNasional && (
                      <th className="py-3.5 px-4 text-right uppercase tracking-wider font-bold text-indigo-800 bg-indigo-50/70 border-l border-indigo-100 w-44">
                        TRY OUT NASIONAL
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hierarkiRows.map((row) => {
                    const isL1 = row.level === 1;
                    const isL2 = row.level === 2;
                    const isL3 = row.level === 3;
                    const isL4 = row.level === 4;

                    // Styling baris bertingkat
                    const rowBg = isL1
                      ? "bg-slate-50/90 font-bold text-slate-900"
                      : isL2
                      ? "bg-white font-semibold text-slate-800 hover:bg-slate-50/40"
                      : isL3
                      ? "bg-white font-medium text-slate-700 hover:bg-slate-50/40"
                      : "bg-white text-slate-600 hover:bg-slate-50/60";

                    const paddingLeft = isL1
                      ? "pl-4"
                      : isL2
                      ? "pl-8"
                      : isL3
                      ? "pl-12"
                      : "pl-16";

                    return (
                      <tr key={row.id} className={`transition-colors ${rowBg}`}>
                        <td className={`py-2.5 pr-4 ${paddingLeft} text-xs leading-relaxed`}>
                          <span className={isL1 ? "text-sm font-bold text-slate-900" : ""}>
                            {row.teks}
                          </span>
                        </td>

                        {showMandiri && (
                          <td className="py-2.5 px-4 text-right border-l border-slate-100 bg-sky-50/20 font-mono text-xs">
                            {formatScoreBadge(row.nilaiMandiri)}
                          </td>
                        )}

                        {showSekolah && (
                          <td className="py-2.5 px-4 text-right border-l border-slate-100 bg-emerald-50/20 font-mono text-xs">
                            {formatScoreBadge(row.nilaiSekolah)}
                          </td>
                        )}

                        {showNasional && (
                          <td className="py-2.5 px-4 text-right border-l border-slate-100 bg-indigo-50/20 font-mono text-xs">
                            {formatScoreBadge(row.nilaiNasional)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODE STATISTIK NILAI & GRAFIK BATANG */}
      {modeTampilan === "statistik-nilai" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="mb-3 text-sm font-bold text-slate-900">
              Ringkasan Capaian per {labelTingkat1}
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-200">
                    <th className="w-14 px-4 py-3 text-center">NO</th>
                    <th className="px-4 py-3 uppercase tracking-wider">{labelTingkat1}</th>
                    <th className="px-4 py-3 text-right uppercase tracking-wider text-sky-800">
                      TRY OUT MANDIRI
                    </th>
                    <th className="px-4 py-3 text-right uppercase tracking-wider text-emerald-800">
                      TRY OUT SEKOLAH
                    </th>
                    <th className="px-4 py-3 text-right uppercase tracking-wider text-indigo-800">
                      TRY OUT NASIONAL
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ringkasan.map((r) => (
                    <tr key={r.no} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 text-center font-medium text-slate-500">{r.no}.</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{r.nama}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-sky-700">
                        {r.nilaiMandiri != null ? formatPersen(r.nilaiMandiri, 2) : "–"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                        {r.nilaiSekolah != null ? formatPersen(r.nilaiSekolah, 2) : "–"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-indigo-700">
                        {r.nilaiNasional != null ? formatPersen(r.nilaiNasional, 2) : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grafik Batang Perbandingan Capaian */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Grafik Perbandingan Capaian per {labelTingkat1}
              </h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-xs bg-sky-500" />
                  <span className="font-medium text-slate-600">Mandiri</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-xs bg-emerald-500" />
                  <span className="font-medium text-slate-600">Sekolah</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-xs bg-indigo-500" />
                  <span className="font-medium text-slate-600">Nasional</span>
                </div>
              </div>
            </div>

            <div className="space-y-5 pt-2">
              {grafikData.map((g) => (
                <div key={g.nama} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{g.nama}</span>
                  </div>

                  <div className="space-y-1">
                    {/* Bar Mandiri */}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-[11px] text-slate-500">Mandiri</span>
                      <div className="relative h-4 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, g.mandiri ?? 0))}%` }}
                        />
                      </div>
                      <span className="w-14 text-right font-mono text-xs font-bold text-sky-700">
                        {g.mandiri != null ? formatPersen(g.mandiri, 1) : "–"}
                      </span>
                    </div>

                    {/* Bar Sekolah */}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-[11px] text-slate-500">Sekolah</span>
                      <div className="relative h-4 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, g.sekolah ?? 0))}%` }}
                        />
                      </div>
                      <span className="w-14 text-right font-mono text-xs font-bold text-emerald-700">
                        {g.sekolah != null ? formatPersen(g.sekolah, 1) : "–"}
                      </span>
                    </div>

                    {/* Bar Nasional */}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-[11px] text-slate-500">Nasional</span>
                      <div className="relative h-4 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, g.nasional ?? 0))}%` }}
                        />
                      </div>
                      <span className="w-14 text-right font-mono text-xs font-bold text-indigo-700">
                        {g.nasional != null ? formatPersen(g.nasional, 1) : "–"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. MODE RANKING & SISWA */}
      {modeTampilan === "ranking-siswa" && rankingSlot && <div>{rankingSlot}</div>}
    </div>
  );
}
