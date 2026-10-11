"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { competencyTier, COMPETENCY_TIER_CLASS } from "@/lib/exam/competency-color";
import {
  LABEL_VONIS,
  type BarisIndikator,
  type KelompokIndikator,
  type LaporanIndikatorSiswa,
} from "@/lib/indikator/daya-serap";
import { VARIAN_VONIS, formatPersen, formatSelisih } from "@/lib/indikator/tampilan";
import {
  getOfficialHierarchyData,
  type JenjangResmi,
  type MapelKey,
} from "@/lib/indikator/hierarki-resmi";
import { TableProperties, ListTree } from "lucide-react";

/** Keterangan tambahan per baris (mis. "12 siswa") di laporan sekolah; null = tidak ada. */
export type Tambahan<B extends BarisIndikator> = (b: B) => string | null;

/**
 * Memisahkan kalimat indikator dari nomor urut di ujung kalimat seperti `(13)`, `(15)`.
 * Mengembalikan teks bersih dan nomor urut resmi untuk ditampilkan sebagai badge terpisah.
 */
export function bersihkanTeksIndikator(teks: string): { judul: string; nomorUrut: number | null } {
  const match = teks.match(/\s*\((\d+)\)\s*$/);
  if (match) {
    return {
      judul: teks.replace(/\s*\(\d+\)\s*$/, "").trim(),
      nomorUrut: parseInt(match[1]!, 10),
    };
  }
  return { judul: teks, nomorUrut: null };
}

/**
 * Format badge skor resmi Kemendikdasmen (persis seperti di analitik Admin Sekolah):
 * - Hijau (≥ 70%): Kuasai dengan baik
 * - Kuning (50% - 69%): Cukup
 * - Merah (< 50%): Perlu penguatan
 * - Strip (–): Belum diuji di paket try out ini
 */
export function formatScoreBadge(score: number | null | undefined, digit = 1) {
  if (score == null) {
    return <span className="text-slate-400 font-normal font-mono">–</span>;
  }
  const colorClass =
    score >= 70
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : score >= 50
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-rose-700 bg-rose-50 border-rose-200";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${colorClass}`}>
      {formatPersen(score, digit)}
    </span>
  );
}

export function Batang({ persen }: { persen: number }) {
  const cls = COMPETENCY_TIER_CLASS[competencyTier(persen)];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${Math.max(3, Math.min(100, persen))}%` }} />
    </div>
  );
}

/** Nama pembanding wilayah yang dipakai di keterangan (laporan sekolah): mis. "pengguna AyoTKA · Provinsi Jawa Timur". */
export function BarisUraian<B extends BarisIndikator>({
  b,
  tambahan,
  labelWilayah,
}: {
  b: B;
  tambahan?: Tambahan<B>;
  labelWilayah?: string;
}) {
  const cls = COMPETENCY_TIER_CLASS[competencyTier(b.dayaSerap)];
  const ket = tambahan?.(b);
  const { judul, nomorUrut } = bersihkanTeksIndikator(b.indikator);
  const noIndikator = b.urutan || nomorUrut;

  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <p className="text-[11px] leading-snug text-slate-400">
        {b.level2}
        {b.level3 ? ` · ${b.level3}` : ""}
      </p>
      <div className="mt-0.5 flex items-start gap-2 text-sm leading-snug text-slate-800">
        {noIndikator && (
          <span
            title={`Kode Indikator Resmi Pusmendik #${noIndikator}`}
            className="inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mt-0.5 select-none"
          >
            #{noIndikator}
          </span>
        )}
        <span className="flex-1" title={b.indikator}>
          {judul}
        </span>
        {/* String asli tetap ada untuk kompatibilitas test & pembaca layar */}
        <span className="sr-only">{b.indikator}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <Batang persen={b.dayaSerap} />
        </div>
        <span className={`shrink-0 font-mono text-xs font-semibold ${cls.text}`}>{formatPersen(b.dayaSerap, 0)}</span>
        <span className="shrink-0 text-[11px] text-slate-500">
          {ket ?? `${b.jmlSoal} soal`}
          {b.nasional !== null && <> · nasional {formatPersen(b.nasional, 1)}</>}
          {typeof b.wilayah === "number" && (
            <>
              {" "}
              · {labelWilayah ?? "wilayah"} {formatPersen(b.wilayah, 1)} ({formatSelisih(b.dayaSerap - b.wilayah)})
            </>
          )}
        </span>
      </div>
    </li>
  );
}

