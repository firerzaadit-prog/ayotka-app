"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  getOfficialHierarchyData,
  type BarisHierarkiDetail,
  type ContohSoalItem,
  type JenjangResmi,
  type MapelKey,
} from "@/lib/indikator/hierarki-resmi";
import { formatPersen } from "@/lib/indikator/tampilan";
import {
  Filter,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  BookOpen,
  School,
  Users,
  CheckCircle2,
  X,
  MapPin,
  Globe,
  TrendingUp,
} from "lucide-react";

interface KemendikdasmenDayaSerapViewProps {
  /** Jenjang bawaan bila ada (misal dari profil sekolah). */
  initialJenjang?: JenjangResmi;
  /** Mapel bawaan. */
  initialMapel?: MapelKey;
  /** Nama sekolah jika berada di panel sekolah/admin. */
  namaSekolah?: string;
  /** Data daya serap sekolah per teks indikator: Map<indikatorTeks, { dayaSerap, jmlSoal }>. */
  schoolScores?: Map<string, { dayaSerap: number; jmlSoal: number }>;
  /** Jika true, tampilkan panel filter samping seperti portal Kemendikdasmen. */
  allowFilterSwitch?: boolean;
  /** Callback jika filter jenjang/mapel berubah, agar parent bisa memuat data sekolah yang relevan. */
  onFilterChange?: (filter: { jenjang: JenjangResmi; mapelKey: MapelKey }) => void;
  /** Opsional: Slot untuk ranking siswa & kesiapan jika admin ingin melihat data tambahan. */
  rankingSlot?: React.ReactNode;
}

/**
 * Logo Resmi Kemendikdasmen (Tut Wuri Handayani)
 */
function LogoKemendikdasmen({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M50 4 L90 19 L90 56 C90 77 50 96 50 96 C50 96 10 77 10 56 L10 19 Z" fill="#0284C7" stroke="#0369A1" strokeWidth="2" />
      <path d="M50 30 C37 40 23 46 21 58 C25 56 31 54 37 55 C29 62 25 70 27 78 C34 72 43 68 50 72 Z" fill="#FACC15" />
      <path d="M50 30 C63 40 77 46 79 58 C75 56 69 54 63 55 C71 62 75 70 73 78 C66 72 57 68 50 72 Z" fill="#FACC15" />
      <path d="M50 18 C46 26 44 30 47 37 C49 33 51 31 50 27 C53 31 55 35 53 41 C57 36 58 31 50 18 Z" fill="#EF4444" />
      <path d="M50 68 C42 66 33 68 29 72 C35 74 42 74 50 75 C58 74 65 74 71 72 C67 68 58 66 50 68 Z" fill="#FFFFFF" />
      <circle cx="50" cy="16" r="3.5" fill="#FDE047" />
    </svg>
  );
}

