"use client";

import Link from "next/link";

import { useEffect, useState, type FormEvent } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconUsers, IconSearch } from "@/components/ui/empty-state-icons";
import { useToast } from "@/components/ui/toast";
import { useDialog } from "@/components/ui/dialog";
import { ImportSiswaModal } from "@/components/sekolah/import-siswa-modal";
import {
  BilahHapusMassal,
  CentangSemuaHalaman,
  useHapusMassal,
  usePilihan,
} from "@/components/sekolah/hapus-massal";
import { Download, FileSpreadsheet } from "lucide-react";

type SchoolOption = { id: string; nama: string };
type StudentRow = {
  id: string;
  nama: string;
  nisn: string | null;
  jalur: "A" | "B";
  claimStatus: "belum_klaim" | "sudah_klaim";
  status: "pending" | "active" | "nonaktif";
  school: { id: string; nama: string } | null;
};

const JALUR_LABEL: Record<string, string> = { A: "Jalur A (sekolah)", B: "Jalur B (mandiri)" };
const CLAIM_LABEL: Record<string, string> = {
  belum_klaim: "Belum klaim",
  sudah_klaim: "Sudah klaim",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  active: "Aktif",
  nonaktif: "Nonaktif",
};

const SELECT_CLASS =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

export default function SemuaSiswaPage() {
  const toast = useToast();
  const { confirm } = useDialog();
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [filterSchoolId, setFilterSchoolId] = useState("");
  const [filterJalur, setFilterJalur] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [refreshKey, setRefreshKey] = useState(0);
  const pilihan = usePilihan();
  const hapusMassal = useHapusMassal(() => {
    pilihan.kosongkan();
    setRefreshKey((k) => k + 1);
  });

  const [showForm, setShowForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [formSchoolId, setFormSchoolId] = useState("");
  const [nama, setNama] = useState("");
  const [nisn, setNisn] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/schools");
      const data = await res.json();
      if (!ignore) setSchools(data.schools ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const params = new URLSearchParams();
      if (filterSchoolId) params.set("schoolId", filterSchoolId);
      if (filterJalur) params.set("jalur", filterJalur);
      const res = await fetch(`/api/admin-pusat/siswa?${params.toString()}`);
      const data = await res.json();
      if (!ignore) {
        setStudents(data.students ?? []);
        setPage(1);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [filterSchoolId, filterJalur, refreshKey]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!formSchoolId) {
      setError("Pilih sekolah dulu.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin-sekolah/siswa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama, nisn, tanggalLahir, schoolId: formSchoolId }),
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
    setFormSchoolId("");
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(id: string, namaSiswa: string) {
    const ok = await confirm({
      title: `Hapus siswa "${namaSiswa}"?`,
      description:
        "Data siswa dan akun loginnya dihapus, NISN-nya bisa ditambahkan lagi. Kalau siswa sudah pernah mengerjakan ujian, riwayat nilainya tetap tersimpan.",
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

  const filteredStudents = (students ?? []).filter((s) =>
    search.trim() ? s.nama.toLowerCase().includes(search.trim().toLowerCase()) : true,
  );
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const pageStudents = filteredStudents.slice((page - 1) * pageSize, page * pageSize);
  // Hanya siswa Jalur A (terikat sekolah) yang bisa dihapus lewat sini; Jalur B tidak punya kotak centang.
  const bisaDihapus = (s: StudentRow) => s.jalur === "A" && s.school != null;
  const idSemua = filteredStudents.filter(bisaDihapus).map((s) => s.id);
  const idHalaman = pageStudents.filter(bisaDihapus).map((s) => s.id);
  // Yang dihapus hanya yang dicentang DAN masih tampil menurut filter saat ini - jumlah di bilah = jumlah yang dihapus.
  const terpilih = idSemua.filter((id) => pilihan.dipilih.has(id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Semua Siswa"
        description="Gabungan siswa Jalur A (kerja sama sekolah) dan Jalur B (mandiri) di semua sekolah."
        action={
          <div className="flex flex-wrap items-center gap-2">
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
            <Button onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Batal" : "Tambah siswa"}
            </Button>
          </div>
        }
      />

      <ImportSiswaModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
        role="admin_pusat"
        schools={schools}
        defaultSchoolId={filterSchoolId}
      />

      <div className="flex flex-wrap gap-3">
        <div className="w-64">
          <Label htmlFor="filterSchool">Filter sekolah</Label>
          <select
            id="filterSchool"
            className={SELECT_CLASS}
            value={filterSchoolId}
            onChange={(e) => setFilterSchoolId(e.target.value)}
          >
            <option value="">Semua sekolah</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
          </select>
        </div>
        <div className="w-48">
          <Label htmlFor="filterJalur">Filter jalur</Label>
          <select
            id="filterJalur"
            className={SELECT_CLASS}
            value={filterJalur}
            onChange={(e) => setFilterJalur(e.target.value)}
          >
            <option value="">Semua jalur</option>
            <option value="A">Jalur A (sekolah)</option>
            <option value="B">Jalur B (mandiri)</option>
          </select>
        </div>
        <div className="w-56">
          <Label htmlFor="searchNama">Cari nama</Label>
          <Input
            id="searchNama"
            placeholder="Ketik nama siswa..."
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
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          {error && <Alert variant="danger">{error}</Alert>}
          <p className="text-xs text-slate-500">
            Menambah siswa lewat sini selalu Jalur A (siswa dapat kode klaim) — untuk Jalur B,
            siswa mendaftar mandiri sendiri lewat halaman registrasi.
          </p>
          <div>
            <Label htmlFor="formSchool">Sekolah</Label>
            <select
              id="formSchool"
              required
              className={SELECT_CLASS}
              value={formSchoolId}
              onChange={(e) => setFormSchoolId(e.target.value)}
            >
              <option value="">Pilih sekolah</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nama">Nama</Label>
              <Input id="nama" required value={nama} onChange={(e) => setNama(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="nisn">NISN (opsional)</Label>
              <Input id="nisn" value={nisn} onChange={(e) => setNisn(e.target.value)} />
            </div>
          </div>
          <div className="w-48">
            <Label htmlFor="tanggalLahir">Tanggal lahir</Label>
            <Input
              id="tanggalLahir"
              type="date"
              value={tanggalLahir}
              onChange={(e) => setTanggalLahir(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      )}

      {students === null && <TableSkeleton columns={7} />}
      {students?.length === 0 && (
        <EmptyState
          icon={<IconUsers />}
          title="Belum ada siswa"
          description="Tidak ada siswa yang cocok dengan filter ini."
        />
      )}
      {students && students.length > 0 && filteredStudents.length === 0 && (
        <EmptyState
          icon={<IconSearch />}
          title="Tidak ditemukan"
          description={`Tidak ada siswa dengan nama yang cocok dengan "${search}".`}
        />
      )}

      {filteredStudents.length > 0 && (
        <>
        <BilahHapusMassal
          jumlahDipilih={terpilih.length}
          jumlahSemua={idSemua.length}
          sedangHapus={hapusMassal.sedangHapus}
          onPilihSemua={() => pilihan.aturBanyak(idSemua, true)}
          onBatal={pilihan.kosongkan}
          onHapus={() => hapusMassal.hapus(terpilih)}
        />
        <TableContainer>
          <Table>
            <Thead>
              <tr>
                <Th className="w-10">
                  <CentangSemuaHalaman
                    idHalaman={idHalaman}
                    dipilih={pilihan.dipilih}
                    onUbah={(nyala) => pilihan.aturBanyak(idHalaman, nyala)}
                  />
                </Th>
                <Th>Nama</Th>
                <Th>Sekolah</Th>
                <Th>Jalur</Th>
                <Th>Klaim</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </Thead>
            <tbody>
              {pageStudents.map((s) => (
                <Tr key={s.id} className={pilihan.dipilih.has(s.id) ? "bg-indigo-50/40" : undefined}>
                  <Td className="w-10">
                    {bisaDihapus(s) && (
                      <input
                        type="checkbox"
                        aria-label={`Pilih ${s.nama}`}
                        className="accent-indigo-600"
                        checked={pilihan.dipilih.has(s.id)}
                        onChange={() => pilihan.toggle(s.id)}
                      />
                    )}
                  </Td>
                  <Td className="font-medium">
                    <Link href={`/admin-pusat/siswa/${s.id}`} className="text-indigo-600 hover:text-indigo-800 hover:underline">
                      {s.nama}
                    </Link>
                  </Td>
                  <Td>{s.school?.nama ?? "-"}</Td>
                  <Td>{JALUR_LABEL[s.jalur]}</Td>
                  <Td>{CLAIM_LABEL[s.claimStatus]}</Td>
                  <Td>{STATUS_LABEL[s.status]}</Td>
                  <Td className="text-right">
                    <button
                      onClick={() => handleDelete(s.id, s.nama)}
                      className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                    >
                      Hapus
                    </button>
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
