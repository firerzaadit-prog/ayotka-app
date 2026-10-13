"use client";

import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconUsers } from "@/components/ui/empty-state-icons";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { useDataLaporan, useFilterAlamat } from "@/components/hasil-tryout/use-laporan";
import { BadgeJenis, FilterTanggalLipat, LencanaPeringkat, NilaiTingkat, SakelarAlumni, TabJenis, TombolPdf } from "@/components/hasil-tryout/elemen";
import { BatangPartisipasi } from "@/components/hasil-tryout/paket-terbanyak-view";
import { UnduhSemuaPdf } from "@/components/hasil-tryout/unduh-semua-pdf";
import { buatQuery, type NilaiFilter } from "@/lib/hasil-tryout/alamat";
import { formatSkor, namaBerkasLaporan } from "@/lib/hasil-tryout/format";
import type { FilterJenis } from "@/lib/hasil-tryout/jenis";
import type { BarisBelum, StatistikPaket } from "@/lib/hasil-tryout/susun";
import type { BarisHasilPaketJson } from "@/lib/hasil-tryout/tampil";
import { cn } from "@/lib/utils/cn";
import { formatWIB } from "@/lib/utils/datetime";

type RespDetail = {
  paket: { id: string; nama: string; mapel: string; jenjang: string; jumlahSoal: number; durasiMenit: number };
  statistik: StatistikPaket;
  hasil: BarisHasilPaketJson[];
  belum: BarisBelum[];
  jumlahPerJenis: Record<FilterJenis, number>;
};

const BAWAAN: NilaiFilter = { jenis: "semua", dari: "", sampai: "", alumni: "ikut", tab: "sudah" };

/**
 * Rincian satu paket (admin sekolah): siapa yang sudah mengerjakan (diperingkat dari nilai tertinggi, dengan unduhan PDF) dan
 * siapa yang belum, beserta statistik partisipasi dan sebaran nilai. Data dari /api/admin-sekolah/paket/{id}.
 */
