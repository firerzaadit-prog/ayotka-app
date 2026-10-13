"use client";

import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconChart } from "@/components/ui/empty-state-icons";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { useDataLaporan, useFilterAlamat } from "@/components/hasil-tryout/use-laporan";
import { BadgeJenis, FilterTanggalLipat, NilaiTingkat, Pilihan, SakelarAlumni, TabJenis } from "@/components/hasil-tryout/elemen";
import type { NilaiFilter } from "@/lib/hasil-tryout/alamat";
import type { FilterJenis } from "@/lib/hasil-tryout/jenis";
import { URUTAN_JENIS } from "@/lib/hasil-tryout/jenis";
import { LABEL_URUTAN_PAKET, URUTAN_PAKET_TERSEDIA } from "@/lib/hasil-tryout/susun";
import type { BarisPaketJson } from "@/lib/hasil-tryout/tampil";

type RespPaket = {
  baris: BarisPaketJson[];
  jumlahPaketPerJenis: Record<FilterJenis, number>;
  ringkasan: { jumlahPaket: number; jumlahHasil: number; jumlahSiswa: number };
  pilihan: { mapel: Array<{ id: string; nama: string }> };
};

const BAWAAN: NilaiFilter = { jenis: "semua", mapel: "", dari: "", sampai: "", alumni: "ikut", urut: "terbanyak" };