export function KemendikdasmenDayaSerapView({
  initialJenjang = "SMP",
  initialMapel = "matematika",
  namaSekolah,
  schoolScores,
  allowFilterSwitch = true,
  onFilterChange,
  rankingSlot,
}: KemendikdasmenDayaSerapViewProps) {
  const [jenjang, setJenjang] = useState<JenjangResmi>(initialJenjang);
  const [mapelKey, setMapelKey] = useState<MapelKey>(initialMapel);
  const [selectedSoal, setSelectedSoal] = useState<ContohSoalItem | null>(null);
  const [tahunPelajaran, setTahunPelajaran] = useState("2025/2026");
  const [modeTampilan, setModeTampilan] = useState<"capaian-kompetensi" | "statistik-nilai" | "ranking-siswa">("capaian-kompetensi");
  const [wilayahFilter, setWilayahFilter] = useState<"nasional" | "sekolah">("nasional");
  const [radioJenjang, setRadioJenjang] = useState<"SEMUA" | "JENJANG" | "PAKET" | "SLB">("SEMUA");
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);

  // Sync state bila prop berubah dari parent
  useEffect(() => {
    if (initialJenjang) setJenjang(initialJenjang);
  }, [initialJenjang]);

  useEffect(() => {
    if (initialMapel) setMapelKey(initialMapel);
  }, [initialMapel]);

  const showSchoolColumn = Boolean(namaSekolah || (schoolScores && schoolScores.size > 0));

  const handleJenjangChange = (nextJenjang: JenjangResmi) => {
    setJenjang(nextJenjang);
    onFilterChange?.({ jenjang: nextJenjang, mapelKey });
  };

  const handleMapelChange = (nextMapel: MapelKey) => {
    setMapelKey(nextMapel);
    onFilterChange?.({ jenjang, mapelKey: nextMapel });
  };

  const hierarchyData = useMemo(() => {
    return getOfficialHierarchyData(jenjang, mapelKey, schoolScores);
  }, [jenjang, mapelKey, schoolScores]);

  const {
    mapel: namaMapel,
    isMatematika,
    totalSekolah,
    totalPeserta,
    ringkasan,
    grafikData,
    hierarkiRows,
  } = hierarchyData;

  const titleUnit = isMatematika ? "Elemen" : "Kompetensi";
  const labelTingkat1 = isMatematika ? "ELEMEN" : "KOMPETENSI";

  const modalTitleId = useId();

  return (
    <div className="flex flex-col gap-5 font-sans text-slate-800">
      {/* ========================================================================= */}
      {/* LAYOUT DUA KOLOM PERSIS SEPERTI GAMBAR 2 DARI PORTAL RESMI KEMENDIKDASMEN */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* ------------------------------------------------------------- */}
        {/* KOLOM KIRI: PANEL FILTER DATA (PERSIS SEPERTI GAMBAR 2)       */}
        {/* ------------------------------------------------------------- */}
        {allowFilterSwitch && (
          <aside
            className={`w-full shrink-0 transition-all duration-200 ${
              isFilterCollapsed ? "lg:w-16" : "lg:w-72"
            }`}
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              {/* Header Panel Filter Data */}
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                    <Filter className="h-4 w-4" />
                  </div>
                  {!isFilterCollapsed && (
                    <span className="text-sm font-bold text-slate-800">Filter Data</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                  title={isFilterCollapsed ? "Buka Filter" : "Tutup Filter"}
                >
                  {isFilterCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
              </div>

              {!isFilterCollapsed && (
                <div className="flex flex-col gap-3 text-xs">
                  {/* 1. TAHUN PELAJARAN (Kotak border merah tipis seperti Gambar 2) */}
                  <div className="rounded-xl border border-rose-200 bg-rose-50/20 p-2.5">
                    <label htmlFor="filterTahun" className="mb-1 block font-bold uppercase tracking-wider text-[10px] text-rose-600">
                      Tahun Pelajaran
                    </label>
                    <select
                      id="filterTahun"
                      value={tahunPelajaran}
                      onChange={(e) => setTahunPelajaran(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/20"
                    >
                      <option value="2025/2026">2025/2026</option>
                      <option value="2024/2025">2024/2025</option>
                    </select>
                  </div>

                  {/* 2. JENJANG PENDIDIKAN (Kotak border merah tipis seperti Gambar 2) */}
                  <div className="rounded-xl border border-rose-200 bg-rose-50/20 p-2.5">
                    <label htmlFor="filterJenjang" className="mb-1 block font-bold uppercase tracking-wider text-[10px] text-rose-600">
                      Jenjang Pendidikan
                    </label>
                    <select
                      id="filterJenjang"
                      value={jenjang}
                      onChange={(e) => handleJenjangChange(e.target.value as JenjangResmi)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/20"
                    >
                      <option value="SMP">SMP</option>
                      <option value="SD">SD</option>
                    </select>
                  </div>

                  {/* 3. WILAYAH */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5">
                    <label htmlFor="filterWilayah" className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] text-blue-700">
                      <Globe className="h-3 w-3" />
                      <span>Wilayah</span>
                    </label>
                    <select
                      id="filterWilayah"
                      value={wilayahFilter}
                      onChange={(e) => setWilayahFilter(e.target.value as any)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 transition focus:border-blue-400 focus:outline-none"
                    >
                      <option value="nasional">Nasional</option>
                      {namaSekolah && <option value="sekolah">Sekolah Saya ({namaSekolah})</option>}
                    </select>
                  </div>

                  {/* 4. KABUPATEN/KOTA */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5">
                    <label htmlFor="filterKabupaten" className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] text-blue-700">
                      <MapPin className="h-3 w-3" />
                      <span>Kabupaten/Kota</span>
                    </label>
                    <select
                      id="filterKabupaten"
                      disabled
                      className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs text-slate-500 cursor-not-allowed"
                    >
                      <option>Semua Kabupaten/Kota</option>
                    </select>
                  </div>

                  {/* 5. MATA PELAJARAN (Kotak border biru tipis) */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-2.5">
                    <label htmlFor="filterMapel" className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] text-blue-700">
                      <BookOpen className="h-3 w-3" />
                      <span>Mata Pelajaran</span>
                    </label>
                    <select
                      id="filterMapel"
                      value={mapelKey}
                      onChange={(e) => handleMapelChange(e.target.value as MapelKey)}
                      className="w-full rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="matematika">Matematika</option>
                      <option value="bahasa-indonesia">Bahasa Indonesia</option>
                    </select>
                  </div>

                  {/* 6. JENJANG RADIO BUTTONS (Sesuai Gambar 2) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <span className="mb-1.5 block font-bold uppercase tracking-wider text-[10px] text-slate-700">
                      Jenjang
                    </span>
                    <div className="space-y-1.5 text-xs">
                      {(["SEMUA", jenjang, jenjang === "SMP" ? "PAKET B" : "PAKET A", "SLB"] as const).map((opt) => (
                        <label key={opt} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="radioJenjang"
                            value={opt}
                            checked={radioJenjang === opt}
                            onChange={() => setRadioJenjang(opt as any)}
                            className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-[11px] font-medium">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Versi Aplikasi & Tombol Refresh */}
                  <div className="mt-1 pt-2 border-t border-slate-100 flex flex-col items-center gap-2">
                    <span className="text-[10px] text-slate-400">Versi Aplikasi 1.12.18</span>
                    <button
                      type="button"
                      onClick={() => {
                        onFilterChange?.({ jenjang, mapelKey });
                      }}
                      className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 text-xs flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-98 cursor-pointer"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ------------------------------------------------------------- */}
        {/* KOLOM KANAN: KONTEN UTAMA PERSIS SEPERTI GAMBAR 2             */}
        {/* ------------------------------------------------------------- */}
        <main className="flex-1 min-w-0 flex flex-col gap-4">
          {/* 1. HEADER KEMENDIKDASMEN & TOGGLE CAPAIAN KOMPETENSI (GAMBAR 2) */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            {/* Logo Kemendikdasmen & Unit Kerja */}
            <div className="flex items-center gap-3">
              <LogoKemendikdasmen className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 drop-shadow-2xs" />
              <div>
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 leading-tight">
                  Kemendikdasmen
                </h1>
                <p className="text-[11px] text-slate-500 leading-tight font-medium">
                  Badan Kebijakan Pendidikan Dasar dan Menengah
                </p>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Pusat Asesmen Pendidikan
                </p>
              </div>
            </div>

            {/* Tombol Aksi di Kanan Atas: Statistik Nilai & Capaian Kompetensi (BARU) */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setModeTampilan("statistik-nilai")}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  modeTampilan === "statistik-nilai"
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                    : "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Statistik Nilai</span>
              </button>

              <button
                type="button"
                onClick={() => setModeTampilan("capaian-kompetensi")}
                className={`relative flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition shadow-xs cursor-pointer ${
                  modeTampilan === "capaian-kompetensi"
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50"
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Capaian Kompetensi</span>
                <span className="rounded-xs bg-amber-400 px-1 py-0.2 text-[9px] font-extrabold text-rose-950 uppercase">
                  BARU
                </span>
              </button>

              {rankingSlot && (
                <button
                  type="button"
                  onClick={() => setModeTampilan("ranking-siswa")}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    modeTampilan === "ranking-siswa"
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Ranking & Siswa</span>
                </button>
              )}
            </div>
          </div>

          {/* MODE RANKING & SISWA JIKA DIPILIH */}
          {modeTampilan === "ranking-siswa" && rankingSlot}

          {/* MODE STATISTIK NILAI: RINGKASAN & GRAFIK BATANG */}
          {modeTampilan === "statistik-nilai" && (
            <div className="flex flex-col gap-4">
              {/* Ringkasan Per Elemen / Kompetensi */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="mb-3 flex items-baseline justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      💡 Ringkasan Per {titleUnit}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Total Peserta: Nasional ({totalPeserta.toLocaleString("id-ID")})
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">
                    {ringkasan.length} {titleUnit.toLowerCase()}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-sky-50/70 text-xs font-bold text-slate-700 border-b border-slate-200">
                        <th className="w-14 px-4 py-3 text-center">NO</th>
                        <th className="px-4 py-3 uppercase tracking-wider">{labelTingkat1}</th>
                        <th className="px-4 py-3 text-right uppercase tracking-wider">
                          NASIONAL ({totalPeserta.toLocaleString("id-ID")})
                        </th>
                        {showSchoolColumn && (
                          <th className="px-4 py-3 text-right uppercase tracking-wider text-emerald-800">
                            {namaSekolah ? `SEKOLAH (${namaSekolah})` : "SEKOLAH SAYA"}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ringkasan.map((r) => (
                        <tr key={r.no} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 text-center font-medium text-slate-500">{r.no}.</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{r.nama}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-blue-700">
                            {formatPersen(r.nilaiNasional, 2)}
                          </td>
                          {showSchoolColumn && (
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                              {typeof r.sekolahNilai === "number" ? formatPersen(r.sekolahNilai, 2) : "–"}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Grafik Batang Per Elemen / Kompetensi */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      📈 Grafik Per {titleUnit}
                    </h2>
                    <p className="text-xs text-slate-500">Persentase capaian nasional (%) per kategori materi</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-slate-700">
                      <span className="h-3 w-3 rounded-xs bg-blue-600" /> Nasional (%)
                    </span>
                    {showSchoolColumn && (
                      <span className="flex items-center gap-1.5 font-medium text-slate-700">
                        <span className="h-3 w-3 rounded-xs bg-emerald-500" /> Sekolah (%)
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative pt-6">
                  <div className="absolute inset-x-0 top-6 bottom-16 flex flex-col justify-between pointer-events-none text-[10px] text-slate-300">
                    {[100, 80, 60, 40, 20, 0].map((step) => (
                      <div key={step} className="flex items-center gap-2">
                        <span className="w-6 text-right font-mono">{step}</span>
                        <div className="h-px w-full bg-slate-100" />
                      </div>
                    ))}
                  </div>

                  <div className="relative ml-8 grid grid-flow-col auto-cols-fr gap-4 sm:gap-8 pt-4 pb-2 items-end h-64">
                    {grafikData.map((g) => {
                      const heightNasional = Math.max(4, Math.min(100, g.nasional));
                      const heightSekolah = typeof g.sekolah === "number" ? Math.max(4, Math.min(100, g.sekolah)) : null;

                      return (
                        <div key={g.nama} className="group relative flex flex-col items-center h-full justify-end">
                          <div className="mb-1.5 font-mono text-xs font-bold text-blue-700 transition group-hover:scale-105">
                            {g.nasional.toFixed(2)}%
                          </div>

                          <div className="flex items-end gap-1.5 w-full justify-center">
                            <div
                              className="w-12 sm:w-16 max-w-full rounded-t-sm bg-blue-600 transition-all duration-500 hover:bg-blue-700 shadow-xs"
                              style={{ height: `${(heightNasional / 100) * 190}px` }}
                              title={`Nasional: ${g.nasional.toFixed(2)}%`}
                            />
                            {heightSekolah !== null && (
                              <div
                                className="w-12 sm:w-16 max-w-full rounded-t-sm bg-emerald-500 transition-all duration-500 hover:bg-emerald-600 shadow-xs"
                                style={{ height: `${(heightSekolah / 100) * 190}px` }}
                                title={`Sekolah: ${g.sekolah?.toFixed(2)}%`}
                              />
                            )}
                          </div>

                          <div className="mt-3 text-center text-xs font-medium text-slate-700 line-clamp-2 w-full px-1">
                            {g.nama}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODE UTAMA: CAPAIAN KOMPETENSI (PERSIS GAMBAR 2) */}
          {modeTampilan === "capaian-kompetensi" && (
            <div className="flex flex-col gap-4">
              {/* 2. SUBHEADER JUDUL CAPAIAN NASIONAL (GAMBAR 2) */}
              <div className="flex items-center gap-2 pt-1">
                <BarChart3 className="h-5 w-5 text-blue-600 shrink-0" />
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-blue-950 leading-tight">
                    Persentase Capaian Nasional
                  </h2>
                  <p className="text-xs text-slate-500 leading-tight">
                    Kompetensi mata pelajaran: <strong>{namaMapel}</strong> ({jenjang})
                  </p>
                </div>
              </div>

              {/* 3. KOTAK INFORMASI FILTER (PERSIS SEPERTI GAMBAR 2) */}
              <div className="rounded-xl border border-blue-200 bg-white p-3.5 shadow-2xs text-xs">
                <div className="mb-2 flex items-center gap-1.5 font-bold text-blue-900">
                  <Filter className="h-3.5 w-3.5 text-blue-600" />
                  <span>Informasi Filter</span>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4 text-slate-600">
                  <div>
                    <span className="text-slate-400">Wilayah:</span>{" "}
                    <span className="font-semibold text-slate-800">
                      {wilayahFilter === "sekolah" ? (namaSekolah || "Sekolah Saya") : "Nasional"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Provinsi:</span>{" "}
                    <span className="font-semibold text-slate-800">Semua Provinsi</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Kabupaten:</span>{" "}
                    <span className="font-semibold text-slate-800">Semua Kabupaten</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Sekolah:</span>{" "}
                    <span className="font-semibold text-slate-800">{namaSekolah || "Semua Sekolah"}</span>
                  </div>

                  <div>
                    <span className="text-slate-400">Mata Pelajaran:</span>{" "}
                    <span className="font-semibold text-slate-800">{namaMapel}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Jenjang:</span>{" "}
                    <span className="font-semibold text-slate-800">{jenjang}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Jenis Sekolah:</span>{" "}
                    <span className="font-semibold text-slate-800">Semua Jenis</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Status Sekolah:</span>{" "}
                    <span className="font-semibold text-slate-800">Semua Status</span>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Total Peserta: <strong>Nasional ({totalPeserta.toLocaleString("id-ID")})</strong>
                  </span>
                  {showSchoolColumn && (
                    <span className="text-emerald-700 font-medium">
                      Kolom Capaian Sekolah Aktif
                    </span>
                  )}
                </div>
              </div>

              {/* 4. TABEL HIERARKI DETAIL PERSIS GAMBAR 2 (ELEMEN -> SUBELEMEN -> KOMPETENSI -> INDIKATOR) */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-200 text-xs font-bold text-slate-800 border-b border-slate-300">
                        <th className="px-4 py-3.5 uppercase tracking-wider">HIERARKI</th>
                        <th className="px-4 py-3.5 text-right uppercase tracking-wider w-40 sm:w-48">
                          NASIONAL ({totalPeserta.toLocaleString("id-ID")})
                        </th>
                        {showSchoolColumn && (
                          <th className="px-4 py-3.5 text-right uppercase tracking-wider w-36 sm:w-44 text-emerald-900 bg-emerald-50/50">
                            {namaSekolah ? `SEKOLAH (${namaSekolah})` : "SEKOLAH SAYA"}
                          </th>
                        )}
                        <th className="px-4 py-3.5 text-center uppercase tracking-wider w-32">
                          CONTOH SOAL
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {hierarkiRows.map((row) => {
                        const isLevel1 = row.level === 1; // Elemen (Matematika) atau Kompetensi (Bahasa)
                        const isLevel2 = row.level === 2; // Subelemen (Matematika) atau Subkompetensi (Bahasa)
                        const isLevel3 = row.level === 3; // Kompetensi (Matematika) atau Indikator (Bahasa)
                        const isLevel4 = row.level === 4; // Indikator (Matematika)

                        let rowBg = "bg-white hover:bg-slate-50/70";
                        let textClass = "text-slate-700";
                        let indentPadding = "pl-4";

                        if (isLevel1) {
                          rowBg = "bg-slate-50/90 font-bold border-t-2 border-slate-200 text-slate-900";
                          textClass = "text-slate-900 font-bold text-sm";
                          indentPadding = "pl-4";
                        } else if (isLevel2) {
                          textClass = "text-slate-800 font-semibold text-xs sm:text-sm";
                          indentPadding = "pl-8 sm:pl-10";
                        } else if (isLevel3) {
                          if (isMatematika) {
                            textClass = "text-slate-700 leading-relaxed text-xs";
                            indentPadding = "pl-12 sm:pl-16";
                          } else {
                            // Di Bahasa Indonesia, level 3 adalah Indikator (leaf)
                            textClass = "text-slate-700 leading-snug text-xs";
                            indentPadding = "pl-12 sm:pl-16";
                          }
                        } else if (isLevel4) {
                          // Di Matematika, level 4 adalah Indikator (leaf)
                          textClass = "text-slate-700 leading-snug text-xs";
                          indentPadding = "pl-16 sm:pl-22";
                        }

                        return (
                          <tr key={row.id} className={`${rowBg} transition-colors`}>
                            {/* Kolom Teks Hierarki dengan indentasi berjenjang */}
                            <td className={`py-2.5 pr-4 ${indentPadding} ${textClass}`}>
                              {row.teks}
                            </td>

                            {/* Kolom Persentase Nasional */}
                            <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-800 whitespace-nowrap">
                              {row.nilaiNasional ? `${row.nilaiNasional.toFixed(2)}%` : "–"}
                            </td>

                            {/* Kolom Capaian Sekolah Saya */}
                            {showSchoolColumn && (
                              <td className="px-4 py-2.5 text-right font-mono font-medium text-emerald-700 whitespace-nowrap bg-emerald-50/30">
                                {typeof row.sekolahNilai === "number" ? `${row.sekolahNilai.toFixed(2)}%` : "–"}
                              </td>
                            )}

                            {/* Kolom Tombol Contoh Soal (Pink lembut sesuai Gambar 2) */}
                            <td className="px-4 py-2 text-center whitespace-nowrap">
                              {row.hasContohSoal && row.contohSoal ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedSoal(row.contohSoal || null)}
                                  className="inline-flex items-center gap-1 rounded-md border border-fuchsia-200 bg-fuchsia-50/80 px-2.5 py-1 text-xs font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100 hover:text-fuchsia-800 active:scale-95 shadow-2xs cursor-pointer"
                                >
                                  <span>Lihat Soal</span>
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 5. FOOTER BAR PERSIS SEPERTI GAMBAR 2 */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-[11px] text-slate-400">
            <div>
              <span>Copyright © Pusat Asesmen Pendidikan 2025</span>
            </div>
            <div className="flex items-center gap-4 font-mono">
              <span>⚡ Hits: 4.420.847</span>
              <span>👥 Pengunjung: 586.501</span>
            </div>
          </div>
        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL CONTOH SOAL (POPUP SAAT KLIK [LIHAT SOAL])                          */}
      {/* ========================================================================= */}
      {selectedSoal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100 text-pink-700">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div>
                  <h3 id={modalTitleId} className="text-sm font-bold text-slate-900">
                    Contoh Soal Pusmendik Kemendikdasmen
                  </h3>
                  <p className="text-xs text-slate-500">
                    {jenjang} · {namaMapel} · Butir #{selectedSoal.nomor}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSoal(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm leading-relaxed text-slate-700">
              {/* Box Indikator Resmi */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5">
                <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  Indikator Resmi Asesmen:
                </span>
                <p className="font-semibold text-blue-950 text-xs sm:text-sm">{selectedSoal.indikator}</p>
              </div>

              {/* Teks Stimulus (jika ada) */}
              {selectedSoal.stimulusTeks && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {selectedSoal.stimulusJudul && (
                    <h4 className="mb-2 font-bold text-slate-900 text-xs uppercase tracking-wide">
                      📖 {selectedSoal.stimulusJudul}
                    </h4>
                  )}
                  <p className="text-xs sm:text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                    {selectedSoal.stimulusTeks}
                  </p>
                </div>
              )}

              {/* Teks Pertanyaan */}
              <div>
                <p className="font-semibold text-slate-900 text-sm leading-relaxed">{selectedSoal.pertanyaan}</p>
              </div>

              {/* Opsi Pilihan Jawaban */}
              {selectedSoal.pilihan && selectedSoal.pilihan.length > 0 && (
                <div className="space-y-2 pt-1">
                  {selectedSoal.pilihan.map((p) => {
                    const isKunci = selectedSoal.kunciJawaban === p.kode;
                    return (
                      <div
                        key={p.kode}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-xs sm:text-sm transition ${
                          isKunci
                            ? "border-emerald-300 bg-emerald-50/70 text-emerald-950 font-medium"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isKunci ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {p.kode}
                        </span>
                        <div className="flex-1 pt-0.5">{p.teks}</div>
                        {isKunci && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Box Kunci Jawaban & Pembahasan */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded-md bg-emerald-600 px-2 py-0.5 font-mono text-xs font-bold text-white">
                    Kunci: {selectedSoal.kunciJawaban}
                  </span>
                  <span className="text-xs font-semibold text-emerald-900">Pembahasan Konsep:</span>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-emerald-950">{selectedSoal.pembahasan}</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSoal(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
