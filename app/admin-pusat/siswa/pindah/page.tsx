"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";

type SchoolOption = { id: string; nama: string };
type StudentOption = { id: string; nama: string };
type ClassOption = { id: string; tingkat: number; namaRombel: string };

export default function PindahSekolahPage() {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [asalSekolahId, setAsalSekolahId] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState("");

  const [tujuanSekolahId, setTujuanSekolahId] = useState("");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin-pusat/schools");
      const data = await res.json();
      setSchools(data.schools ?? []);
    })();
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!asalSekolahId) {
        if (!ignore) {
          setStudents([]);
          setStudentId("");
        }
        return;
      }
      const res = await fetch(`/api/admin-sekolah/siswa?schoolId=${asalSekolahId}`);
      const data = await res.json();
      if (!ignore) {
        setStudents(data.students ?? []);
        setStudentId("");
      }
    })();
    return () => {
      ignore = true;
    };
  }, [asalSekolahId]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!tujuanSekolahId) {
        if (!ignore) {
          setClasses([]);
          setClassId("");
        }
        return;
      }
      const res = await fetch(`/api/admin-sekolah/kelas?schoolId=${tujuanSekolahId}`);
      const data = await res.json();
      if (!ignore) {
        setClasses(data.classes ?? []);
        setClassId("");
      }
    })();
    return () => {
      ignore = true;
    };
  }, [tujuanSekolahId]);

  async function handleSubmit() {
    if (!studentId || !classId) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const res = await fetch(`/api/admin-pusat/siswa/${studentId}/pindah-sekolah`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal memindahkan siswa.");
      return;
    }
    setSuccess("Siswa berhasil dipindahkan. Riwayat nilai di sekolah lama tetap tersimpan.");
    setStudentId("");
    setAsalSekolahId("");
    setTujuanSekolahId("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Pindah Sekolah</h1>
        <p className="text-sm text-slate-500">
          Riwayat nilai siswa di sekolah lama tetap melekat di sana - hanya enrollment tahun
          berjalan yang dipindah ke sekolah tujuan.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

      <div className="grid max-w-xl gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <Label htmlFor="asalSekolah">Sekolah asal</Label>
          <select
            id="asalSekolah"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={asalSekolahId}
            onChange={(e) => setAsalSekolahId(e.target.value)}
          >
            <option value="">Pilih sekolah asal</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="student">Siswa</Label>
          <select
            id="student"
            disabled={!asalSekolahId}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Pilih siswa</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="tujuanSekolah">Sekolah tujuan</Label>
          <select
            id="tujuanSekolah"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={tujuanSekolahId}
            onChange={(e) => setTujuanSekolahId(e.target.value)}
          >
            <option value="">Pilih sekolah tujuan</option>
            {schools
              .filter((s) => s.id !== asalSekolahId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                </option>
              ))}
          </select>
        </div>

        <div>
          <Label htmlFor="tujuanKelas">Rombel tujuan</Label>
          <select
            id="tujuanKelas"
            disabled={!tujuanSekolahId}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">Pilih rombel</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.tingkat}
                {c.namaRombel}
              </option>
            ))}
          </select>
        </div>

        <Button onClick={handleSubmit} disabled={!studentId || !classId || submitting} className="w-fit">
          {submitting ? "Memproses..." : "Pindahkan"}
        </Button>
      </div>
    </div>
  );
}
