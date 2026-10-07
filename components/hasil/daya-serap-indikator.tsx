import { Badge } from "@/components/ui/badge";
import { competencyTier, COMPETENCY_TIER_CLASS } from "@/lib/exam/competency-color";
import { LABEL_VONIS, type BarisIndikator, type KelompokIndikator, type LaporanIndikatorSiswa } from "@/lib/indikator/daya-serap";
import { VARIAN_VONIS, formatPersen, formatSelisih } from "@/lib/indikator/tampilan";

/** Keterangan tambahan per baris (mis. "12 siswa") di laporan sekolah; null = tidak ada. */
export type Tambahan<B extends BarisIndikator> = (b: B) => string | null;

export function Batang({ persen }: { persen: number }) {
  const cls = COMPETENCY_TIER_CLASS[competencyTier(persen)];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${Math.max(3, Math.min(100, persen))}%` }} />
    </div>
  );
}

export function BarisUraian<B extends BarisIndikator>({ b, tambahan }: { b: B; tambahan?: Tambahan<B> }) {
  const cls = COMPETENCY_TIER_CLASS[competencyTier(b.dayaSerap)];
  const ket = tambahan?.(b);
  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <p className="text-[11px] leading-snug text-slate-400">
        {b.level2}
        {b.level3 ? ` · ${b.level3}` : ""}
      </p>
      <p className="mt-0.5 text-sm leading-snug text-slate-800">{b.indikator}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <Batang persen={b.dayaSerap} />
        </div>
        <span className={`shrink-0 font-mono text-xs font-semibold ${cls.text}`}>{formatPersen(b.dayaSerap, 0)}</span>
        <span className="shrink-0 text-[11px] text-slate-500">
          {ket ?? `${b.jmlSoal} soal`}
          {b.nasional !== null && <> · nasional {formatPersen(b.nasional, 1)}</>}
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
}: {
  label0: string;
  k: KelompokIndikator<B>;
  tambahan?: Tambahan<B>;
  terbuka?: boolean;
}) {
  const cls = COMPETENCY_TIER_CLASS[competencyTier(k.dayaSerap)];
  return (
    <details open={terbuka} className="group rounded-xl border border-slate-200">
      <summary className="cursor-pointer list-none rounded-xl px-4 py-3 hover:bg-slate-50">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900">
            <span className="mr-1.5 text-[11px] font-normal uppercase tracking-wide text-slate-400">{label0}</span>
            {k.nama}
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
        </div>
      </summary>
      <ul className="flex flex-col gap-2 px-4 pb-4">
        {k.baris.map((b) => (
          <BarisUraian key={b.indikatorId} b={b} tambahan={tambahan} />
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
          {baris.map((b) => (
            <li key={b.indikatorId} className="text-sm leading-snug text-slate-800">
              <span className="font-mono text-xs font-semibold text-slate-500">{formatPersen(b.dayaSerap, 0)}</span> {b.indikator}
              <span className="block text-[11px] text-slate-400">
                {[b.level1, tambahan?.(b)].filter(Boolean).join(" - ")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Daya serap per indikator resmi Kemendikdasmen untuk rapor siswa. Hierarki mengikuti standar resmi: Matematika
 * Elemen > Subelemen > Kompetensi > Indikator; Bahasa Kompetensi > Subkompetensi > Indikator (tanpa label Elemen).
 * Rerata nasional per indikator hanya RUJUKAN; vonis ("di atas rerata nasional" / "perlu penguatan") hanya di tingkat
 * kelompok karena beberapa soal per indikator terlalu sedikit untuk disimpulkan.
 */
export function DayaSerapIndikator({ laporan }: { laporan: LaporanIndikatorSiswa }) {
  const cakupanSebagian = laporan.soalTercakup < laporan.soalTotal;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-slate-600">
          {laporan.mapel} · {laporan.label.join(" → ")}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {cakupanSebagian
            ? `${laporan.soalTercakup} dari ${laporan.soalTotal} soal pada percobaan ini memiliki indikator resmi Kemendikdasmen dan dihitung di sini.`
            : `Seluruh ${laporan.soalTotal} soal pada percobaan ini dihitung berdasarkan indikator resmi Kemendikdasmen.`}
        </p>
      </div>

      {laporan.kelompok.map((k) => (
        <KelompokDetail key={k.nama} label0={laporan.label[0]!} k={k} />
      ))}

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

      <p className="text-xs text-slate-400">
        Daya serap = skor yang kamu peroleh dibagi skor maksimum pada indikator itu. Rerata nasional dari portal resmi daya serap
        TKA Kemendikdasmen dipakai sebagai pembanding.
      </p>
    </div>
  );
}
