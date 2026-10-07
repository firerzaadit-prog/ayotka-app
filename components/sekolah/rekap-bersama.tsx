"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconUsers } from "@/components/ui/empty-state-icons";
import { StatCard } from "@/components/ui/stat-card";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatWIB } from "@/lib/utils/datetime";
import { LABEL_STATUS_PESERTA, type BarisRekap, type StatistikRekap, type StatusPeserta } from "@/lib/exam/rekap-bersama";

type DataRekap = {
  penugasan: { id: string; paketNama: string; mapel: string; sekolahNama: string; mulai: string; selesai: string; isActive: boolean };
  baris: BarisRekap[];
  statistik: StatistikRekap;
};

const VARIAN_STATUS: Record<StatusPeserta, "success" | "warning" | "info" | "neutral"> = {
  selesai: "success",
  waktu_habis: "warning",
  mengerjakan: "info",
  dijeda: "warning",
  belum: "neutral",
};

const angka = (n: number | null, desimal = 1) => (n === null ? "-" : Number.isInteger(n) ? String(n) : n.toFixed(desimal));

/**
 * Rekap hasil Try Out Bersama (tab "Rekap Hasil" di /admin-sekolah/ujian/[id]): statistik, sebaran nilai, peringkat,
 * dan siapa yang belum mengerjakan, plus unduhan Excel. Aturan penyusunannya ada di lib/exam/rekap-bersama.ts.
 */
export function RekapBersama({ assignmentId }: { assignmentId: string }) {
  const [data, setData] = useState<DataRekap | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [kunci, setKunci] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin-sekolah/assignments/${assignmentId}/rekap`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (ignore) return;
        if (res.ok && json) {
          setData(json);
          setGalat(null);
        } else {
          setGalat(json?.error ?? "Gagal memuat rekap.");
        }
      } catch {
        if (!ignore) setGalat("Gagal memuat rekap. Periksa koneksimu lalu coba lagi.");
      } finally {
        if (!ignore) setMemuat(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [assignmentId, kunci]);

  const muatUlang = useCallback(() => {
    setMemuat(true);
    setKunci((k) => k + 1);
  }, []);

  if (galat && !data) return <Alert variant="danger">{galat}</Alert>;
  if (memuat && !data) return <TableSkeleton columns={6} />;
  if (!data) return null;

  const { statistik, baris, penugasan } = data;
  const sudahMulai = baris.filter((b) => b.status !== "belum");
  const belum = baris.filter((b) => b.status === "belum");
  const maksSebaran = Math.max(1, ...statistik.sebaran.map((s) => s.jumlah));

  return (
    <div className="flex flex-col gap-6" data-rekap-bersama>
      {galat && <Alert variant="danger">{galat}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Jendela <span className="font-medium text-slate-900">{formatWIB(penugasan.mulai)}</span> s.d.{" "}
          <span className="font-medium text-slate-900">{formatWIB(penugasan.selesai)}</span>. Nilai tiap siswa adalah percobaan{" "}
          <span className="font-medium text-slate-900">pertamanya</span> pada ujian ini.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={muatUlang} disabled={memuat}>
            {memuat ? "Memuat..." : "Muat ulang"}
          </Button>
          <a
            href={`/api/admin-sekolah/assignments/${assignmentId}/rekap/export`}
            download
            data-unduh-excel
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Unduh Excel
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Peserta" value={statistik.jumlahPeserta} hint={`${statistik.jumlahSelesai} selesai · ${statistik.jumlahSedang} mengerjakan · ${statistik.jumlahBelum} belum`} />
        <StatCard label="Partisipasi" value={`${statistik.partisipasiPersen}%`} hint="Sudah memulai ujian" />
        <StatCard label="Rata-rata nilai" value={angka(statistik.rataRata)} hint={`Median ${angka(statistik.median)}`} />
        <StatCard label="Tertinggi / terendah" value={`${angka(statistik.tertinggi)} / ${angka(statistik.terendah)}`} hint={`${statistik.jumlahBernilai} siswa bernilai`} />
      </div>

      {statistik.jumlahBernilai > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="judul-sebaran">
          <h2 id="judul-sebaran" className="text-sm font-semibold text-slate-900">
            Sebaran nilai
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {statistik.sebaran.map((s) => (
              <li key={s.label} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 text-xs text-slate-600">
                <span>{s.label}</span>
                <span className="h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${(s.jumlah / maksSebaran) * 100}%` }} />
                </span>
                <span className="text-right font-medium text-slate-900">{s.jumlah}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sudahMulai.length === 0 && belum.length === 0 && (
        <EmptyState icon={<IconUsers />} title="Belum ada peserta" description="Belum ada siswa terdaftar di sekolah ini." />
      )}

      {sudahMulai.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>#</Th>
                <Th>Siswa</Th>
                <Th>Status</Th>
                <Th>Nilai</Th>
                <Th>Durasi</Th>
                <Th>Pindah tab</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <tbody>
              {sudahMulai.map((b) => (
                <Tr key={b.studentId}>
                  <Td className="font-semibold text-slate-900">{b.peringkat ?? "-"}</Td>
                  <Td className="font-medium text-slate-900">
                    {b.nama}
                    {b.nisn && <span className="ml-2 font-mono text-xs font-normal text-slate-500">{b.nisn}</span>}
                    {b.jumlahPercobaan > 1 && (
                      <span className="ml-2 text-xs font-normal text-slate-500">({b.jumlahPercobaan} percobaan)</span>
                    )}
                  </Td>
                  <Td>
                    <Badge variant={VARIAN_STATUS[b.status]}>{LABEL_STATUS_PESERTA[b.status]}</Badge>
                  </Td>
                  <Td className="font-semibold">{angka(b.skor, 0)}</Td>
                  <Td className="text-xs">{b.durasiMenit === null ? "-" : `${b.durasiMenit} menit`}</Td>
                  <Td>
                    {b.tabSwitchCount > 0 ? <Badge variant="danger">{b.tabSwitchCount}x</Badge> : <span className="text-slate-400">-</span>}
                  </Td>
                  <Td className="text-right">
                    {b.attemptId && (b.status === "selesai" || b.status === "waktu_habis") && (
                      <a href={`/api/siswa/attempts/${b.attemptId}/rapor`} className="text-sm font-medium text-slate-600 hover:underline">
                        Rapor (PDF)
                      </a>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}

      {belum.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="judul-belum">
          <h2 id="judul-belum" className="text-sm font-semibold text-slate-900">
            Belum mengerjakan ({belum.length})
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2" data-daftar-belum>
            {belum.map((b) => (
              <li key={b.studentId} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1">
                <span className="text-slate-800">
                  {b.nama}
                  {b.nisn && <span className="ml-2 font-mono text-xs text-slate-500">{b.nisn}</span>}
                </span>
                {b.claimStatus === "belum_klaim" && <Badge variant="warning">Akun belum diaktifkan</Badge>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
