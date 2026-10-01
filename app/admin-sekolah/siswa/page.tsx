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
import { Download, FileSpreadsheet } from "lucide-react";

type StudentRow = {
  id: string;
  nama: string;
  nisn: string | null;
  claimToken: string | null;
  claimStatus: "belum_klaim" | "sudah_klaim";
  status: string;
};

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

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-sekolah/siswa");
      const data = await res.json();
      if (!ignore) {
        setStudents(data.students ?? []);
        setPage(1);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

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
      description: "Riwayat nilai tetap tersimpan.",
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

      <KuotaSummary />

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

      {students === null && <TableSkeleton columns={5} />}
      {students?.length === 0 && (
        <EmptyState
          icon={<IconUsers />}
          title="Belum ada siswa"
          description="Import dari Excel atau tambah satu per satu."
          action={<Button onClick={() => setShowForm(true)}>Tambah siswa</Button>}
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
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Nama</Th>
                <Th>NISN</Th>
                <Th>Kode Klaim</Th>
                <Th>Status</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <tbody>
              {pageStudents.map((s) => (
                <Tr key={s.id}>
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
                    <Badge variant={CLAIM_VARIANT[s.claimStatus]}>{CLAIM_LABEL[s.claimStatus]}</Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      {s.claimStatus === "belum_klaim" && (
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
