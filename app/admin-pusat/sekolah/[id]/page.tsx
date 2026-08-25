"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { formatWIBDate } from "@/lib/utils/datetime";
import { isSchoolActive } from "@/lib/schools/active";

type SchoolAdmin = {
  userId: string;
  user: { id: string; email: string; status: "aktif" | "nonaktif" };
};

type SchoolStatus = "pending_verifikasi" | "aktif" | "suspend";

type SchoolDetail = {
  id: string;
  nama: string;
  kodeSekolah: string;
  jenjang: "SD" | "SMP";
  npsn: string | null;
  alamat: string | null;
  status: SchoolStatus;
  kuotaSiswa: number;
  planId: string | null;
  plan: { id: string; nama: string } | null;
  langgananBerakhir: string | null;
  schoolUsers: SchoolAdmin[];
};

type PlanOption = { id: string; nama: string; target: "sekolah" | "siswa" };

type EditForm = {
  nama: string;
  jenjang: "SD" | "SMP";
  npsn: string;
  alamat: string;
  kuotaSiswa: string;
  planId: string;
  langgananBerakhir: string;
};

function toEditForm(school: SchoolDetail): EditForm {
  return {
    nama: school.nama,
    jenjang: school.jenjang,
    npsn: school.npsn ?? "",
    alamat: school.alamat ?? "",
    kuotaSiswa: String(school.kuotaSiswa),
    planId: school.planId ?? "",
    langgananBerakhir: school.langgananBerakhir ? school.langgananBerakhir.slice(0, 10) : "",
  };
}

const STATUS_LABEL: Record<SchoolStatus, string> = {
  pending_verifikasi: "Menunggu verifikasi",
  aktif: "Aktif",
  suspend: "Suspend",
};
const STATUS_BADGE_VARIANT: Record<SchoolStatus, "warning" | "success" | "danger"> = {
  pending_verifikasi: "warning",
  aktif: "success",
  suspend: "danger",
};