/** Batang partisipasi: siswa aktif yang sudah mengerjakan dibanding seluruh siswa aktif sejenjang. */
export function BatangPartisipasi({ persen, sudah, dari }: { persen: number | null; sudah: number; dari: number }) {
  if (persen === null) return <span className="text-xs text-slate-400">-</span>;
  return (
    <div className="min-w-36" data-partisipasi={persen}>
      <p className="text-xs text-slate-600">
        <span className="font-semibold text-slate-900">{sudah}</span> dari {dari} siswa aktif ({persen}%)
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, persen)}%` }} />
      </div>
    </div>
  );
}

/**
 * Halaman Performa Paket (admin sekolah): paket try out yang paling banyak dikerjakan siswa sekolah, gabungan atau per jenis.
 * Tiap baris menuju rincian paket (siapa yang sudah dan belum mengerjakan, beserta peringkatnya).
 */
export function PaketTerbanyakView({ awal }: { awal: NilaiFilter }) {
  const { nilai, ubah, query } = useFilterAlamat("/admin-sekolah/paket", awal, BAWAAN);
  const { data, galat, memuat } = useDataLaporan<RespPaket>("/api/admin-sekolah/paket", query);
  const jenis = (nilai.jenis ?? "semua") as FilterJenis;
  const adaSyarat = Boolean(nilai.mapel || nilai.dari || nilai.sampai || jenis !== "semua");

  return (
    <div className="flex flex-col gap-6" data-halaman-paket>
      <PageHeader
        title="Performa Paket"
        description="Paket try out yang paling banyak dikerjakan siswa sekolahmu. Pilih sebuah paket untuk melihat siapa yang sudah dan belum mengerjakan, lengkap dengan peringkatnya."
      />

      <TabJenis nilai={jenis} onChange={(j) => ubah({ jenis: j })} jumlah={data?.jumlahPaketPerJenis ?? null} satuan="paket" id="tab-paket" />

      <div className="flex flex-wrap items-end gap-3">
        <Pilihan
          id="mapelPaket"
          label="Mata pelajaran"
          nilai={nilai.mapel ?? ""}
          onChange={(v) => ubah({ mapel: v })}
          opsi={[{ nilai: "", label: "Semua mata pelajaran" }, ...(data?.pilihan.mapel ?? []).map((m) => ({ nilai: m.id, label: m.nama }))]}
        />
        <Pilihan
          id="urutPaket"
          label="Urutkan"
          nilai={nilai.urut ?? "terbanyak"}
          onChange={(v) => ubah({ urut: v })}
          className="min-w-56"
          opsi={URUTAN_PAKET_TERSEDIA.map((u) => ({ nilai: u, label: LABEL_URUTAN_PAKET[u] }))}
        />
        <SakelarAlumni ikut={(nilai.alumni ?? "ikut") === "ikut"} onChange={(ikut) => ubah({ alumni: ikut ? "ikut" : "tanpa" })} />
      </div>

      <FilterTanggalLipat dari={nilai.dari ?? ""} sampai={nilai.sampai ?? ""} onChange={(r) => ubah(r)} />

      {galat && <Alert variant="danger">{galat}</Alert>}
      {!data && !galat && <TableSkeleton columns={6} rows={6} />}

      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Paket dikerjakan" value={data.ringkasan.jumlahPaket} hint="Paket yang punya minimal satu hasil" />
          <StatCard label="Siswa yang mengerjakan" value={data.ringkasan.jumlahSiswa} hint="Siswa berbeda" />
          <StatCard label="Hasil try out" value={data.ringkasan.jumlahHasil} hint="Satu siswa pada satu try out = satu hasil" />
        </div>
      )}

      {data && data.baris.length === 0 && (
        <EmptyState
          icon={<IconChart />}
          title={adaSyarat ? "Tidak ada paket yang cocok" : "Belum ada paket yang dikerjakan"}
          description={adaSyarat ? "Coba ganti jenis try out, mata pelajaran, atau periode tanggalnya." : "Paket muncul di sini begitu siswa menyelesaikan try out."}
          action={
            adaSyarat ? (
              <Button type="button" variant="secondary" onClick={() => ubah({ jenis: "semua", mapel: "", dari: "", sampai: "" })}>
                Hapus semua syarat
              </Button>
            ) : undefined
          }
        />
      )}

      {data && data.baris.length > 0 && (
        <div className={memuat ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={memuat}>
          <TableContainer>
            <Table className="min-w-[780px]">
              <Thead>
                <Tr>
                  <Th>#</Th>
                  <Th>Paket</Th>
                  <Th>Dikerjakan lewat</Th>
                  <Th>Siswa yang mengerjakan</Th>
                  <Th>Rata-rata</Th>
                  <Th>Tertinggi</Th>
                  <Th className="text-right">Rincian</Th>
                </Tr>
              </Thead>
              <tbody>
                {data.baris.map((b, i) => (
                  <Tr key={b.packageId} data-baris-paket={b.packageId}>
                    <Td className="font-semibold text-slate-500">{i + 1}</Td>
                    <Td className="min-w-60">
                      <Link
                        href={`/admin-sekolah/paket/${b.packageId}${jenis === "semua" ? "" : `?jenis=${jenis}`}`}
                        className="font-medium text-slate-900 hover:text-indigo-700 hover:underline"
                      >
                        {b.nama}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        {b.mapel} · {b.jenjang}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {URUTAN_JENIS.filter((j) => b.perJenis[j] > 0).map((j) => (
                          <span key={j} className="inline-flex items-center gap-1">
                            <BadgeJenis jenis={j} />
                            <span className="text-xs text-slate-500">{b.perJenis[j]}</span>
                          </span>
                        ))}
                      </div>
                    </Td>
                    <Td>
                      <p className="text-base font-semibold text-slate-900" data-jumlah-siswa>
                        {b.jumlahSiswa}
                      </p>
                      <BatangPartisipasi persen={b.partisipasiPersen} sudah={b.jumlahSiswaAktif} dari={b.siswaAktifJenjang} />
                    </Td>
                    <Td className="text-base">
                      <NilaiTingkat skor={b.rataRata} />
                    </Td>
                    <Td>
                      <NilaiTingkat skor={b.tertinggi} tebal={false} />
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/admin-sekolah/paket/${b.packageId}${jenis === "semua" ? "" : `?jenis=${jenis}`}`}
                        className="whitespace-nowrap text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Lihat peringkat →
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        </div>
      )}
    </div>
  );
}
