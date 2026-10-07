"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DaftarFokus, KelompokDetail } from "@/components/hasil/daya-serap-indikator";
import { Alert } from "@/components/ui/alert";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconChart } from "@/components/ui/empty-state-icons";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { competencyTier, COMPETENCY_TIER_CLASS } from "@/lib/exam/competency-color";
import type { BarisIndikatorSekolah, LaporanIndikatorSekolah } from "@/lib/indikator/daya-serap";
import { formatPersen, formatSelisih } from "@/lib/indikator/tampilan";
import { formatWIBDate } from "@/lib/utils/datetime";

type PeriodeOpsi = { id: string; nama: string | null; mulai: string; berakhir: string };
type MapelOpsi = { subjectId: string; nama: string; jenjang: string; jumlahPercobaan: number };
type DataLaporan = {
  sekolah: { id: string; nama: string };
  mapel: { subjectId: string; nama: string; jenjang: string };
  jumlahSiswaMengerjakan: number;
  jumlahPercobaan: number;
  jumlahPaket: number;
  laporan: LaporanIndikatorSekolah | null;
};
type Respons = { kunci: string; mapel: MapelOpsi[]; periodeLabel: string; data: DataLaporan | null };

const selectClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

const tambahanSiswa = (b: BarisIndikatorSekolah) => `${b.jmlSiswa} siswa · ${b.jmlSoal} jawaban`;
const tambahanNasional = (b: BarisIndikatorSekolah) => (b.nasional === null ? null : `nasional ${formatPersen(b.nasional, 1)} (${formatSelisih(b.dayaSerap - b.nasional)})`);

