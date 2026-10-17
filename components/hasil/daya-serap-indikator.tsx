"use client";

import { Fragment, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { competencyTier, COMPETENCY_TIER_CLASS } from "@/lib/exam/competency-color";
import {
  LABEL_VONIS,
  type BarisIndikator,
  type KelompokIndikator,
  type LaporanIndikatorSiswa,
} from "@/lib/indikator/daya-serap";
import { VARIAN_VONIS, bersihkanTeksIndikator, formatPersen, formatSelisih, ringkasanSoal } from "@/lib/indikator/tampilan";
import { bangunBarisDiuji } from "@/lib/indikator/tabel-capaian";
import { CatatanRujukanNasional } from "@/components/hasil/catatan-rujukan-nasional";

export { ringkasanSoal };

/** Keterangan tambahan per baris (mis. "12 siswa") di laporan sekolah; null = tidak ada. */
export type Tambahan<B extends BarisIndikator> = (b: B) => string | null;

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

/**
 * Teks dengan kesempatan putus baris setelah garis miring ("a/b" menjadi "a/" lalu "b"): kata gabungan panjang seperti
 * "Menganalisis/mengevaluasi" tidak terpotong di tengah huruf pada layar HP yang sempit. Teks aslinya tidak berubah.
 */
function PutusSetelahGarisMiring({ teks }: { teks: string }) {
  return (
    <>
      {teks.split(/(?<=\/)/).map((bagian, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {bagian}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Satu-satunya tabel capaian di rapor web siswa (menggantikan Peta Kompetensi, ringkasan per elemen, tabel hierarki, dan
 * tampilan akordion yang dulu mengulang angka yang sama): hierarki resmi Kemendikdasmen dengan skor, rujukan nasional,
 * dan selisih. Baris tingkat pertama membawa vonis dibanding rerata nasional.
 * Memetakan capaian bertingkat persis dengan standar Tampilan Analitik Admin Sekolah:
 * Matematika: Elemen → Subelemen → Kompetensi → Indikator (4 tingkat).
 * Bahasa Indonesia: Kompetensi → Subkompetensi → Indikator (3 tingkat).
 */
export function TabelHierarkiResmiSiswa({ laporan }: { laporan: LaporanIndikatorSiswa }) {
  const isMatematika = laporan.jumlahTingkat === 4;

  // Satu tampilan saja (permintaan pemilik, 17 Okt 2026): indikator yang muncul di soal percobaan ini. Pilihan "Semua
  // Indikator Resmi" dihapus karena membingungkan siswa dan separuh barisnya tanpa skor.
  const rows = useMemo(() => bangunBarisDiuji(laporan), [laporan]);
  const kelompokPerNama = new Map(laporan.kelompok.map((k) => [k.nama, k] as const));

  return (
    <div className="flex flex-col gap-3">

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
              {rows.map((row) => {
                const isL1 = row.level === 1;
                const isL2 = row.level === 2;
                const isLeaf = isMatematika ? row.level === 4 : row.level === 3;
                // Kompetensi (tingkat 3 Matematika) adalah kalimat panjang: dibuat lebih kecil dan redup agar mata jatuh
                // ke Elemen dan indikatornya.
                const isKompetensi = isMatematika && row.level === 3;

                // Kelompok (Elemen) membawa vonis dibanding rerata nasional; kelompok dengan soal terlalu sedikit tidak
                // dibandingkan (aturan yang sama dengan tabel ringkasan lama).
                const kelompok = isL1 && row.kelompokNama ? kelompokPerNama.get(row.kelompokNama) : undefined;
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
                              <PutusSetelahGarisMiring teks={row.judulTampil} />
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
                        <span>
                          › <PutusSetelahGarisMiring teks={row.judulTampil} />
                        </span>
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
   * sudah mengaktifkan Learning Analytics untuk percobaan ini (lib/billing/fokus-belajar.ts). Bagian lain tetap tampil.
   */
  tampilkanFokus?: boolean;
}) {
  const cakupanSebagian = laporan.soalTercakup < laporan.soalTotal;

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Keterangan mapel dan cakupan soal */}
      <div>
        <p className="text-sm font-semibold text-slate-800">
          {laporan.mapel} · {laporan.label.join(" → ")}
        </p>
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
