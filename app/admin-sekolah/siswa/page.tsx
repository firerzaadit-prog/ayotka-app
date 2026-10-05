"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconUsers, IconSearch } from "@/components/ui/empty-state-icons";
import { useToast } from "@/components/ui/toast";
import { useDialog } from "@/components/ui/dialog";
import { KuotaSummary } from "@/components/sekolah/kuota-summary";
import { ImportSiswaModal } from "@/components/sekolah/import-siswa-modal";
import {
  BilahHapusMassal,
  CentangSemuaHalaman,
  useHapusMassal,
  useLulusMassal,
  usePilihan,
} from "@/components/sekolah/hapus-massal";
import { KodeSekolahCard } from "@/components/sekolah/kode-sekolah-card";
import { Download, FileSpreadsheet } from "lucide-react";

type StudentRow = {
  id: string;
  nama: string;
  nisn: string | null;
  claimToken: string | null;
  claimStatus: "belum_klaim" | "sudah_klaim";
  status: string;
  /** Terisi = alumni (ditandai lulus). */
  lulusAt: string | null;
};

type TabSiswa = "aktif" | "alumni";

const CLAIM_LABEL: Record<string, string> = { belum_klaim: "Belum klaim", sudah_klaim: "Sudah klaim" };
const CLAIM_VARIANT: Record<string, "warning" | "success"> = {
  belum_klaim: "warning",
  sudah_klaim: "success",
};

