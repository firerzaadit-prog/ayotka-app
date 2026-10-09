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
import { School, Users, BarChart3, ChevronRight, X, Sparkles, BookOpen, Layers, CheckCircle2 } from "lucide-react";

interface KemendikdasmenDayaSerapViewProps {
  /** Jenjang bawaan bila ada (misal dari profil sekolah). */
  initialJenjang?: JenjangResmi;
  /** Mapel bawaan. */
  initialMapel?: MapelKey;
  /** Nama sekolah jika berada di panel sekolah/admin. */
  namaSekolah?: string;
  /** Data daya serap sekolah per teks indikator: Map<indikatorTeks, { dayaSerap, jmlSoal }>. */
  schoolScores?: Map<string, { dayaSerap: number; jmlSoal: number }>;
  /** Jika true, tampilkan opsi filter untuk switch antara SD/SMP dan Matematika/Bahasa Indonesia. */
  allowFilterSwitch?: boolean;
  /** Callback jika filter jenjang/mapel berubah, agar parent bisa memuat data sekolah yang relevan. */
  onFilterChange?: (filter: { jenjang: JenjangResmi; mapelKey: MapelKey }) => void;
}

export function KemendikdasmenDayaSerapView({
  initialJenjang = "SMP",
  initialMapel = "bahasa-indonesia",
  namaSekolah,
  schoolScores,
  allowFilterSwitch = true,
  onFilterChange,
}: KemendikdasmenDayaSerapViewProps) {
  const [jenjang, setJenjang] = useState<JenjangResmi>(initialJenjang);
  const [mapelKey, setMapelKey] = useState<MapelKey>(initialMapel);
  const [selectedSoal, setSelectedSoal] = useState<ContohSoalItem | null>(null);
  const [tahunPelajaran, setTahunPelajaran] = useState("2025/2026");
  const [statusSekolahFilter, setStatusSekolahFilter] = useState("semua");

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

  // ID unik untuk aksesibilitas modal
  const modalTitleId = useId();

  return (
    <div className="flex flex-col gap-6 font-sans text-slate-800">
      {/* ------------------------------------------------------------- */}
      {/* 1. FILTER CONTROLS & INFORMASI FILTER (SEPERTI GAMBAR 1 & 4) */}
      {/* ------------------------------------------------------------- */}
      {allowFilterSwitch && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Layers className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-semibold text-slate-900">Filter Analisis Daya Serap</h2>
            </div>
            <span className="text-xs text-slate-400">Standar Resmi Pusmendik Kemendikdasmen RI</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <label htmlFor="filterTahun" className="mb-1 block text-xs font-medium text-slate-500">
                Tahun Pelajaran
              </label>
              <select
                id="filterTahun"
                value={tahunPelajaran}
                onChange={(e) => setTahunPelajaran(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="2025/2026">2025/2026</option>
                <option value="2024/2025">2024/2025</option>
              </select>
            </div>

            <div>
              <label htmlFor="filterJenjang" className="mb-1 block text-xs font-medium text-slate-500">
                Jenjang Pendidikan
              </label>
              <select
                id="filterJenjang"
                value={jenjang}
                onChange={(e) => handleJenjangChange(e.target.value as JenjangResmi)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="SD">SD (Sekolah Dasar)</option>
                <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
              </select>
            </div>

            <div>
              <label htmlFor="filterMapel" className="mb-1 block text-xs font-medium text-slate-500">
                Mata Pelajaran
              </label>
              <select
                id="filterMapel"
                value={mapelKey}
                onChange={(e) => handleMapelChange(e.target.value as MapelKey)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="bahasa-indonesia">Bahasa Indonesia</option>
                <option value="matematika">Matematika</option>
              </select>
            </div>

            <div>
              <label htmlFor="filterStatus" className="mb-1 block text-xs font-medium text-slate-500">
                Status Sekolah
              </label>
              <select
                id="filterStatus"
                value={statusSekolahFilter}
                onChange={(e) => setStatusSekolahFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="semua">Negeri + Swasta</option>
                <option value="negeri">Negeri</option>
                <option value="swasta">Swasta</option>
              </select>
            </div>
          </div>

          {/* Informasi Filter Box (identik baris biru tipis pada Gambar 1 & 4) */}
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 text-xs text-slate-600">
            <p className="mb-1 font-semibold text-blue-900">ℹ Informasi Filter Aktif:</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              <div>
                <span className="text-slate-400">Wilayah:</span>{" "}
                <span className="font-medium text-slate-700">{namaSekolah ? "Sekolah + Nasional" : "Nasional"}</span>
              </div>
              <div>
                <span className="text-slate-400">Jenjang:</span>{" "}
                <span className="font-medium text-slate-700">{jenjang}</span>
              </div>
              <div>
                <span className="text-slate-400">Mata Pelajaran:</span>{" "}
                <span className="font-medium text-slate-700">{namaMapel}</span>
              </div>
              <div>
                <span className="text-slate-400">Status Sekolah:</span>{" "}
                <span className="font-medium text-slate-700">
                  {statusSekolahFilter === "semua" ? "Negeri + Swasta" : statusSekolahFilter}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. CARD BANNER BIRU CAPAIAN NASIONAL (SEPERTI GAMBAR 1 & 4)   */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-5 text-white shadow-md sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-200" />
            <h1 className="text-lg font-bold sm:text-xl">
              Persentase Capaian Nasional - {namaMapel} ({jenjang})
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-blue-100">
            Tingkat Nasional {namaSekolah ? `· Pembanding Rujukan untuk ${namaSekolah}` : "· Data Resmi Kemendikdasmen"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 backdrop-blur-xs border border-white/20">
            <School className="h-4 w-4 text-sky-200" />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-blue-200">Sekolah</p>
              <p className="font-mono text-sm font-bold text-white">{totalSekolah.toLocaleString("id-ID")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 backdrop-blur-xs border border-white/20">
            <Users className="h-4 w-4 text-emerald-200" />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-blue-200">Peserta</p>
              <p className="font-mono text-sm font-bold text-white">{totalPeserta.toLocaleString("id-ID")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. SECTION RINGKASAN PER KOMPETENSI / ELEMEN (GAMBAR 1 & 4)   */}
      {/* ------------------------------------------------------------- */}
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

      {/* ------------------------------------------------------------- */}
      {/* 4. SECTION GRAFIK PER KOMPETENSI / ELEMEN (GAMBAR 2 & 4)      */}
      {/* ------------------------------------------------------------- */}
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

        {/* Visual Bar Chart Identik Kemendikdasmen (Nilai tampil di atas batang) */}
        <div className="relative pt-6">
          {/* Garis Horizontal Persentase 0, 20, 40, 60, 80, 100 */}
          <div className="absolute inset-x-0 top-6 bottom-16 flex flex-col justify-between pointer-events-none text-[10px] text-slate-300">
            {[100, 80, 60, 40, 20, 0].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <span className="w-6 text-right font-mono">{step}</span>
                <div className="h-px w-full bg-slate-100" />
              </div>
            ))}
          </div>

          {/* Kolom Batang per Kompetensi/Elemen */}
          <div className="relative ml-8 grid grid-flow-col auto-cols-fr gap-4 sm:gap-8 pt-4 pb-2 items-end h-64">
            {grafikData.map((g) => {
              const heightNasional = Math.max(4, Math.min(100, g.nasional));
              const heightSekolah = typeof g.sekolah === "number" ? Math.max(4, Math.min(100, g.sekolah)) : null;

              return (
                <div key={g.nama} className="group relative flex flex-col items-center h-full justify-end">
                  {/* Angka di atas batang */}
                  <div className="mb-1.5 font-mono text-xs font-bold text-blue-700 transition group-hover:scale-105">
                    {g.nasional.toFixed(2)}%
                  </div>

                  {/* Batang Biru Kemendikdasmen */}
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

                  {/* Label Nama di bawah batang */}
                  <div className="mt-3 text-center text-xs font-medium text-slate-700 line-clamp-2 w-full px-1">
                    {g.nama}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. SECTION HIERARKI DETAIL (PERSIS SEPERTI GAMBAR 3 & 5)      */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              ⚙️ Hierarki Detail
            </h2>
            <p className="text-xs text-slate-500">
              Total Peserta: Nasional ({totalPeserta.toLocaleString("id-ID")})
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 font-mono text-xs font-semibold text-blue-800">
            {isMatematika ? "4 Tingkat (Elemen > Subelemen > Kompetensi > Indikator)" : "3 Tingkat (Kompetensi > Subkompetensi > Indikator)"}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-200">
                <th className="px-4 py-3.5 uppercase tracking-wider">HIERARKI</th>
                <th className="px-4 py-3.5 text-right uppercase tracking-wider w-40 sm:w-48">
                  NASIONAL ({totalPeserta.toLocaleString("id-ID")})
                </th>
                {showSchoolColumn && (
                  <th className="px-4 py-3.5 text-right uppercase tracking-wider w-36 sm:w-44 text-emerald-900">
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
                // Penataan styling indentasi sesuai kedalaman hierarki (Gambar 3 & 5)
                const isLevel1 = row.level === 1;
                const isLevel2 = row.level === 2;
                const isLevel3 = row.level === 3;
                const isLevel4 = row.level === 4;

                let rowBg = "bg-white hover:bg-slate-50/70";
                let textClass = "text-slate-700";
                let indentClass = "pl-4";

                if (isLevel1) {
                  rowBg = "bg-blue-50/40 hover:bg-blue-50/60 font-bold border-t border-slate-200";
                  textClass = "text-slate-900 font-bold";
                  indentClass = "pl-4";
                } else if (isLevel2) {
                  textClass = "text-slate-800 font-medium";
                  indentClass = "pl-8 sm:pl-10";
                } else if (isLevel3) {
                  if (isMatematika) {
                    textClass = "text-slate-800 font-normal leading-relaxed text-xs";
                    indentClass = "pl-12 sm:pl-16";
                  } else {
                    // Di Bahasa Indonesia, level 3 adalah Indikator (leaf)
                    textClass = "text-slate-700 leading-snug text-xs";
                    indentClass = "pl-12 sm:pl-16";
                  }
                } else if (isLevel4) {
                  // Di Matematika, level 4 adalah Indikator (leaf)
                  textClass = "text-slate-700 leading-snug text-xs";
                  indentClass = "pl-16 sm:pl-24";
                }

                return (
                  <tr key={row.id} className={`${rowBg} ${indentClass} transition-colors`}>
                    <td className={`py-2.5 pr-4 ${indentClass} ${textClass}`}>
                      {row.teks}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-800">
                      {row.nilaiNasional ? `${row.nilaiNasional.toFixed(2)}%` : "–"}
                    </td>
                    {showSchoolColumn && (
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-emerald-700">
                        {typeof row.sekolahNilai === "number" ? `${row.sekolahNilai.toFixed(2)}%` : "–"}
                      </td>
                    )}
                    <td className="px-4 py-2 text-center">
                      {row.hasContohSoal && row.contohSoal ? (
                        <button
                          type="button"
                          onClick={() => setSelectedSoal(row.contohSoal || null)}
                          className="inline-flex items-center gap-1 rounded-md border border-pink-200 bg-pink-50 px-2.5 py-1 text-xs font-semibold text-pink-700 transition hover:bg-pink-100 hover:text-pink-800 active:scale-95 shadow-2xs cursor-pointer"
                        >
                          <BookOpen className="h-3 w-3" />
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

      {/* ------------------------------------------------------------- */}
      {/* 6. MODAL INTERAKTIF CONTOH SOAL (POPUP SAAT KLIK LIHAT SOAL)  */}
      {/* ------------------------------------------------------------- */}
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
