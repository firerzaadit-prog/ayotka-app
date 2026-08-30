"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { IconClipboardCheck } from "@/components/ui/empty-state-icons";

type Subject = { id: string; nama: string; jenjang: string };
type Quota = {
  id: string;
  subjectId: string;
  tryOutPerSiswa: number;
  kuotaSiswa: number;
  subject: Subject;
};

const selectClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

export function SchoolQuotaPanel({ schoolId }: { schoolId: string }) {
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [tryOutPerSiswa, setTryOutPerSiswa] = useState("3");
  const [kuotaSiswa, setKuotaSiswa] = useState("100");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-pusat/school-subject-quotas/${schoolId}`);
      if (res.ok) {
        const data = await res.json();
        if (!ignore) {
          setQuotas(data.quotas ?? []);
          setSubjects(data.subjects ?? []);
          if (data.subjects?.length > 0 && !subjectId) {
            setSubjectId(data.subjects[0].id);
          }
        }
      }
    })();
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, refreshKey]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch(`/api/admin-pusat/school-subject-quotas/${schoolId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectId,
        tryOutPerSiswa: Number(tryOutPerSiswa),
        kuotaSiswa: Number(kuotaSiswa),
      }),
    });
    const data = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(data?.error ?? "Gagal menyimpan kuota.");
      return;
    }
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(sq: Quota) {
    if (!window.confirm(`Hapus kuota untuk ${sq.subject.nama}? Siswa yang sudah mengerjakan tidak terpengaruh.`)) return;
    await fetch(`/api/admin-pusat/school-subject-quotas/${schoolId}?subjectId=${sq.subjectId}`, {
      method: "DELETE",
    });
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Kuota Try Out per Mata Pelajaran</h2>
          <p className="text-sm text-slate-500">
            Tentukan berapa kali setiap siswa sekolah ini boleh mengerjakan try out TKA per mata pelajaran.
          </p>
        </div>
        <Button onClick={() => { setShowForm((v) => !v); setError(null); }}>
          {showForm ? "Batal" : "Tambah / Ubah Kuota"}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="quotaSubject">Mata Pelajaran</Label>
              <select
                id="quotaSubject"
                required
                className={selectClassName}
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="" disabled>Pilih mapel...</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.jenjang})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="quotaTryOut">Try Out per Siswa</Label>
              <Input
                id="quotaTryOut"
                type="number"
                min={1}
                max={100}
                required
                value={tryOutPerSiswa}
                onChange={(e) => setTryOutPerSiswa(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">Setiap siswa mendapat kuota sebanyak ini.</p>
            </div>
            <div>
              <Label htmlFor="quotaSiswa">Kuota Maksimal Siswa</Label>
              <Input
                id="quotaSiswa"
                type="number"
                min={1}
                max={100000}
                required
                value={kuotaSiswa}
                onChange={(e) => setKuotaSiswa(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">Jumlah total siswa yang bisa mengikuti.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan Kuota"}
            </Button>
          </div>
        </form>
      )}

      {quotas.length === 0 ? (
        <EmptyState
          icon={<IconClipboardCheck />}
          title="Belum ada kuota"
          description="Tambahkan kuota try out per mata pelajaran agar siswa sekolah ini bisa mengerjakan soal."
          action={<Button onClick={() => setShowForm(true)}>Tambah Kuota</Button>}
        />
      ) : (
        <TableContainer>
          <Table>
            <Thead>
              <tr>
                <Th>Mata Pelajaran</Th>
                <Th>Try Out / Siswa</Th>
                <Th>Maks. Siswa</Th>
                <Th />
              </tr>
            </Thead>
            <tbody>
              {quotas.map((q) => (
                <Tr key={q.id}>
                  <Td>
                    <span className="font-medium text-slate-800">{q.subject.nama}</span>
                    <span className="ml-2 text-xs text-slate-400">{q.subject.jenjang}</span>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
                      {q.tryOutPerSiswa}× try out
                    </span>
                  </Td>
                  <Td className="text-slate-600 text-sm">{q.kuotaSiswa.toLocaleString("id-ID")} siswa</Td>
                  <Td className="text-right">
                    <button
                      onClick={() => handleDelete(q)}
                      className="text-sm font-medium text-rose-500 hover:text-rose-700 transition-colors"
                    >
                      Hapus
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
