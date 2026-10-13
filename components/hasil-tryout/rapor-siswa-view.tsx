"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconDocument } from "@/components/ui/empty-state-icons";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { useDataLaporan, useFilterAlamat, useTunda } from "@/components/hasil-tryout/use-laporan";
import { BadgeJenis, FilterTanggalLipat, KotakCari, NilaiTingkat, Pilihan, SakelarAlumni, TabJenis, TombolPdf } from "@/components/hasil-tryout/elemen";
import type { NilaiFilter } from "@/lib/hasil-tryout/alamat";
import { formatSkor } from "@/lib/hasil-tryout/format";
import type { FilterJenis, JenisTryOut } from "@/lib/hasil-tryout/jenis";
import { LABEL_URUTAN_RAPOR, URUTAN_RAPOR_TERSEDIA, type RingkasanHasil } from "@/lib/hasil-tryout/susun";
import type { BarisRapor } from "@/lib/hasil-tryout/tampil";
import { formatWIB } from "@/lib/utils/datetime";

type RespRapor = {
  baris: BarisRapor[];
  halaman: number;
  ukuran: number;
  total: number;
  totalHalaman: number;
  jumlahPerJenis: Record<FilterJenis, number>;
  ringkasan: RingkasanHasil;
  pilihan: { mapel: Array<{ id: string; nama: string }>; paket: Array<{ id: string; nama: string; mapelId: string; jenis: JenisTryOut[] }> };
};

const BAWAAN: NilaiFilter = { jenis: "semua", mapel: "", paket: "", dari: "", sampai: "", alumni: "ikut", cari: "", urut: "terbaru", halaman: "", ukuran: "20" };

/**
 * Halaman Rapor Siswa (admin sekolah): hasil resmi tiap siswa pada tiap try out, dipisah per jenis. Tiap baris punya tombol
 * unduh PDF. Data dan aturannya dari /api/admin-sekolah/rapor (lib/hasil-tryout).
 */