export default function KelolaSiswaPage() {
  const toast = useToast();
  const { confirm, alertDialog } = useDialog();
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [showForm, setShowForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [nama, setNama] = useState("");
  const [nisn, setNisn] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<TabSiswa>("aktif");
  const [jumlah, setJumlah] = useState<{ aktif: number; alumni: number } | null>(null);
  const [kodeSekolah, setKodeSekolah] = useState<string | null>(null);
  const pilihan = usePilihan();
  const hapusMassal = useHapusMassal(() => {
    pilihan.kosongkan();
    setRefreshKey((k) => k + 1);
  });
  const lulusMassal = useLulusMassal(() => {
    pilihan.kosongkan();
    setRefreshKey((k) => k + 1);
  });

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-sekolah/siswa?status=${tab}`);
      const data = await res.json();
      if (!ignore) {
        setStudents(data.students ?? []);
        setJumlah(data.jumlah ?? null);
        setKodeSekolah(data.kodeSekolah ?? null);
        setPage(1);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey, tab]);

  function pindahTab(berikut: TabSiswa) {
    if (berikut === tab) return;
    setTab(berikut);
    setStudents(null);
    setSearch("");
    setPage(1);
    pilihan.kosongkan();
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin-sekolah/siswa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama, nisn, tanggalLahir }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal menambah siswa.");
      return;
    }

    setNama("");
    setNisn("");
    setTanggalLahir("");
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleResetKode(id: string) {
    const ok = await confirm({ title: "Reset kode klaim siswa ini?" });
    if (!ok) return;
    const res = await fetch(`/api/admin-sekolah/siswa/${id}/reset-kode-klaim`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      toast.error(data?.error ?? "Gagal reset kode klaim.");
    }
  }

  async function handleResetPassword(id: string) {
    const ok = await confirm({
      title: "Reset password akun siswa ini?",
      description: "Password lama tidak akan berlaku lagi.",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin-sekolah/siswa/${id}/reset-password`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      await alertDialog({
        title: "Password berhasil direset",
        description: `Password sementara: ${data.tempPassword}\n\nSampaikan ke siswa lewat jalur lain (bukan chat/email ini). Siswa wajib ganti password saat login berikutnya.`,
      });
    } else {
      toast.error(data?.error ?? "Gagal reset password.");
    }
  }

  async function handleDelete(id: string, nama: string) {
    const ok = await confirm({
      title: `Hapus siswa "${nama}"?`,
      description:
        "Data siswa dan akun loginnya dihapus, NISN-nya bisa ditambahkan lagi, dan siswa hilang dari analitik sekolah. Untuk siswa yang sudah lulus, gunakan Tandai lulus supaya nilainya tetap tampil di analitik.",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin-sekolah/siswa/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      toast.error(data?.error ?? "Gagal menghapus siswa.");
    }
  }

  const filteredStudents = (students ?? []).filter((s) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return s.nama.toLowerCase().includes(q) || (s.nisn ?? "").toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const pageStudents = filteredStudents.slice((page - 1) * pageSize, page * pageSize);
  // Yang dihapus hanya yang dicentang DAN masih tampil menurut pencarian saat ini - jumlah di bilah = jumlah yang dihapus.
  const idSemua = filteredStudents.map((s) => s.id);
  const idHalaman = pageStudents.map((s) => s.id);
  const terpilih = idSemua.filter((id) => pilihan.dipilih.has(id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kelola Siswa"
        description="Input satuan, import Excel/CSV, atau cetak kartu kode klaim."
        action={
          <>
            <a
              href="/api/admin-sekolah/siswa/template"
              download
              className={buttonClassName("secondary")}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Unduh Template Excel
            </a>
            <Button
              variant="secondary"
              onClick={() => setShowImportModal(true)}
            >
              <FileSpreadsheet className="mr-1.5 h-4 w-4 text-indigo-600" />
              Import Excel
            </Button>
            <Link href="/api/admin-sekolah/siswa/kartu-klaim" className={buttonClassName("secondary")}>
              Cetak kartu klaim
            </Link>
            <Link href="/admin-sekolah/periode-baru" className={buttonClassName("secondary")}>
              Periode Baru
            </Link>
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Batal" : "Tambah siswa"}</Button>
          </>
        }
      />

      <ImportSiswaModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
        role="admin_sekolah"
      />

      {kodeSekolah && <KodeSekolahCard kodeSekolah={kodeSekolah} />}

      <KuotaSummary />

      <div role="tablist" aria-label="Status siswa" className="flex gap-1 border-b border-slate-200">
        {(["aktif", "alumni"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => pindahTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t === "aktif" ? "Aktif" : "Alumni"}
            {jumlah && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {jumlah[t].toLocaleString("id-ID")}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-56">
          <Label htmlFor="searchSiswa">Cari nama/NISN</Label>
          <Input
            id="searchSiswa"
            placeholder="Ketik nama atau NISN..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          {error && <Alert variant="danger" className="w-full">{error}</Alert>}
          <div className="flex-1">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" required value={nama} onChange={(e) => setNama(e.target.value)} />
          </div>
          <div className="w-40">
            <Label htmlFor="nisn">NISN (opsional)</Label>
            <Input id="nisn" value={nisn} onChange={(e) => setNisn(e.target.value)} />
          </div>
          <div className="w-40">
            <Label htmlFor="tanggalLahir">Tanggal lahir</Label>
            <Input
              id="tanggalLahir"
              type="date"
              value={tanggalLahir}
              onChange={(e) => setTanggalLahir(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      )}

      {students === null && <TableSkeleton columns={6} />}
      {students?.length === 0 && tab === "aktif" && (
        <EmptyState
          icon={<IconUsers />}
          title="Belum ada siswa"
          description="Import dari Excel atau tambah satu per satu."
          action={<Button onClick={() => setShowForm(true)}>Tambah siswa</Button>}
        />
      )}
      {students?.length === 0 && tab === "alumni" && (
        <EmptyState
          icon={<IconUsers />}
          title="Belum ada alumni"
          description="Siswa yang lulus bisa dicentang di tab Aktif lalu ditandai lulus. Nilai mereka tetap tersimpan dan tetap terhitung di analitik."
        />
      )}
      {students && students.length > 0 && filteredStudents.length === 0 && (
        <EmptyState
          icon={<IconSearch />}
          title="Tidak ditemukan"
          description={`Tidak ada siswa yang cocok dengan "${search}".`}
        />
      )}

      {filteredStudents.length > 0 && (
        <>
        <BilahHapusMassal
          jumlahDipilih={terpilih.length}
          jumlahSemua={idSemua.length}
          sedangHapus={hapusMassal.sedangHapus || lulusMassal.sedangUbah}
          onPilihSemua={() => pilihan.aturBanyak(idSemua, true)}
          onBatal={pilihan.kosongkan}
          onHapus={() => hapusMassal.hapus(terpilih)}
          aksiLain={
            tab === "aktif"
              ? { label: "Tandai lulus", onClick: () => lulusMassal.ubah(terpilih, true) }
              : { label: "Batalkan lulus", onClick: () => lulusMassal.ubah(terpilih, false) }
          }
        />
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th className="w-10">
                  <CentangSemuaHalaman
                    idHalaman={idHalaman}
                    dipilih={pilihan.dipilih}
                    onUbah={(nyala) => pilihan.aturBanyak(idHalaman, nyala)}
                  />
                </Th>
                <Th>Nama</Th>
                <Th>NISN</Th>
                <Th>Kode Klaim</Th>
                <Th>Status</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <tbody>
              {pageStudents.map((s) => (
                <Tr key={s.id} className={pilihan.dipilih.has(s.id) ? "bg-indigo-50/40" : undefined}>
                  <Td className="w-10">
                    <input
                      type="checkbox"
                      aria-label={`Pilih ${s.nama}`}
                      className="accent-indigo-600"
                      checked={pilihan.dipilih.has(s.id)}
                      onChange={() => pilihan.toggle(s.id)}
                    />
                  </Td>
                  <Td className="font-medium text-slate-900">
                    <Link
                      href={`/admin-sekolah/siswa/${s.id}`}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      {s.nama}
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs">{s.nisn ?? "-"}</Td>
                  <Td className="font-mono text-xs">
                    {s.claimStatus === "belum_klaim" ? s.claimToken : "-"}
                  </Td>
                  <Td>
                    {s.lulusAt ? (
                      <Badge variant="info">Alumni</Badge>
                    ) : (
                      <Badge variant={CLAIM_VARIANT[s.claimStatus]}>{CLAIM_LABEL[s.claimStatus]}</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      {s.claimStatus === "belum_klaim" && !s.lulusAt && (
                        <button
                          onClick={() => handleResetKode(s.id)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          Reset kode
                        </button>
                      )}
                      {s.claimStatus === "sudah_klaim" && (
                        <button
                          onClick={() => handleResetPassword(s.id)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          Reset password
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(s.id, s.nama)}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                      >
                        Hapus
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={filteredStudents.length}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
        </>
      )}
    </div>
  );
}