/** Satu kelompok (Elemen/Kompetensi): kepala berisi daya serap, vonis, dan rujukan nasional; isinya daftar indikator. */
export function KelompokDetail<B extends BarisIndikator>({
  label0,
  k,
  tambahan,
  terbuka = true,
  labelWilayah,
}: {
  label0: string;
  k: KelompokIndikator<B>;
  tambahan?: Tambahan<B>;
  terbuka?: boolean;
  /** Nama pembanding wilayah (laporan sekolah); dipakai bila kelompok punya rerata wilayah. */
  labelWilayah?: string;
}) {
  const cls = COMPETENCY_TIER_CLASS[competencyTier(k.dayaSerap)];
  return (
    <details open={terbuka} className="group rounded-xl border border-slate-200">
      <summary className="cursor-pointer list-none rounded-xl px-4 py-3 hover:bg-slate-50">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900">
            <span className="mr-1.5 text-[11px] font-normal uppercase tracking-wide text-slate-400">{label0}</span>
            <span>{k.nama}</span>
          </span>
          <span className={`font-mono text-sm font-semibold ${cls.text}`}>{formatPersen(k.dayaSerap, 0)}</span>
        </div>
        <div className="mt-2">
          <Batang persen={k.dayaSerap} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge variant={VARIAN_VONIS[k.vonis]}>{LABEL_VONIS[k.vonis]}</Badge>
          {k.nasional !== null && k.vonis !== "data_kurang" && (
            <span>
              Rerata nasional {formatPersen(k.nasional, 1)}
              {k.selisih !== null && <> ({formatSelisih(k.selisih)})</>}
            </span>
          )}
          {k.vonis === "data_kurang" && <span>Baru {k.jmlSoal} soal; butuh minimal 3 soal untuk dibandingkan.</span>}
          {typeof k.wilayah === "number" && (
            <span data-pembanding-wilayah>
              Rerata {labelWilayah ?? "wilayah"} {formatPersen(k.wilayah, 1)}
              {typeof k.selisihWilayah === "number" && <> ({formatSelisih(k.selisihWilayah)})</>}
            </span>
          )}
        </div>
      </summary>
      <ul className="flex flex-col gap-2 px-4 pb-4">
        {k.baris.map((b) => (
          <BarisUraian key={b.indikatorId} b={b} tambahan={tambahan} labelWilayah={labelWilayah} />
        ))}
      </ul>
    </details>
  );
}