export function DetailPaketView({ id, awal }: { id: string; awal: NilaiFilter }) {
  const jalur = `/admin-sekolah/paket/${id}`;
  const { nilai, ubah } = useFilterAlamat(jalur, awal, BAWAAN);
  // Bagian yang sedang dibuka (tab) hanya urusan tampilan: tidak ikut ke server, jadi berganti tab tidak memuat ulang data.
  const query = buatQuery({ ...nilai, tab: "" }, BAWAAN);
  const { data, galat, memuat } = useDataLaporan<RespDetail>(`/api/admin-sekolah/paket/${id}`, query);
  const jenis = (nilai.jenis ?? "semua") as FilterJenis;
  const tab = nilai.tab === "belum" ? "belum" : "sudah";
  const unduh = `/api/admin-sekolah/paket/${id}/export${query ? `?${query}` : ""}`;

  const pilihTab = (t: "sudah" | "belum") => ubah({ tab: t });

  return (
    <div className="flex flex-col gap-6" data-halaman-detail-paket>
      <div>
        <Link href="/admin-sekolah/paket" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke Performa Paket
        </Link>
      </div>

      {galat && !data && <Alert variant="danger">{galat}</Alert>}
      {!data && !galat && <TableSkeleton columns={6} rows={6} />}

      {data && (
        <>
          <PageHeader
            title={data.paket.nama}
            description={`${data.paket.mapel} · Jenjang ${data.paket.jenjang} · ${data.paket.jumlahSoal} soal · ${data.paket.durasiMenit} menit`}
            action={
              <a href={unduh} download data-unduh-excel className={buttonClassName("secondary")}>
                <FileSpreadsheet size={16} className="mr-2" aria-hidden="true" />
                Unduh Excel
              </a>
            }
          />

          <TabJenis nilai={jenis} onChange={(j) => ubah({ jenis: j })} jumlah={data.jumlahPerJenis} satuan="hasil" id="tab-detail-paket" />

          <UnduhSemuaPdf
            items={data.hasil.map((h) => ({ attemptId: h.attemptId, nama: h.nama }))}
            namaZip={namaBerkasLaporan("rapor", `${data.paket.nama}${jenis === "semua" ? "" : `-${jenis}`}`, new Date(), "zip")}
          />

          <div className="flex flex-wrap items-end gap-3">
            <SakelarAlumni ikut={(nilai.alumni ?? "ikut") === "ikut"} onChange={(ikut) => ubah({ alumni: ikut ? "ikut" : "tanpa" })} />
          </div>
          <FilterTanggalLipat dari={nilai.dari ?? ""} sampai={nilai.sampai ?? ""} onChange={(r) => ubah(r)} />
          {galat && <Alert variant="danger">{galat}</Alert>}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sudah mengerjakan</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900" data-sudah>
                {data.statistik.sudahMengerjakan}
              </p>
              <div className="mt-2">
                <BatangPartisipasi persen={data.statistik.siswaAktif > 0 ? data.statistik.partisipasiPersen : null} sudah={data.statistik.sudahMengerjakanAktif} dari={data.statistik.siswaAktif} />
              </div>
            </div>
            <StatCard
              label="Belum mengerjakan"
              value={data.statistik.belumMengerjakan}
              hint={data.statistik.sedangMengerjakan > 0 ? `${data.statistik.sedangMengerjakan} sedang mengerjakan` : "Siswa aktif sejenjang"}
            />
            <StatCard label="Rata-rata nilai" value={formatSkor(data.statistik.rataRata)} hint={`Median ${formatSkor(data.statistik.median)}`} />
            <StatCard
              label="Tertinggi / terendah"
              value={`${formatSkor(data.statistik.tertinggi)} / ${formatSkor(data.statistik.terendah)}`}
              hint={`${data.statistik.jumlahBernilai} hasil bernilai`}
            />
          </div>

          {data.statistik.jumlahBernilai > 0 && <SebaranNilai sebaran={data.statistik.sebaran} />}

          <div role="tablist" aria-label="Bagian rincian paket" className="flex gap-1 border-b border-slate-200">
            {(
              [
                ["sudah", `Sudah mengerjakan (${data.hasil.length})`],
                ["belum", `Belum mengerjakan (${data.belum.length})`],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                role="tab"
                id={`tab-bagian-${t}`}
                aria-selected={tab === t}
                aria-controls={`panel-bagian-${t}`}
                data-tab-bagian={t}
                onClick={() => pilihTab(t)}
                className={cn(
                  "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                  tab === t ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={memuat ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={memuat}>
            {tab === "sudah" && (
              <div role="tabpanel" id="panel-bagian-sudah" aria-labelledby="tab-bagian-sudah">
                {data.hasil.length === 0 ? (
                  <EmptyState icon={<IconUsers />} title="Belum ada yang mengerjakan" description="Peringkat muncul setelah ada siswa yang menyelesaikan paket ini pada jenis dan periode yang dipilih." />
                ) : (
                  <TableContainer>
                    <Table className="min-w-[760px]">
                      <Thead>
                        <Tr>
                          <Th>Peringkat</Th>
                          <Th>Siswa</Th>
                          <Th>Jenis</Th>
                          <Th>Nilai</Th>
                          <Th>Durasi</Th>
                          <Th>Tanggal</Th>
                          <Th className="text-right">Rapor</Th>
                        </Tr>
                      </Thead>
                      <tbody>
                        {data.hasil.map((h) => (
                          <Tr key={h.attemptId} data-baris-hasil={h.attemptId}>
                            <Td>
                              <LencanaPeringkat peringkat={h.peringkat} />
                            </Td>
                            <Td className="font-medium text-slate-900">
                              <Link href={`/admin-sekolah/siswa/${h.studentId}`} className="hover:text-indigo-700 hover:underline">
                                {h.nama}
                              </Link>
                              {h.alumni && (
                                <Badge variant="neutral" className="ml-2">
                                  Alumni
                                </Badge>
                              )}
                              {h.nisn && <span className="block font-mono text-xs font-normal text-slate-500">{h.nisn}</span>}
                            </Td>
                            <Td>
                              <BadgeJenis jenis={h.jenis} />
                            </Td>
                            <Td className="text-base">
                              <NilaiTingkat skor={h.skor} />
                            </Td>
                            <Td className="text-xs text-slate-600">{h.durasiMenit === null ? "-" : `${h.durasiMenit} menit`}</Td>
                            <Td className="whitespace-nowrap text-xs text-slate-600">
                              {formatWIB(h.mulaiAt, "d MMM yyyy")}
                              {h.status === "kedaluwarsa" && <span className="block text-amber-700">Waktu habis</span>}
                            </Td>
                            <Td className="text-right">
                              <TombolPdf attemptId={h.attemptId} nama={h.nama} />
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableContainer>
                )}
              </div>
            )}

            {tab === "belum" && (
              <div role="tabpanel" id="panel-bagian-belum" aria-labelledby="tab-bagian-belum">
                {data.belum.length === 0 ? (
                  <EmptyState icon={<IconUsers />} title="Semua siswa aktif sudah mengerjakan" description="Tidak ada siswa aktif sejenjang yang belum menyelesaikan paket ini." />
                ) : (
                  <TableContainer>
                    <Table className="min-w-[520px]">
                      <Thead>
                        <Tr>
                          <Th>Siswa</Th>
                          <Th>Keterangan</Th>
                          <Th>Akun</Th>
                        </Tr>
                      </Thead>
                      <tbody>
                        {data.belum.map((b) => (
                          <Tr key={b.studentId} data-baris-belum={b.studentId}>
                            <Td className="font-medium text-slate-900">
                              <Link href={`/admin-sekolah/siswa/${b.studentId}`} className="hover:text-indigo-700 hover:underline">
                                {b.nama}
                              </Link>
                              {b.nisn && <span className="block font-mono text-xs font-normal text-slate-500">{b.nisn}</span>}
                            </Td>
                            <Td>
                              {b.status === "sedang_mengerjakan" ? <Badge variant="info">Sedang mengerjakan</Badge> : <Badge variant="neutral">Belum mulai</Badge>}
                            </Td>
                            <Td>{b.claimStatus === "belum_klaim" ? <Badge variant="warning">Akun belum diaktifkan</Badge> : <span className="text-xs text-slate-500">Aktif</span>}</Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableContainer>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SebaranNilai({ sebaran }: { sebaran: StatistikPaket["sebaran"] }) {
  const maks = Math.max(1, ...sebaran.map((s) => s.jumlah));
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="judul-sebaran-paket">
      <h2 id="judul-sebaran-paket" className="text-sm font-semibold text-slate-900">
        Sebaran nilai
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {sebaran.map((s) => (
          <li key={s.label} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 text-xs text-slate-600">
            <span>{s.label}</span>
            <span className="h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${(s.jumlah / maks) * 100}%` }} />
            </span>
            <span className="text-right font-medium text-slate-900">{s.jumlah}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
