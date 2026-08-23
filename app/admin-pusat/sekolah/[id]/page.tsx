"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { formatWIBDate } from "@/lib/utils/datetime";

type SchoolAdmin = {
  userId: string;
  user: { id: string; email: string; status: "aktif" | "nonaktif" };
};

type SchoolDetail = {
  id: string;
  nama: string;
  kodeSekolah: string;
  jenjang: "SD" | "SMP";
  status: string;
  kuotaSiswa: number;
  langgananBerakhir: string | null;
  schoolUsers: SchoolAdmin[];
};

export default function SekolahDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [nama, setNama] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(
    null,
  );

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

  if (!school) {
    return <p className="text-sm text-slate-500">Memuat...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin-pusat/sekolah" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Kembali ke daftar sekolah
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{school.nama}</h1>
        <p className="text-sm text-slate-500">
          Kode Sekolah <span className="font-mono">{school.kodeSekolah}</span> · {school.jenjang}{" "}
          · Kuota {school.kuotaSiswa} siswa
          {school.langgananBerakhir &&
            ` · Langganan sampai ${formatWIBDate(school.langgananBerakhir)}`}
        </p>
      </div>

      {tempPassword && (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">
            Akun untuk {tempPassword.email} berhasil dibuat. Catat password sementara ini
            sekarang — tidak akan ditampilkan lagi:
          </p>
          <p className="mt-1 font-mono text-base">{tempPassword.password}</p>
          <p className="mt-1">
            Sampaikan lewat jalur aman (bukan email) ke admin sekolah. Mereka wajib
            menggantinya saat login pertama.
          </p>
        </div>
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
          className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
        >
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
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
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {school.schoolUsers.map((admin) => (
                <tr key={admin.userId} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{admin.user.email}</td>
                  <td className="px-4 py-2">{admin.user.status}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => toggleStatus(admin)}
                      className="text-sm font-medium text-slate-600 hover:text-slate-900"
                    >
                      {admin.user.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
