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
import { CatatanRujukanNasional } from "@/components/hasil/catatan-rujukan-nasional";

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
  // Nomor urut indikator resmi (mis. "(13)" di ujung kalimat) sengaja tidak ditampilkan: terbaca seperti nomor soal.
  const { judul } = bersihkanTeksIndikator(b.indikator);

  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <p className="text-[11px] leading-snug text-slate-400">
        {b.level2}
        {b.level3 ? ` · ${b.level3}` : ""}
      </p>
      <div className="mt-0.5 flex items-start gap-2 text-sm leading-snug text-slate-800">
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
            const { judul: teksBersih } = bersihkanTeksIndikator(b.indikator);
            return (
              <li key={b.indikatorId} className="text-sm leading-snug text-slate-800">
                <div className="flex items-start gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-500 shrink-0 mt-0.5">
                    {formatPersen(b.dayaSerap, 0)}
                  </span>
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
  /** Skor yang diperoleh dan skor maksimum pada simpul ini (untuk "x/y benar"); tidak ada pada indikator yang belum diuji. */
  skor?: number;
  skorMaks?: number;
  diuji: boolean;
  rawIndikatorTeks?: string;
}

/**
 * Keterangan jumlah soal di bawah skor. Penilaian tidak pernah pecahan (bobot penuh bila benar, 0 bila salah), jadi bila
 * semua soal berbobot sama (skor maksimum = jumlah soal) skor sama dengan jumlah soal yang benar: "10/12 benar", seperti
 * Peta Kompetensi lama. Bila bobotnya berbeda, jumlah benar tidak bisa diturunkan dari skor, jadi cukup "N soal".
 */
export function ringkasanSoal(row: { jmlSoal?: number; skor?: number; skorMaks?: number }): string | null {
  const { jmlSoal, skor, skorMaks } = row;
  if (!jmlSoal || jmlSoal <= 0) return null;
  if (skor != null && skorMaks === jmlSoal && Number.isInteger(skor)) return `${skor}/${jmlSoal} benar`;
  return `${jmlSoal} soal`;
}

