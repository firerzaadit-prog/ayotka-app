"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { IconCheckCircle } from "@/components/ui/empty-state-icons";

type PendingStudent = { id: string; nama: string; jenjang: "SD" | "SMP"; tingkat: number };
type PendingSchool = {
  id: string;
  nama: string;
  jenjang: "SD" | "SMP";
  npsn: string | null;
  alamat: string | null;
  students: PendingStudent[];
};
type SchoolOption = { id: string; nama: string; jenjang: "SD" | "SMP"; status: string };

type Mode = null | "approve" | "reject" | "merge";

function isPlaceholder(s: SchoolOption): boolean {
  return s.status === "pending_verifikasi";
}

export default function VerifikasiSekolahPage() {
  const [pending, setPending] = useState<PendingSchool[] | null>(null);
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [approveForm, setApproveForm] = useState({ nama: "", npsn: "", alamat: "" });
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [pendingRes, schoolsRes] = await Promise.all([
        fetch("/api/admin-pusat/sekolah-pending"),
        fetch("/api/admin-pusat/schools"),
      ]);
      const pendingData = await pendingRes.json().catch(() => null);
      const schoolsData = await schoolsRes.json().catch(() => null);
      if (!ignore) {
        setPending(pendingData?.pending ?? []);
        setSchoolOptions(schoolsData?.schools ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  function openRow(school: PendingSchool, initialMode: Mode) {
    setOpenId(school.id);
    setMode(initialMode);
    setRowError(null);
    setApproveForm({
      nama: school.nama,
      npsn: school.npsn ?? "",
      alamat: school.alamat ?? "",
    });
    setMergeTargetId("");
  }

  function closeRow() {
    setOpenId(null);
    setMode(null);
    setRowError(null);
  }

  async function submitAction(schoolId: string, body: object) {
    setSubmitting(true);
    setRowError(null);
    const res = await fetch(`/api/admin-pusat/sekolah-pending/${schoolId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    setSubmitting(false);
    if (!res.ok) {
      setRowError(data?.error ?? "Gagal memproses.");
      return;
    }
    closeRow();
    setRefreshKey((k) => k + 1);
  }

  const mergeOptions = schoolOptions.filter((s) => !isPlaceholder(s));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Verifikasi Sekolah"
        description="Nama sekolah yang diketik bebas oleh siswa mandiri saat registrasi (bukan dipilih dari daftar resmi) - putuskan apakah ini sekolah baru yang sah, sekadar salah ketik dari sekolah yang sudah ada, atau tidak perlu dicatat."
      />

      {pending !== null && pending.length === 0 && (
        <EmptyState
          icon={<IconCheckCircle />}
          title="Tidak ada antrean"
          description="Belum ada sekolah baru yang perlu diverifikasi."
        />
      )}

      {pending?.map((school) => (
        <Card key={school.id}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-slate-900">{school.nama}</p>
              <p className="text-sm text-slate-500">
                {school.jenjang} · {school.students.length} siswa mengaitkan diri ke sini:{" "}
                {school.students.map((s) => s.nama).join(", ") || "-"}
              </p>
            </div>
            {openId !== school.id && (
              <div className="flex shrink-0 gap-2">
                <Button onClick={() => openRow(school, "approve")}>Setujui</Button>
                <Button variant="secondary" onClick={() => openRow(school, "merge")}>
                  Gabung
                </Button>
                <Button variant="danger" onClick={() => openRow(school, "reject")}>
                  Tolak
                </Button>
              </div>
            )}
          </div>

          {openId === school.id && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              {rowError && (
                <Alert variant="danger" className="mb-3">
                  {rowError}
                </Alert>
              )}

              {mode === "approve" && (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-slate-600">
                    Jadikan ini sekolah resmi baru - koreksi datanya kalau perlu.
                  </p>
                  <div>
                    <Label htmlFor="apNama">Nama sekolah</Label>
                    <Input
                      id="apNama"
                      value={approveForm.nama}
                      onChange={(e) => setApproveForm({ ...approveForm, nama: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="apNpsn">NPSN (opsional)</Label>
                      <Input
                        id="apNpsn"
                        placeholder="8 digit"
                        value={approveForm.npsn}
                        onChange={(e) => setApproveForm({ ...approveForm, npsn: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="apAlamat">Alamat (opsional)</Label>
                      <Input
                        id="apAlamat"
                        value={approveForm.alamat}
                        onChange={(e) => setApproveForm({ ...approveForm, alamat: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      disabled={submitting}
                      onClick={() =>
                        submitAction(school.id, { action: "approve", ...approveForm })
                      }
                    >
                      {submitting ? "Menyimpan..." : "Simpan & aktifkan"}
                    </Button>
                    <Button variant="secondary" onClick={closeRow}>
                      Batal
                    </Button>
                  </div>
                </div>
              )}

              {mode === "merge" && (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-slate-600">
                    Semua siswa yang mengaitkan diri ke &quot;{school.nama}&quot; akan dipindah ke
                    sekolah tujuan, lalu entri ini dihapus.
                  </p>
                  <div>
                    <Label htmlFor="mergeTarget">Gabung ke sekolah</Label>
                    <select
                      id="mergeTarget"
                      className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      value={mergeTargetId}
                      onChange={(e) => setMergeTargetId(e.target.value)}
                    >
                      <option value="">Pilih sekolah tujuan</option>
                      {mergeOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nama} ({s.jenjang})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      disabled={submitting || !mergeTargetId}
                      onClick={() =>
                        submitAction(school.id, { action: "merge", targetSchoolId: mergeTargetId })
                      }
                    >
                      {submitting ? "Menggabungkan..." : "Gabungkan"}
                    </Button>
                    <Button variant="secondary" onClick={closeRow}>
                      Batal
                    </Button>
                  </div>
                </div>
              )}

              {mode === "reject" && (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-slate-600">
                    Entri &quot;{school.nama}&quot; akan dihapus. Siswa yang mengaitkan diri ke
                    sini TIDAK ikut terhapus atau ke-nonaktifkan - hanya keterangan asal sekolahnya
                    yang dikosongkan. Langganan mandiri mereka tidak terpengaruh.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      disabled={submitting}
                      onClick={() => submitAction(school.id, { action: "reject" })}
                    >
                      {submitting ? "Memproses..." : "Ya, tolak & hapus entri"}
                    </Button>
                    <Button variant="secondary" onClick={closeRow}>
                      Batal
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