function Sebaran({ sebaran }: { sebaran: LaporanIndikatorSekolah["sebaran"] }) {
  const total = sebaran.baik + sebaran.cukup + sebaran.kurang;
  const baris: Array<[string, number, "baik" | "cukup" | "kurang"]> = [
    ["Baik (70% ke atas)", sebaran.baik, "baik"],
    ["Cukup (50-69%)", sebaran.cukup, "cukup"],
    ["Perlu latihan (di bawah 50%)", sebaran.kurang, "kurang"],
  ];
  return (
    <div className="flex flex-col gap-3">
      {baris.map(([nama, jumlah, tier]) => {
        const persen = total > 0 ? (jumlah / total) * 100 : 0;
        const cls = COMPETENCY_TIER_CLASS[tier];
        return (
          <div key={tier}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-slate-900">{nama}</span>
              <span className={`font-mono text-xs font-semibold ${cls.text}`}>
                {jumlah} siswa ({formatPersen(persen, 0)})
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              {persen > 0 && <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${Math.max(3, persen)}%` }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Laporan sekolah standar Kemendikdasmen: daya serap per indikator (hierarki resmi per mapel) dengan rerata nasional sebagai
 * rujukan, ditambah Learning Analytics otomatis (prioritas remedial, indikator di bawah nasional, sebaran siswa, siswa perlu
 * perhatian). Unduhan PDF dan Excel memakai data yang sama persis dengan halaman ini.
 */
export default function LaporanIndikatorPage() {
  const [periodeList, setPeriodeList] = useState<PeriodeOpsi[]>([]);
  const [periodeId, setPeriodeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [respons, setRespons] = useState<Respons | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-sekolah/periode");
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok) setPeriodeList(data.periode ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const kunci = `${periodeId}|${subjectId}`;
  useEffect(() => {
    let ignore = false;
    (async () => {
      const qs = new URLSearchParams();
      if (periodeId) qs.set("periodeId", periodeId);
      if (subjectId) qs.set("subjectId", subjectId);
      const res = await fetch(`/api/admin-sekolah/laporan-indikator?${qs.toString()}`);
      const data = await res.json().catch(() => null);
      if (ignore) return;
      if (!res.ok) {
        setError(data?.error ?? "Gagal memuat laporan.");
        return;
      }
      setError(null);
      setRespons({ kunci, mapel: data.mapel ?? [], periodeLabel: data.periodeLabel, data: data.data });
      // belum ada mapel terpilih (atau pilihan lama tak ada di periode ini): pilih mapel pertama yang punya data
      const ada = (data.mapel as MapelOpsi[]).some((m) => m.subjectId === subjectId);
      if (!ada) setSubjectId(data.mapel.length > 0 ? data.mapel[0].subjectId : "");
    })();
    return () => {
      ignore = true;
    };
  }, [periodeId, subjectId, kunci]);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!respons) return <PageSkeleton />;

  const memuat = respons.kunci !== kunci;
  const qs = new URLSearchParams();
  if (periodeId) qs.set("periodeId", periodeId);
  if (subjectId) qs.set("subjectId", subjectId);
  const adaLaporan = Boolean(respons.data?.laporan) && !memuat;
  const lap = !memuat ? respons.data?.laporan ?? null : null;
  const skorTotal = lap ? lap.kelompok.reduce((a, k) => a + k.skor, 0) : 0;
  const maksTotal = lap ? lap.kelompok.reduce((a, k) => a + k.skorMaks, 0) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laporan Daya Serap"
        description="Daya serap per indikator sesuai standar Kemendikdasmen, dibandingkan dengan rerata nasional, lengkap dengan analitik otomatis untuk remedial."
        action={
          adaLaporan && (
            <>
              <a href={`/api/admin-sekolah/laporan-indikator/pdf?${qs.toString()}`} className={buttonClassName("secondary")}>
                Unduh PDF
              </a>
              <a href={`/api/admin-sekolah/laporan-indikator/excel?${qs.toString()}`} className={buttonClassName("secondary")}>
                Unduh Excel
              </a>
            </>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pilihMapel" className="mb-1 block text-xs font-medium text-slate-500">
            Mata pelajaran
          </label>
          <select id="pilihMapel" className={selectClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={respons.mapel.length === 0}>
            {respons.mapel.length === 0 && <option value="">Belum ada ujian yang selesai</option>}
            {respons.mapel.map((m) => (
              <option key={m.subjectId} value={m.subjectId}>
                {m.nama} ({m.jenjang}) - {m.jumlahPercobaan} percobaan
              </option>
            ))}
          </select>
        </div>
        {periodeList.length > 0 && (
          <div>
            <label htmlFor="pilihPeriode" className="mb-1 block text-xs font-medium text-slate-500">
              Periode
            </label>
            <select id="pilihPeriode" className={selectClass} value={periodeId} onChange={(e) => setPeriodeId(e.target.value)}>
              <option value="">Semua waktu</option>
              {periodeList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama ?? "Periode langganan"} ({formatWIBDate(p.mulai)} - {formatWIBDate(p.berakhir)})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {memuat && <PageSkeleton />}

      {!memuat && respons.mapel.length === 0 && (
        <EmptyState
          icon={<IconChart />}
          title="Belum ada data"
          description={periodeId ? "Belum ada ujian yang selesai dikerjakan siswa pada periode ini." : "Belum ada ujian yang selesai dikerjakan siswa di sekolah ini."}
        />
      )}

      {!memuat && respons.data && !respons.data.laporan && respons.mapel.length > 0 && (
        <Alert variant="warning">
          Belum ada soal berindikator resmi Kemendikdasmen pada percobaan {respons.data.mapel.nama} di rentang ini
          ({respons.data.jumlahPercobaan} percobaan dari {respons.data.jumlahSiswaMengerjakan} siswa). Soal yang diimpor dari
          soal.ayotka.id otomatis tertaut setelah admin pusat mengunggah master indikator resmi.
        </Alert>
      )}

      {lap && respons.data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Siswa mengerjakan" value={respons.data.jumlahSiswaMengerjakan} hint={`${respons.data.jumlahPaket} paket`} />
            <StatCard label="Percobaan dihitung" value={respons.data.jumlahPercobaan} hint="percobaan pertama tiap siswa" />
            <StatCard
              label="Cakupan indikator resmi"
              value={lap.jumlahJawaban > 0 ? formatPersen((lap.jawabanBerindikator / lap.jumlahJawaban) * 100, 0) : "-"}
              hint={`${lap.jawabanBerindikator} dari ${lap.jumlahJawaban} jawaban`}
            />
            <StatCard label="Daya serap keseluruhan" value={maksTotal > 0 ? formatPersen((skorTotal / maksTotal) * 100, 1) : "-"} hint={respons.periodeLabel} />
          </div>

          <Card>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Sebaran Siswa</h2>
            <p className="mb-4 text-sm text-slate-500">Berdasarkan daya serap keseluruhan tiap siswa pada mata pelajaran ini.</p>
            <Sebaran sebaran={lap.sebaran} />
          </Card>

          <Card>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Daya Serap per {lap.label[0]}</h2>
            <p className="mb-4 text-sm text-slate-500">
              {lap.mapel} · {lap.label.join(" → ")}. Rerata nasional adalah rujukan; vonis hanya diberikan per {lap.label[0]?.toLowerCase()}.
            </p>
            <div className="flex flex-col gap-3">
              {lap.kelompok.map((k) => (
                <KelompokDetail key={k.nama} label0={lap.label[0]!} k={k} tambahan={tambahanSiswa} terbuka={false} />
              ))}
            </div>
          </Card>

          <div>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Learning Analytics Otomatis</h2>
            <p className="mb-3 text-sm text-slate-500">
              Dihitung otomatis dari hasil siswa, tanpa analisis AI tambahan. Analisis AI per siswa ada di halaman detail siswa.
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
              <DaftarFokus
                judul="Prioritas remedial"
                deskripsi="Indikator dengan daya serap terendah (di bawah 70%) dan cukup banyak jawaban (minimal 5)."
                baris={lap.prioritasRemedial}
                kosong="Tidak ada indikator di bawah 70% dengan jawaban yang cukup."
                tambahan={tambahanSiswa}
              />
              <DaftarFokus
                judul="Indikator di bawah rerata nasional"
                deskripsi="Daya serap sekolah lebih rendah daripada rerata nasional; selisih terbesar lebih dulu."
                baris={lap.diBawahNasional}
                kosong="Tidak ada indikator di bawah rerata nasional (dengan jawaban yang cukup)."
                tambahan={tambahanNasional}
              />
            </div>
          </div>

          <Card>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Siswa yang Perlu Perhatian</h2>
            <p className="mb-4 text-sm text-slate-500">
              Daya serap keseluruhan di bawah 50% pada mata pelajaran ini, terendah lebih dulu, beserta dua indikator terlemahnya.
            </p>
            {lap.siswaPerhatian.length === 0 ? (
              <p className="text-sm text-slate-500">Tidak ada siswa di bawah 50%.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100">
                {lap.siswaPerhatian.map((s) => (
                  <li key={s.studentId} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link href={`/admin-sekolah/siswa/${s.studentId}`} className="text-sm font-medium text-indigo-700 hover:underline">
                        {s.nama}
                      </Link>
                      <span className={`font-mono text-sm font-semibold ${COMPETENCY_TIER_CLASS[competencyTier(s.dayaSerap)].text}`}>
                        {formatPersen(s.dayaSerap, 0)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {s.nisn ? `NISN ${s.nisn} · ` : ""}
                      {s.jmlSoal} soal berindikator
                    </p>
                    {s.terlemah.length > 0 && (
                      <p className="mt-1 text-xs leading-snug text-slate-600">
                        <span className="font-medium text-slate-500">Terlemah: </span>
                        {s.terlemah.map((b) => `${b.indikator} (${formatPersen(b.dayaSerap, 0)})`).join("; ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
