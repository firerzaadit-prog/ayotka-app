"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconUsers } from "@/components/ui/empty-state-icons";
import { PageHeader } from "@/components/ui/page-header";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { useDataLaporan, useFilterAlamat } from "@/components/hasil-tryout/use-laporan";
import { FilterTanggalLipat, KotakCari, LencanaPeringkat, NilaiTingkat, Pilihan, RincianJenisTryOut, SakelarAlumni, TabJenis } from "@/components/hasil-tryout/elemen";
import type { NilaiFilter } from "@/lib/hasil-tryout/alamat";
import { formatSkor } from "@/lib/hasil-tryout/format";
import type { FilterJenis } from "@/lib/hasil-tryout/jenis";
import type { BarisPeringkatJson } from "@/lib/hasil-tryout/tampil";

type RespPeringkat = {
  baris: BarisPeringkatJson[];
  ringkasan: { jumlahSiswa: number; jumlahTryOut: number; rataRata: number | null };
  jumlahSiswaPerJenis: Record<FilterJenis, number>;
  pilihan: { mapel: Array<{ id: string; nama: string }> };
};

const BAWAAN: NilaiFilter = { jenis: "semua", mapel: "", dari: "", sampai: "", alumni: "tanpa", minimal: "1" };
const OPSI_MINIMAL = [
  { nilai: "1", label: "Semua siswa" },
  { nilai: "2", label: "Minimal 2 try out" },
  { nilai: "3", label: "Minimal 3 try out" },
  { nilai: "5", label: "Minimal 5 try out" },
  { nilai: "10", label: "Minimal 10 try out" },
];

/**
 * Halaman Peringkat Siswa (admin sekolah): urutan siswa dari rata-rata nilai tertinggi ke terendah secara keseluruhan, bisa
 * disaring per jenis try out, mata pelajaran, dan periode. Data dari /api/admin-sekolah/peringkat; unduhan Excel memakai
 * syarat yang sama.
 */