export default function SekolahDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [nama, setNama] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(
    null,
  );

  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-pusat/schools/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (!ignore) setSchool(data.school);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id, refreshKey]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/plans");
      if (res.ok) {
        const data = await res.json();
        if (!ignore) setPlanOptions(data.plans ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleCreateAdmin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin-pusat/school-admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId: id, email, nama }),
    });
    const data = await res.json();

    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Gagal membuat akun admin sekolah.");
      return;
    }

    setTempPassword({ email, password: data.tempPassword });
    setEmail("");
    setNama("");
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function toggleStatus(admin: SchoolAdmin) {
    const nextStatus = admin.user.status === "aktif" ? "nonaktif" : "aktif";
    await fetch(`/api/admin-pusat/school-admins/${admin.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setRefreshKey((k) => k + 1);
  }

  async function handleChangeStatus(nextStatus: SchoolStatus) {
    await fetch(`/api/admin-pusat/schools/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setRefreshKey((k) => k + 1);
  }

  function handleOpenEdit() {
    if (school) setEditForm(toEditForm(school));
    setEditError(null);
    setShowEditForm(true);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editForm) return;
    setEditError(null);
    setEditSubmitting(true);

    const res = await fetch(`/api/admin-pusat/schools/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama: editForm.nama,
        jenjang: editForm.jenjang,
        npsn: editForm.npsn,
        alamat: editForm.alamat,
        kuotaSiswa: editForm.kuotaSiswa,
        planId: editForm.planId,
        langgananBerakhir: editForm.langgananBerakhir || null,
      }),
    });
    const data = await res.json().catch(() => null);
    setEditSubmitting(false);

    if (!res.ok) {
      setEditError(data?.error ?? "Gagal menyimpan perubahan.");
      return;
    }
    setShowEditForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDeleteSchool() {
    if (!school) return;
    if (
      !window.confirm(
        `Hapus sekolah "${school.nama}" secara permanen? Tindakan ini tidak bisa dibatalkan.`,
      )
    ) {
      return;
    }
    setDeleteError(null);
    const res = await fetch(`/api/admin-pusat/schools/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setDeleteError(data?.error ?? "Gagal menghapus sekolah.");
      return;
    }
    router.push("/admin-pusat/sekolah");
  }

  if (!school) {
    return <p className="text-sm text-slate-500">Memuat...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin-pusat/sekolah" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke daftar sekolah
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{school.nama}</h1>
          <Badge variant={STATUS_BADGE_VARIANT[school.status]}>
            {STATUS_LABEL[school.status]}
          </Badge>
        </div>
        <p className="text-sm text-slate-500">
          Kode Sekolah <span className="font-mono">{school.kodeSekolah}</span> · {school.jenjang}{" "}
          · Kuota {school.kuotaSiswa} siswa
          {school.plan && ` · Paket ${school.plan.nama}`}
          {school.langgananBerakhir &&
            ` · Langganan sampai ${formatWIBDate(school.langgananBerakhir)}`}
        </p>
        {!isSchoolActive(school) && (
          <p className="mt-1 text-sm text-amber-700">
            Sekolah ini tidak aktif
            {school.status === "aktif" && school.langgananBerakhir
              ? ` (langganan berakhir ${formatWIBDate(school.langgananBerakhir)})`
              : ""}
            {" — "}pendaftaran siswa Jalur A baru akan ditolak, dan akun admin sekolah maupun
            siswa yang sudah ada akan otomatis ter-logout begitu mereka membuka halaman
            berikutnya.
          </p>
        )}
        {deleteError && (
          <Alert variant="danger" className="mt-2">
            {deleteError}
          </Alert>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          {school.status !== "aktif" ? (
            <Button variant="secondary" onClick={() => handleChangeStatus("aktif")}>
              Aktifkan sekolah
            </Button>
          ) : (
            <Button variant="danger" onClick={() => handleChangeStatus("suspend")}>
              Suspend sekolah
            </Button>
          )}
          <Button variant="secondary" onClick={handleOpenEdit}>
            Edit sekolah
          </Button>
          <Button variant="danger" onClick={handleDeleteSchool}>
            Hapus sekolah
          </Button>
        </div>

        {showEditForm && editForm && (
          <form
            onSubmit={handleEditSubmit}
            className="mt-4 flex max-w-xl flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
          >
            {editError && <Alert variant="danger">{editError}</Alert>}
            <div>
              <Label htmlFor="editNama">Nama sekolah</Label>
              <Input
                id="editNama"
                required
                value={editForm.nama}
                onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editJenjang">Jenjang</Label>
                <select
                  id="editJenjang"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={editForm.jenjang}
                  onChange={(e) =>
                    setEditForm({ ...editForm, jenjang: e.target.value as "SD" | "SMP" })
                  }
                >
                  <option value="SD">SD</option>
                  <option value="SMP">SMP</option>
                </select>
              </div>
              <div>
                <Label htmlFor="editNpsn">NPSN (opsional)</Label>
                <Input
                  id="editNpsn"
                  placeholder="8 digit"
                  value={editForm.npsn}
                  onChange={(e) => setEditForm({ ...editForm, npsn: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="editAlamat">Alamat (opsional)</Label>
              <Input
                id="editAlamat"
                value={editForm.alamat}
                onChange={(e) => setEditForm({ ...editForm, alamat: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editKuota">Kuota siswa</Label>
                <Input
                  id="editKuota"
                  type="number"
                  min={1}
                  required
                  value={editForm.kuotaSiswa}
                  onChange={(e) => setEditForm({ ...editForm, kuotaSiswa: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editPlan">Paket langganan (opsional)</Label>
                <select
                  id="editPlan"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={editForm.planId}
                  onChange={(e) => setEditForm({ ...editForm, planId: e.target.value })}
                >
                  <option value="">- Belum dipasangkan -</option>
                  {planOptions
                    .filter((p) => p.target === "sekolah")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="editLangganan">Langganan berakhir (opsional)</Label>
              <Input
                id="editLangganan"
                type="date"
                value={editForm.langgananBerakhir}
                onChange={(e) =>
                  setEditForm({ ...editForm, langgananBerakhir: e.target.value })
                }
              />
              <p className="mt-1 text-xs text-slate-500">
                Sesuai Bagian 0.1 brief: langganan sekolah per tahun, tanpa siklus baku -
                tanggal berakhir diatur manual per sekolah.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? "Menyimpan..." : "Simpan perubahan"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowEditForm(false)}>
                Batal
              </Button>
            </div>
          </form>
        )}
      </div>

      {tempPassword && (
        <Alert variant="warning">
          <p className="font-medium">
            Akun untuk {tempPassword.email} berhasil dibuat. Catat password sementara ini
            sekarang — tidak akan ditampilkan lagi:
          </p>
          <p className="mt-1 font-mono text-base">{tempPassword.password}</p>
          <p className="mt-1">
            Sampaikan lewat jalur aman (bukan email) ke admin sekolah. Mereka wajib
            menggantinya saat login pertama.
          </p>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Akun Admin Sekolah</h2>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Batal" : "Tambah admin sekolah"}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreateAdmin}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          {error && <Alert variant="danger">{error}</Alert>}
          <div>
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" required value={nama} onChange={(e) => setNama(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? "Membuat..." : "Buat akun"}
          </Button>
        </form>
      )}

      {school.schoolUsers.length === 0 ? (
        <EmptyState
          title="Belum ada admin sekolah"
          description="Buat akun admin sekolah supaya sekolah ini bisa mulai mengelola siswa & soal."
          action={<Button onClick={() => setShowForm(true)}>Tambah admin sekolah</Button>}
        />
      ) : (
        <TableContainer>
          <Table>
            <Thead>
              <tr>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </Thead>
            <tbody>
              {school.schoolUsers.map((admin) => (
                <Tr key={admin.userId}>
                  <Td>{admin.user.email}</Td>
                  <Td>{admin.user.status}</Td>
                  <Td className="text-right">
                    <button
                      onClick={() => toggleStatus(admin)}
                      className="text-sm font-medium text-slate-600 hover:text-slate-900"
                    >
                      {admin.user.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