/**
 * Satu-satunya tabel capaian di rapor web siswa (menggantikan Peta Kompetensi, ringkasan per elemen, tabel hierarki, dan
 * tampilan akordion yang dulu mengulang angka yang sama): hierarki resmi Kemendikdasmen dengan skor, rujukan nasional,
 * dan selisih. Baris tingkat pertama membawa vonis dibanding rerata nasional.
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
        skor: k.skor,
        skorMaks: k.skorMaks,
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
          skor: l2Skor,
          skorMaks: l2Maks,
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
              skor: l3Skor,
              skorMaks: l3Maks,
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
                skor: b.skor,
                skorMaks: b.skorMaks,
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
              skor: b.skor,
              skorMaks: b.skorMaks,
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

  const kelompokPerNama = new Map(laporan.kelompok.map((k) => [k.nama, k] as const));
  const jumlahIndikatorResmi =
    rowsSemua.length > 0 ? rowsSemua.filter((r) => r.level === (isMatematika ? 4 : 3)).length : jumlahDiuji;
  const pilihanFilter = [
    { nilai: "diuji", label: `Hanya yang Diuji (${jumlahDiuji})` },
    { nilai: "semua", label: `Semua Indikator Resmi (${jumlahIndikatorResmi})` },
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Indikator yang ditampilkan" className="flex flex-wrap items-center gap-1.5">
        {pilihanFilter.map((p) => (
          <button
            key={p.nilai}
            type="button"
            aria-pressed={filterHierarki === p.nilai}
            onClick={() => setFilterHierarki(p.nilai)}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
              filterHierarki === p.nilai
                ? "bg-indigo-600 text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* HP: tabel melebar sampai tepi kartu (-mx-4 = padding kartu p-4) supaya kolom teks tidak terlalu sempit; mulai layar
          sm kembali berbingkai membulat di dalam kartu. */}
      <div className="-mx-4 overflow-hidden border-y border-slate-200 bg-white sm:mx-0 sm:rounded-2xl sm:border sm:shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" data-tabel-capaian>
            <caption className="sr-only">
              Capaianmu per {laporan.label.join(" › ")}, dibandingkan dengan rujukan nasional
            </caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-xs font-bold text-slate-700">
                <th scope="col" className="px-3 py-3 font-bold uppercase tracking-wider sm:px-4">
                  Hierarki
                </th>
                <th
                  scope="col"
                  className="w-24 border-l border-indigo-100 bg-indigo-50/70 px-3 py-3 text-right font-bold uppercase tracking-wider text-indigo-900 sm:w-28"
                >
                  Skor kamu
                </th>
                <th
                  scope="col"
                  className="hidden w-36 border-l border-slate-200 px-4 py-3 text-right font-bold uppercase tracking-wider sm:table-cell"
                >
                  Rujukan nasional
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeRows.map((row) => {
                const isL1 = row.level === 1;
                const isL2 = row.level === 2;
                const isLeaf = isMatematika ? row.level === 4 : row.level === 3;
                // Kompetensi (tingkat 3 Matematika) adalah kalimat panjang: dibuat lebih kecil dan redup agar mata jatuh
                // ke Elemen dan indikatornya.
                const isKompetensi = isMatematika && row.level === 3;

                // Kelompok (Elemen) membawa vonis dibanding rerata nasional; kelompok dengan soal terlalu sedikit tidak
                // dibandingkan (aturan yang sama dengan tabel ringkasan lama).
                const kelompok = isL1 ? kelompokPerNama.get(row.judulTampil.replace(/^\s*\d+\.\s*/, "")) : undefined;
                const dibandingkan = kelompok?.vonis !== "data_kurang";
                const nasional = dibandingkan ? (row.nasional ?? null) : null;
                // Baris Elemen memakai selisih resmi kelompok (dihitung hanya pada indikator yang punya pembanding),
                // sama dengan tabel ringkasan lama; baris lain dihitung dari skor dan angka nasionalnya sendiri.
                const selisih =
                  nasional == null
                    ? null
                    : kelompok
                      ? kelompok.selisih
                      : row.dayaSerap != null
                        ? row.dayaSerap - nasional
                        : null;
                const keteranganSoal = ringkasanSoal(row);
                const warnaSelisih = selisih != null && selisih >= 0 ? "text-emerald-700" : "text-rose-700";

                const gaya = isL1
                  ? "border-b border-slate-200 bg-slate-50/90 font-bold text-slate-900"
                  : isL2
                    ? "bg-white font-semibold text-slate-800 hover:bg-slate-50/40"
                    : isKompetensi
                      ? "bg-white font-normal text-slate-500 hover:bg-slate-50/40"
                      : "bg-white text-slate-700 hover:bg-slate-50/60";
                // Indentasi dirapatkan di HP (ruang kolom Hierarki sangat terbatas di 320-360px): jenjang tetap terbaca dari
                // ukuran/bobot huruf, penanda "›" dan "•", serta batang pada baris indikator.
                const indentasi = isL1
                  ? "pl-3 sm:pl-4"
                  : isL2
                    ? "pl-4 sm:pl-7"
                    : row.level === 3
                      ? "pl-5 sm:pl-10"
                      : "pl-7 sm:pl-12";

                return (
                  <tr key={row.id} className={`transition-colors ${gaya}`} data-level={row.level}>
                    {/* overflow-wrap:anywhere (bukan break-words): kata panjang tanpa spasi seperti
                        "Menganalisis/mengevaluasi" tidak boleh memaksa kolom ini melebar sampai tabel menggulir ke samping di HP. */}
                    <td
                      className={`py-2.5 pr-3 align-top text-xs leading-relaxed [overflow-wrap:anywhere] ${indentasi} ${isKompetensi ? "text-[11.5px] leading-snug" : ""}`}
                    >
                      {isL1 ? (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-sm font-bold text-slate-900">{row.teks}</span>
                          {kelompok && (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-normal">
                              <Badge variant={VARIAN_VONIS[kelompok.vonis]}>{LABEL_VONIS[kelompok.vonis]}</Badge>
                              {kelompok.vonis === "data_kurang" && (
                                <span className="text-[11px] leading-tight text-slate-500">
                                  Baru {kelompok.jmlSoal} soal; butuh minimal 3 soal untuk dibandingkan.
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : isLeaf ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 select-none text-slate-400">•</span>
                            <span className="leading-snug" title={row.rawIndikatorTeks || row.teks}>
                              {row.judulTampil}
                            </span>
                            {/* String teks asli lengkap untuk kompatibilitas uji & pembaca layar */}
                            <span className="sr-only">{row.rawIndikatorTeks || row.teks}</span>
                          </div>
                          {/* Batang: w-full + max-w-28 (bukan w-28). Lebar tetap membuat kolom Hierarki tak bisa menyusut di HP kecil. */}
                          {row.dayaSerap != null && (
                            <div className="w-full max-w-28 pl-5">
                              <Batang persen={row.dayaSerap} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <span>› {row.judulTampil}</span>
                      )}
                    </td>

                    {/* Skor kamu. Di HP, rujukan nasional dan selisihnya ditumpuk di bawah skor (kolom ketiga baru
                        muncul mulai layar sm) supaya kolom Hierarki tidak menyempit. */}
                    <td className="border-l border-slate-100 bg-indigo-50/20 px-3 py-2.5 text-right align-top">
                      <div className="flex flex-col items-end gap-0.5">
                        {formatScoreBadge(row.dayaSerap, 1)}
                        {keteranganSoal && (
                          <span className="text-[11px] font-normal text-slate-500">{keteranganSoal}</span>
                        )}
                        {nasional != null && (
                          <span className="mt-0.5 text-[11px] font-normal leading-tight text-slate-500 sm:hidden">
                            Nasional {formatPersen(nasional, 1)}
                            {selisih != null && (
                              <span className={`block font-semibold ${warnaSelisih}`}>{formatSelisih(selisih)}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Rujukan nasional + selisih (layar sm ke atas) */}
                    <td className="hidden border-l border-slate-100 px-4 py-2.5 text-right align-top font-mono text-xs sm:table-cell">
                      {nasional != null ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-slate-700">
                            <span aria-hidden={isLeaf ? true : undefined}>{formatPersen(nasional, 1)}</span>
                            {isLeaf && <span className="sr-only">nasional {formatPersen(nasional, 1)}</span>}
                          </span>
                          {selisih != null && (
                            <span className={`text-[11px] font-semibold ${warnaSelisih}`}>{formatSelisih(selisih)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="font-normal text-slate-400">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <CatatanRujukanNasional className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5" />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-600" /> Baik (≥70%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-600" /> Cukup (50-69%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-600" /> Perlu latihan (&lt;50%)
        </span>
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
export function DayaSerapIndikator({
  laporan,
  tampilkanFokus = true,
}: {
  laporan: LaporanIndikatorSiswa;
  /**
   * false menyembunyikan kartu "Prioritas belajar" dan "Kekuatanmu": keduanya fitur berbayar, terbuka hanya bila siswa
   * punya jatah atau saldo Learning Analytics (lib/billing/fokus-belajar.ts). Bagian lain laporan tetap tampil.
   */
  tampilkanFokus?: boolean;
}) {
  const cakupanSebagian = laporan.soalTercakup < laporan.soalTotal;

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Keterangan mapel dan cakupan soal */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-800">
            {laporan.mapel} · {laporan.label.join(" → ")}
          </p>
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
            Pusmendik
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {cakupanSebagian
            ? `${laporan.soalTercakup} dari ${laporan.soalTotal} soal pada percobaan ini memiliki indikator resmi Kemendikdasmen dan dihitung di sini.`
            : `Seluruh ${laporan.soalTotal} soal pada percobaan ini dihitung berdasarkan indikator resmi Kemendikdasmen.`}
        </p>
      </div>

      {/* 2. Satu tabel: Elemen > Subelemen > Kompetensi > Indikator dengan skor, rujukan nasional, dan selisih */}
      <TabelHierarkiResmiSiswa laporan={laporan} />

      {/* 3. Kartu Fokus: Prioritas Belajar & Kekuatanmu (fitur berbayar: hanya bila tampilkanFokus) */}
      {tampilkanFokus && (
        <div className="grid gap-3 sm:grid-cols-2" data-kartu-fokus>
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
      )}

      {/* 4. Cara membaca. Kalimat sumber rujukan nasional cukup sekali, di bawah tabel. */}
      <p className="text-xs leading-relaxed text-slate-500">
        Daya serap = skor yang kamu peroleh dibagi skor maksimum pada indikator itu. Rerata nasional dari portal resmi daya serap
        TKA Kemendikdasmen dipakai sebagai pembanding.
      </p>
    </div>
  );
}