export function PeringkatSiswaView({ awal }: { awal: NilaiFilter }) {
  const { nilai, ubah, query } = useFilterAlamat("/admin-sekolah/peringkat", awal, BAWAAN);
  const { data, galat, memuat } = useDataLaporan<RespPeringkat>("/api/admin-sekolah/peringkat", query);

  // Pencarian nama hanya menyaring daftar yang sudah dimuat (nomor peringkat tetap yang sebenarnya), jadi tidak ke server.
  const [cari, setCari] = useState("");
  const [halaman, setHalaman] = useState(1);
  const [ukuran, setUkuran] = useState(DEFAULT_PAGE_SIZE);
  const jenis = (nilai.jenis ?? "semua") as FilterJenis;

  const tampil = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    const semua = data?.baris ?? [];
    return kata ? semua.filter((b) => b.nama.toLowerCase().includes(kata) || (b.nisn ?? "").toLowerCase().includes(kata)) : semua;
  }, [data, cari]);

  const totalHalaman = Math.max(1, Math.ceil(tampil.length / ukuran));
  const halamanAman = Math.min(halaman, totalHalaman);
  const baris = tampil.slice((halamanAman - 1) * ukuran, halamanAman * ukuran);
  const podium = !cari.trim() && halamanAman === 1 ? (data?.baris ?? []).slice(0, 3) : [];
  const unduh = `/api/admin-sekolah/peringkat/export${query ? `?${query}` : ""}`;

  function ubahFilter(s: NilaiFilter) {
    setHalaman(1);
    ubah(s);
  }

  return (
    <div className="flex flex-col gap-6" data-halaman-peringkat>
      <PageHeader
        title="Peringkat Siswa"
        description="Urutan siswa dari nilai tertinggi ke terendah, dihitung dari rata-rata nilai try out yang sudah dikerjakan."
        action={
          data && data.baris.length > 0 ? (
            <>
              <a href={`${unduh}${unduh.includes("?") ? "&" : "?"}format=pdf`} download data-unduh-pdf-laporan className={buttonClassName("secondary")}>
                <FileText size={16} className="mr-2" aria-hidden="true" />
                Unduh PDF
              </a>
              <a href={unduh} download data-unduh-excel className={buttonClassName("secondary")}>
                <FileSpreadsheet size={16} className="mr-2" aria-hidden="true" />
                Unduh Excel
              </a>
            </>
          ) : undefined
        }
      />

      <TabJenis nilai={jenis} onChange={(j) => ubahFilter({ jenis: j })} jumlah={data?.jumlahSiswaPerJenis ?? null} satuan="siswa" id="tab-peringkat" />

      <div className="flex flex-wrap items-end gap-3">
        <KotakCari nilai={cari} onChange={(v) => { setCari(v); setHalaman(1); }} placeholder="Cari di daftar peringkat..." id="cariPeringkat" />
        <Pilihan
          id="mapelPeringkat"
          label="Mata pelajaran"
          nilai={nilai.mapel ?? ""}
          onChange={(v) => ubahFilter({ mapel: v })}
          opsi={[{ nilai: "", label: "Semua mata pelajaran" }, ...(data?.pilihan.mapel ?? []).map((m) => ({ nilai: m.id, label: m.nama }))]}
        />
        <Pilihan id="minimalPeringkat" label="Syarat peringkat" nilai={nilai.minimal ?? "1"} onChange={(v) => ubahFilter({ minimal: v })} opsi={OPSI_MINIMAL} />
        <SakelarAlumni ikut={nilai.alumni === "ikut"} onChange={(ikut) => ubahFilter({ alumni: ikut ? "ikut" : "tanpa" })} />
      </div>

      <FilterTanggalLipat dari={nilai.dari ?? ""} sampai={nilai.sampai ?? ""} onChange={(r) => ubahFilter(r)} />

      {galat && <Alert variant="danger">{galat}</Alert>}
      {!data && !galat && <TableSkeleton columns={7} rows={6} />}

      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Siswa diperingkat" value={data.ringkasan.jumlahSiswa} hint={nilai.alumni === "ikut" ? "Termasuk alumni" : "Siswa aktif"} />
          <StatCard label="Try out dikerjakan" value={data.ringkasan.jumlahTryOut} hint="Jumlah hasil yang dihitung" />
          <StatCard label="Rata-rata nilai" value={formatSkor(data.ringkasan.rataRata)} hint="Semua hasil try out pada daftar ini" />
        </div>
      )}

      {data && data.baris.length === 0 && (
        <EmptyState
          icon={<IconUsers />}
          title="Belum ada siswa yang bisa diperingkat"
          description="Peringkat muncul setelah siswa menyelesaikan try out. Coba ganti jenis try out, periode, atau syarat peringkatnya."
          action={
            <Button type="button" variant="secondary" onClick={() => ubahFilter({ ...BAWAAN })}>
              Kembalikan syarat awal
            </Button>
          }
        />
      )}

      {podium.length > 0 && (
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Tiga peringkat teratas" data-podium>
          {podium.map((b) => (
            <li key={b.studentId} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <LencanaPeringkat peringkat={b.peringkat} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{b.nama}</p>
                <p className="text-xs text-slate-500">
                  Rata-rata <span className="font-semibold text-slate-800">{formatSkor(b.rataRata)}</span> · {b.jumlahTryOut} try out
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {data && data.baris.length > 0 && (
        <div className={memuat ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={memuat}>
          {tampil.length === 0 ? (
            <EmptyState icon={<IconUsers />} title="Tidak ada siswa yang cocok" description={`Tidak ada nama atau NISN yang mengandung "${cari.trim()}" pada daftar peringkat ini.`} />
          ) : (
            <>
              <TableContainer>
                <Table className="min-w-[860px]">
                  <Thead>
                    <Tr>
                      <Th>Peringkat</Th>
                      <Th>Siswa</Th>
                      <Th>Try out dikerjakan</Th>
                      <Th>Rata-rata</Th>
                      <Th>Tertinggi</Th>
                      <Th>Terendah</Th>
                      <Th className="text-right">Rapor</Th>
                    </Tr>
                  </Thead>
                  <tbody>
                    {baris.map((b) => (
                      <Tr key={b.studentId} data-baris-peringkat={b.studentId}>
                        <Td>
                          <LencanaPeringkat peringkat={b.peringkat} />
                        </Td>
                        <Td className="font-medium text-slate-900">
                          <Link href={`/admin-sekolah/siswa/${b.studentId}`} className="hover:text-indigo-700 hover:underline">
                            {b.nama}
                          </Link>
                          {b.alumni && (
                            <Badge variant="neutral" className="ml-2">
                              Alumni
                            </Badge>
                          )}
                          {b.nisn && <span className="block font-mono text-xs font-normal text-slate-500">{b.nisn}</span>}
                        </Td>
                        <Td>
                          <RincianJenisTryOut perJenis={b.perJenis} total={b.jumlahTryOut} />
                        </Td>
                        <Td className="text-base">
                          <NilaiTingkat skor={b.rataRata} />
                        </Td>
                        <Td>
                          <NilaiTingkat skor={b.tertinggi} tebal={false} />
                        </Td>
                        <Td>
                          <NilaiTingkat skor={b.terendah} tebal={false} />
                        </Td>
                        <Td className="text-right">
                          <Link
                            href={`/admin-sekolah/rapor?cari=${encodeURIComponent(b.nisn ?? b.nama)}&alumni=ikut`}
                            className="whitespace-nowrap text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            Lihat rapor →
                          </Link>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
              <Pagination
                page={halamanAman}
                totalPages={totalHalaman}
                totalItems={tampil.length}
                onPageChange={setHalaman}
                pageSize={ukuran}
                onPageSizeChange={(u) => {
                  setUkuran(u);
                  setHalaman(1);
                }}
              />
            </>
          )}
        </div>
      )}

      <p className="text-xs leading-relaxed text-slate-500">
        Cara menghitung: tiap try out dinilai dari percobaan pertama siswa yang sudah selesai (mengulang tidak mengubah nilai). Peringkat
        memakai rata-rata semua try out yang dikerjakan; siswa dengan rata-rata sama (pada satu desimal) berbagi peringkat.
      </p>
    </div>
  );
}