export function RaporSiswaView({ awal }: { awal: NilaiFilter }) {
  const { nilai, ubah, query } = useFilterAlamat("/admin-sekolah/rapor", awal, BAWAAN);
  const { data, galat, memuat } = useDataLaporan<RespRapor>("/api/admin-sekolah/rapor", query);

  // Pencarian ditunda sebentar supaya tidak meminta data di setiap ketukan huruf.
  const [cari, setCari] = useState(nilai.cari ?? "");
  const cariTunda = useTunda(cari);
  useEffect(() => {
    if (cariTunda !== (nilai.cari ?? "")) ubah({ cari: cariTunda });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya bereaksi pada nilai pencarian yang sudah ditunda
  }, [cariTunda]);

  const jenis = (nilai.jenis ?? "semua") as FilterJenis;
  const paketPilihan = (data?.pilihan.paket ?? []).filter(
    (p) => (!nilai.mapel || p.mapelId === nilai.mapel) && (jenis === "semua" || p.jenis.includes(jenis as JenisTryOut)),
  );
  const adaSyarat = Boolean(nilai.mapel || nilai.paket || nilai.dari || nilai.sampai || nilai.cari || nilai.alumni !== "ikut");
  const kosongSama = data !== null && data.total === 0;

  function atur(ulang: NilaiFilter) {
    setCari(ulang.cari ?? cari);
    ubah(ulang);
  }

  return (
    <div className="flex flex-col gap-6" data-halaman-rapor>
      <PageHeader
        title="Rapor Siswa"
        description="Hasil try out setiap siswa, dipisah per jenis try out. Unduh rapor PDF tiap siswa dari kolom paling kanan."
      />

      <TabJenis nilai={jenis} onChange={(j) => ubah({ jenis: j, paket: "" })} jumlah={data?.jumlahPerJenis ?? null} satuan="rapor" id="tab-rapor" />

      <div className="flex flex-wrap items-end gap-3">
        <KotakCari nilai={cari} onChange={setCari} id="cariRapor" />
        <Pilihan
          id="mapelRapor"
          label="Mata pelajaran"
          nilai={nilai.mapel ?? ""}
          onChange={(v) => ubah({ mapel: v, paket: "" })}
          opsi={[{ nilai: "", label: "Semua mata pelajaran" }, ...(data?.pilihan.mapel ?? []).map((m) => ({ nilai: m.id, label: m.nama }))]}
        />
        <Pilihan
          id="paketRapor"
          label="Paket"
          nilai={nilai.paket ?? ""}
          onChange={(v) => ubah({ paket: v })}
          className="min-w-56"
          opsi={[{ nilai: "", label: "Semua paket" }, ...paketPilihan.map((p) => ({ nilai: p.id, label: p.nama }))]}
        />
        <Pilihan
          id="urutRapor"
          label="Urutkan"
          nilai={nilai.urut ?? "terbaru"}
          onChange={(v) => ubah({ urut: v })}
          opsi={URUTAN_RAPOR_TERSEDIA.map((u) => ({ nilai: u, label: LABEL_URUTAN_RAPOR[u] }))}
        />
        <SakelarAlumni ikut={(nilai.alumni ?? "ikut") === "ikut"} onChange={(ikut) => ubah({ alumni: ikut ? "ikut" : "tanpa" })} />
      </div>

      <FilterTanggalLipat dari={nilai.dari ?? ""} sampai={nilai.sampai ?? ""} onChange={(r) => ubah(r)} />

      {galat && <Alert variant="danger">{galat}</Alert>}

      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Rapor ditampilkan" value={data.ringkasan.jumlahHasil} hint="Satu rapor = satu siswa pada satu try out" />
          <StatCard label="Siswa" value={data.ringkasan.jumlahSiswa} hint="Siswa berbeda pada daftar ini" />
          <StatCard label="Rata-rata nilai" value={formatSkor(data.ringkasan.rataRata)} hint="Dari percobaan pertama tiap try out" />
        </div>
      )}

      {!data && !galat && <TableSkeleton columns={6} rows={6} />}

      {kosongSama && (
        <EmptyState
          icon={<IconDocument />}
          title={adaSyarat || jenis !== "semua" ? "Tidak ada rapor yang cocok" : "Belum ada hasil try out"}
          description={
            adaSyarat || jenis !== "semua"
              ? "Coba ganti jenis try out, mata pelajaran, atau periode tanggalnya."
              : "Rapor muncul di sini begitu siswa menyelesaikan try out."
          }
          action={
            adaSyarat || jenis !== "semua" ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => atur({ jenis: "semua", mapel: "", paket: "", dari: "", sampai: "", alumni: "ikut", cari: "" })}
              >
                Hapus semua syarat
              </Button>
            ) : undefined
          }
        />
      )}

      {data && data.total > 0 && (
        <div className={memuat ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={memuat}>
          <TableContainer>
            <Table className="min-w-[760px]">
              <Thead>
                <Tr>
                  <Th>Siswa</Th>
                  <Th>Try out</Th>
                  <Th>Jenis</Th>
                  <Th>Tanggal</Th>
                  <Th>Nilai</Th>
                  <Th className="text-right">Rapor</Th>
                </Tr>
              </Thead>
              <tbody>
                {data.baris.map((b) => (
                  <Tr key={b.attemptId} data-baris-rapor={b.attemptId}>
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
                      <Link href={`/admin-sekolah/paket/${b.paketId}`} className="font-medium text-slate-800 hover:text-indigo-700 hover:underline">
                        {b.paketNama}
                      </Link>
                      <span className="block text-xs text-slate-500">{b.mapel}</span>
                    </Td>
                    <Td>
                      <BadgeJenis jenis={b.jenis} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-slate-600">
                      {formatWIB(b.mulaiAt, "d MMM yyyy")}
                      {b.status === "kedaluwarsa" && <span className="block text-amber-700">Waktu habis</span>}
                    </Td>
                    <Td className="text-base">
                      <NilaiTingkat skor={b.skor} />
                    </Td>
                    <Td className="text-right">
                      <TombolPdf attemptId={b.attemptId} nama={b.nama} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
          <Pagination
            page={data.halaman}
            totalPages={data.totalHalaman}
            totalItems={data.total}
            onPageChange={(h) => ubah({ halaman: h <= 1 ? "" : String(h) })}
            pageSize={data.ukuran}
            onPageSizeChange={(u) => ubah({ ukuran: String(u), halaman: "" })}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      )}
    </div>
  );
}