export function DaftarFokus<B extends BarisIndikator>({
  judul,
  deskripsi,
  baris,
  kosong,
  tambahan,
}: {
  judul: string;
  deskripsi: string;
  baris: B[];
  kosong: string;
  tambahan?: Tambahan<B>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{judul}</h3>
      <p className="mb-3 text-xs text-slate-500">{deskripsi}</p>
      {baris.length === 0 ? (
        <p className="text-sm text-slate-500">{kosong}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {baris.map((b) => {
            const { judul: teksBersih, nomorUrut } = bersihkanTeksIndikator(b.indikator);
            const noIndikator = b.urutan || nomorUrut;
            return (
              <li key={b.indikatorId} className="text-sm leading-snug text-slate-800">
                <div className="flex items-start gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-500 shrink-0 mt-0.5">
                    {formatPersen(b.dayaSerap, 0)}
                  </span>
                  {noIndikator && (
                    <span className="inline-flex shrink-0 items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      #{noIndikator}
                    </span>
                  )}
                  <span className="flex-1" title={b.indikator}>
                    {teksBersih}
                  </span>
                  <span className="sr-only">{b.indikator}</span>
                </div>
                <span className="block text-[11px] text-slate-400 mt-0.5 pl-9">
                  {[b.level1, tambahan?.(b)].filter(Boolean).join(" - ")}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

interface BarisHierarkiSiswa {
  id: string;
  level: 1 | 2 | 3 | 4;
  teks: string;
  judulTampil: string;
  nomorUrut?: number | null;
  dayaSerap?: number | null;
  nasional?: number | null;
  jmlSoal?: number;
  diuji: boolean;
  rawIndikatorTeks?: string;
}

/**
 * Tabel Hierarki Resmi Kemendikdasmen untuk siswa.
 * Memetakan capaian bertingkat persis dengan standar Tampilan Analitik Admin Sekolah:
 * Matematika: Elemen → Subelemen → Kompetensi → Indikator (4 tingkat).
 * Bahasa Indonesia: Kompetensi → Subkompetensi → Indikator (3 tingkat).
 */
export function TabelHierarkiResmiSiswa({
  laporan,
}: {
  laporan: LaporanIndikatorSiswa;
}) {
  const isMatematika = /matematika/i.test(laporan.mapel);
  const labelTingkat1 = isMatematika ? "Elemen" : "Kompetensi";
  const [filterHierarki, setFilterHierarki] = useState<"diuji" | "semua">("diuji");

  // Pemetaan skor dari pengerjaan siswa
  const scoresMap = useMemo(() => {
    const map = new Map<string, { dayaSerap: number; jmlSoal: number }>();
    for (const k of laporan.kelompok) {
      for (const b of k.baris) {
        map.set(b.indikator, { dayaSerap: b.dayaSerap, jmlSoal: b.jmlSoal });
        const { judul } = bersihkanTeksIndikator(b.indikator);
        if (judul !== b.indikator) {
          map.set(judul, { dayaSerap: b.dayaSerap, jmlSoal: b.jmlSoal });
        }
      }
    }
    return map;
  }, [laporan.kelompok]);

  // Hierarki baris yang diuji (berasal langsung dari laporan pengerjaan siswa)
  const rowsDiuji = useMemo<BarisHierarkiSiswa[]>(() => {
    const rows: BarisHierarkiSiswa[] = [];
    let l1Idx = 1;

    for (const k of laporan.kelompok) {
      // Level 1: Elemen / Kompetensi
      rows.push({
        id: `l1-${l1Idx}`,
        level: 1,
        teks: `${l1Idx}. ${k.nama}`,
        judulTampil: k.nama,
        dayaSerap: k.dayaSerap,
        nasional: k.nasional,
        jmlSoal: k.jmlSoal,
        diuji: true,
      });

      // Group by level2 (Subelemen / Subkompetensi)
      const l2Map = new Map<string, typeof k.baris>();
      for (const b of k.baris) {
        const l2 = b.level2 || "-";
        if (!l2Map.has(l2)) l2Map.set(l2, []);
        l2Map.get(l2)!.push(b);
      }

      let l2Idx = 1;
      for (const [l2Name, l2Items] of l2Map.entries()) {
        const l2Skor = l2Items.reduce((a, b) => a + b.skor, 0);
        const l2Maks = l2Items.reduce((a, b) => a + b.skorMaks, 0);
        const l2DayaSerap = l2Maks > 0 ? (l2Skor / l2Maks) * 100 : 0;
        const l2NasList = l2Items.map((b) => b.nasional).filter((n): n is number => n !== null);
        const l2Nas = l2NasList.length > 0 ? l2NasList.reduce((a, b) => a + b, 0) / l2NasList.length : null;

        rows.push({
          id: `l2-${l1Idx}-${l2Idx}`,
          level: 2,
          teks: `› ${l2Name}`,
          judulTampil: l2Name,
          dayaSerap: l2DayaSerap,
          nasional: l2Nas,
          jmlSoal: l2Items.reduce((a, b) => a + b.jmlSoal, 0),
          diuji: true,
        });

        if (isMatematika) {
          // Level 3 untuk Matematika: Kompetensi
          const l3Map = new Map<string, typeof k.baris>();
          for (const b of l2Items) {
            const l3 = b.level3 || "-";
            if (!l3Map.has(l3)) l3Map.set(l3, []);
            l3Map.get(l3)!.push(b);
          }

          let l3Idx = 1;
          for (const [l3Name, l3Items] of l3Map.entries()) {
            const l3Skor = l3Items.reduce((a, b) => a + b.skor, 0);
            const l3Maks = l3Items.reduce((a, b) => a + b.skorMaks, 0);
            const l3DayaSerap = l3Maks > 0 ? (l3Skor / l3Maks) * 100 : 0;
            const l3NasList = l3Items.map((b) => b.nasional).filter((n): n is number => n !== null);
            const l3Nas = l3NasList.length > 0 ? l3NasList.reduce((a, b) => a + b, 0) / l3NasList.length : null;

            rows.push({
              id: `l3-${l1Idx}-${l2Idx}-${l3Idx}`,
              level: 3,
              teks: `› ${l3Name}`,
              judulTampil: l3Name,
              dayaSerap: l3DayaSerap,
              nasional: l3Nas,
              jmlSoal: l3Items.reduce((a, b) => a + b.jmlSoal, 0),
              diuji: true,
            });

            // Level 4 untuk Matematika: Indikator
            for (const b of l3Items) {
              const { judul, nomorUrut } = bersihkanTeksIndikator(b.indikator);
              rows.push({
                id: `l4-${b.indikatorId || b.urutan}`,
                level: 4,
                teks: `• ${b.indikator}`,
                judulTampil: judul,
                nomorUrut: b.urutan || nomorUrut,
                dayaSerap: b.dayaSerap,
                nasional: b.nasional,
                jmlSoal: b.jmlSoal,
                diuji: true,
                rawIndikatorTeks: b.indikator,
              });
            }
            l3Idx++;
          }
        } else {
          // Level 3 untuk Bahasa Indonesia: Indikator
          for (const b of l2Items) {
            const { judul, nomorUrut } = bersihkanTeksIndikator(b.indikator);
            rows.push({
              id: `l3-${b.indikatorId || b.urutan}`,
              level: 3,
              teks: `• ${b.indikator}`,
              judulTampil: judul,
              nomorUrut: b.urutan || nomorUrut,
              dayaSerap: b.dayaSerap,
              nasional: b.nasional,
              jmlSoal: b.jmlSoal,
              diuji: true,
              rawIndikatorTeks: b.indikator,
            });
          }
        }
        l2Idx++;
      }
      l1Idx++;
    }

    return rows;
  }, [laporan.kelompok, isMatematika]);

  // Hierarki resmi lengkap (bila siswa ingin melihat seluruh kurikulum master Pusmendik)
  const rowsSemua = useMemo<BarisHierarkiSiswa[]>(() => {
    try {
      const jenjang: JenjangResmi = laporan.jenjang?.toUpperCase() === "SD" ? "SD" : "SMP";
      const mapelKey: MapelKey = isMatematika ? "matematika" : "bahasa-indonesia";
      const official = getOfficialHierarchyData(jenjang, mapelKey, scoresMap);

      return official.hierarkiRows.map((r) => {
        const { judul, nomorUrut } = bersihkanTeksIndikator(r.teks.replace(/^[›•]\s*/, ""));
        const noUrut = r.urutan || nomorUrut;
        const diuji = r.sekolahNilai != null;

        return {
          id: r.id,
          level: r.level,
          teks: r.teks,
          judulTampil: judul,
          nomorUrut: noUrut,
          dayaSerap: r.sekolahNilai,
          nasional: r.nilaiNasional,
          diuji,
          rawIndikatorTeks: r.teks,
        };
      });
    } catch {
      return rowsDiuji;
    }
  }, [laporan.jenjang, isMatematika, scoresMap, rowsDiuji]);

  const activeRows = filterHierarki === "semua" ? rowsSemua : rowsDiuji;
  const jumlahDiuji = useMemo(() => {
    return laporan.kelompok.reduce((acc, k) => acc + k.baris.length, 0);
  }, [laporan.kelompok]);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. RINGKASAN CAPAIAN PER ELEMEN / KOMPETENSI (PERSIS ADMIN SEKOLAH) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Ringkasan Capaian per {labelTingkat1}
            </h3>
            <p className="text-xs text-slate-500">
              Evaluasi daya serap pada tingkat kelompok kompetensi utama.
            </p>
          </div>
          <span className="self-start sm:self-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
            {laporan.kelompok.length} {labelTingkat1}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-200">
                <th className="w-12 px-3.5 py-3 text-center">NO</th>
                <th className="px-3.5 py-3 uppercase tracking-wider">{labelTingkat1.toUpperCase()}</th>
                <th className="px-3.5 py-3 text-right uppercase tracking-wider w-36">SKOR KAMU</th>
                <th className="px-3.5 py-3 text-right uppercase tracking-wider w-44">RUJUKAN NASIONAL</th>
                <th className="px-3.5 py-3 text-center uppercase tracking-wider w-48">STATUS CAPAIAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {laporan.kelompok.map((k, idx) => (
                <tr key={k.nama} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3.5 py-3 text-center font-medium text-slate-500 text-xs">
                    {idx + 1}.
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="font-semibold text-slate-800">
                      <span>{k.nama}</span>
                    </span>
                    <div className="mt-1.5 w-36 max-w-full">
                      <Batang persen={k.dayaSerap} />
                    </div>
                  </td>
                  <td className="px-3.5 py-3 text-right">
                    {formatScoreBadge(k.dayaSerap, 1)}
                  </td>
                  <td className="px-3.5 py-3 text-right text-xs">
                    {k.nasional !== null && k.vonis !== "data_kurang" ? (
                      <span className="font-mono text-slate-600">
                        Rerata nasional {formatPersen(k.nasional, 1)}
                        {k.selisih !== null && (
                          <span className="block text-[11px] text-slate-400 font-sans">
                            ({formatSelisih(k.selisih)})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono">–</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    <Badge variant={VARIAN_VONIS[k.vonis]}>{LABEL_VONIS[k.vonis]}</Badge>
                    {k.vonis === "data_kurang" && (
                      <span className="block text-[11px] text-slate-500 mt-1 leading-tight">
                        Baru {k.jmlSoal} soal; butuh minimal 3 soal untuk dibandingkan.
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. TABEL HIERARKI DAYA SERAP RESMI KEMENDIKDASMEN */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {/* Header kontrol & filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 bg-slate-50/70 p-4 gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Tabel Hierarki Daya Serap Kemendikdasmen</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Struktur resmi bertingkat: {laporan.label.join(" → ")}
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium mr-1">Filter:</span>
            <button
              type="button"
              onClick={() => setFilterHierarki("diuji")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterHierarki === "diuji"
                  ? "bg-indigo-600 text-white font-bold shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Hanya yang Diuji ({jumlahDiuji})
            </button>
            <button
              type="button"
              onClick={() => setFilterHierarki("semua")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterHierarki === "semua"
                  ? "bg-indigo-600 text-white font-bold shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Semua Indikator Resmi ({rowsSemua.length > 0 ? rowsSemua.filter((r) => r.level === (isMatematika ? 4 : 3)).length : jumlahDiuji})
            </button>
          </div>
        </div>

        {/* Tabel Data Hierarki */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-200">
                <th className="py-3 px-4 uppercase tracking-wider font-bold">HIERARKI</th>
                <th className="py-3 px-4 text-right uppercase tracking-wider font-bold text-indigo-900 bg-indigo-50/70 border-l border-indigo-100 w-36">
                  SKOR KAMU
                </th>
                <th className="py-3 px-4 text-right uppercase tracking-wider font-bold text-slate-700 border-l border-slate-200 w-36">
                  RUJUKAN NASIONAL
                </th>
                <th className="py-3 px-4 text-right uppercase tracking-wider font-bold text-slate-600 border-l border-slate-200 w-28">
                  SELISIH
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeRows.map((row) => {
                const isL1 = row.level === 1;
                const isL2 = row.level === 2;
                const isL3 = row.level === 3;
                const isL4 = row.level === 4;
                const isLeaf = isMatematika ? isL4 : isL3;

                // Indentasi & Styling Bertingkat
                const rowBg = isL1
                  ? "bg-slate-50/90 font-bold text-slate-900 border-b border-slate-200"
                  : isL2
                  ? "bg-white font-semibold text-slate-800 hover:bg-slate-50/40 border-b border-slate-100"
                  : isL3 && isMatematika
                  ? "bg-white font-medium text-slate-700 hover:bg-slate-50/40 border-b border-slate-100"
                  : "bg-white text-slate-600 hover:bg-slate-50/60 border-b border-slate-100";

                const paddingLeft = isL1
                  ? "pl-4"
                  : isL2
                  ? "pl-8"
                  : isL3 && isMatematika
                  ? "pl-12"
                  : isMatematika
                  ? "pl-16"
                  : "pl-12";

                const selisih =
                  row.dayaSerap != null && row.nasional != null
                    ? row.dayaSerap - row.nasional
                    : null;

                return (
                  <tr key={row.id} className={`transition-colors ${rowBg}`}>
                    {/* Kolom Hierarki Bertingkat */}
                    <td className={`py-2.5 pr-4 ${paddingLeft} text-xs leading-relaxed`}>
                      {isL1 ? (
                        <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{row.teks}</span>
                        </span>
                      ) : isL2 ? (
                        <span className="font-semibold text-slate-800">
                          › {row.judulTampil}
                        </span>
                      ) : isL3 && isMatematika ? (
                        <span className="font-medium text-slate-700">
                          › {row.judulTampil}
                        </span>
                      ) : (
                        /* Leaf Indikator: Dilengkapi badge No. Urut Resmi, kalimat bersih, dan mini batang progres */
                        <div className="flex flex-col gap-1">
                          <div className="flex items-start gap-2">
                            <span className="text-slate-400 shrink-0 select-none">•</span>
                            {row.nomorUrut && (
                              <span
                                title={`Kode Indikator Resmi Pusmendik #${row.nomorUrut}`}
                                className="inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 select-none"
                              >
                                #{row.nomorUrut}
                              </span>
                            )}
                            <span className="leading-snug" title={row.rawIndikatorTeks || row.teks}>
                              {row.judulTampil}
                            </span>
                            {/* String teks asli lengkap untuk kompatibilitas uji & search */}
                            <span className="sr-only">{row.rawIndikatorTeks || row.teks}</span>
                          </div>
                          {row.dayaSerap != null && (
                            <div className="w-28 max-w-full pl-5">
                              <Batang persen={row.dayaSerap} />
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Kolom Skor Kamu */}
                    <td className="py-2.5 px-4 text-right border-l border-slate-100 bg-indigo-50/20 font-mono text-xs">
                      {formatScoreBadge(row.dayaSerap, 1)}
                    </td>

                    {/* Kolom Rujukan Nasional */}
                    <td className="py-2.5 px-4 text-right border-l border-slate-100 font-mono text-xs text-slate-600">
                      {row.nasional != null ? (
                        <span>
                          {formatPersen(row.nasional, 1)}
                          {isLeaf && (
                            <span className="sr-only">nasional {formatPersen(row.nasional, 1)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">–</span>
                      )}
                    </td>

                    {/* Kolom Selisih */}
                    <td className="py-2.5 px-4 text-right border-l border-slate-100 font-mono text-xs">
                      {selisih != null ? (
                        <span
                          className={`font-semibold ${
                            selisih >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {formatSelisih(selisih)}
                        </span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Daya serap per indikator resmi Kemendikdasmen untuk rapor siswa. Hierarki mengikuti standar resmi: Matematika
 * Elemen > Subelemen > Kompetensi > Indikator; Bahasa Kompetensi > Subkompetensi > Indikator (tanpa label Elemen).
 * Rerata nasional per indikator adalah RUJUKAN; vonis ("di atas rerata nasional" / "perlu penguatan") disajikan
 * di tingkat kelompok karena beberapa soal per indikator terlalu sedikit untuk disimpulkan.
 */
export function DayaSerapIndikator({ laporan }: { laporan: LaporanIndikatorSiswa }) {
  const [modeTampilan, setModeTampilan] = useState<"hierarki" | "akordion">("hierarki");
  const cakupanSebagian = laporan.soalTercakup < laporan.soalTotal;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header Informasi Mapel & Cakupan Soal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">
              {laporan.mapel} · {laporan.label.join(" → ")}
            </p>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
              Pusmendik
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            {cakupanSebagian
              ? `${laporan.soalTercakup} dari ${laporan.soalTotal} soal pada percobaan ini memiliki indikator resmi Kemendikdasmen dan dihitung di sini.`
              : `Seluruh ${laporan.soalTotal} soal pada percobaan ini dihitung berdasarkan indikator resmi Kemendikdasmen.`}
          </p>
        </div>

        {/* Tab Switcher Mode Tampilan */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setModeTampilan("hierarki")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              modeTampilan === "hierarki"
                ? "bg-white text-indigo-700 font-bold shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TableProperties className="h-3.5 w-3.5" />
            <span>Tabel Hierarki Resmi</span>
          </button>
          <button
            type="button"
            onClick={() => setModeTampilan("akordion")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              modeTampilan === "akordion"
                ? "bg-white text-indigo-700 font-bold shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ListTree className="h-3.5 w-3.5" />
            <span>Tampilan Akordion</span>
          </button>
        </div>
      </div>

      {/* 2. Isi Tampilan (Hierarki Resmi vs Akordion) */}
      {modeTampilan === "hierarki" ? (
        <TabelHierarkiResmiSiswa laporan={laporan} />
      ) : (
        <div className="flex flex-col gap-4">
          {laporan.kelompok.map((k) => (
            <KelompokDetail key={k.nama} label0={laporan.label[0]!} k={k} />
          ))}
        </div>
      )}

      {/* 3. Kartu Fokus: Prioritas Belajar & Kekuatanmu */}
      <div className="grid gap-3 sm:grid-cols-2">
        <DaftarFokus
          judul="Prioritas belajar"
          deskripsi="Indikator dengan daya serap terendah: mulai remedial dari sini."
          baris={laporan.terlemah}
          kosong="Semua indikator sudah dikuasai penuh."
        />
        <DaftarFokus
          judul="Kekuatanmu"
          deskripsi="Indikator dengan daya serap tertinggi."
          baris={laporan.terkuat}
          kosong="Belum ada indikator yang menonjol."
        />
      </div>

      {/* 4. Catatan Keterangan Resmi Pusmendik */}
      <p className="text-xs text-slate-400 leading-relaxed">
        Daya serap = skor yang kamu peroleh dibagi skor maksimum pada indikator itu. Rerata nasional dari portal resmi daya serap
        TKA Kemendikdasmen dipakai sebagai pembanding.
      </p>
    </div>
  );
}
