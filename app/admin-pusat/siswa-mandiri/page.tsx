"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type PendingStudent = {
  id: string;
  nama: string;
  jenjang: "SD" | "SMP";
  tingkat: number;
  school: { nama: string; status: string } | null;
  user: { email: string } | null;
};

export default function SiswaMandiriPage() {
  const [students, setStudents] = useState<PendingStudent[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/siswa-mandiri");
      const data = await res.json();
      if (!ignore) setStudents(data.students ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  async function handleAktivasi(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin-pusat/siswa-mandiri/${id}/aktivasi`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (res.ok) {
      setRefreshKey((k) => k + 1);
    } else {
      alert(data?.error ?? "Gagal aktivasi.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Siswa Mandiri - Aktivasi</h1>
        <p className="text-sm text-slate-500">
          Panel sementara pengganti alur pembayaran (Fase 6 belum dibangun). Verifikasi
          pembayaran/identitas secara manual di luar sistem sebelum menekan Aktifkan.
        </p>
      </div>

      {students === null && <p className="text-sm text-slate-500">Memuat...</p>}
      {students?.length === 0 && (
        <EmptyState title="Tidak ada yang menunggu aktivasi" description="Semua siswa mandiri sudah aktif." />
      )}

      {students && students.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Jenjang</th>
                <th className="px-4 py-2 font-medium">Asal sekolah</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-900">{s.nama}</td>
                  <td className="px-4 py-2">{s.user?.email ?? "-"}</td>
                  <td className="px-4 py-2">
                    {s.jenjang} {s.tingkat}
                  </td>
                  <td className="px-4 py-2">
                    {s.school?.nama ?? "-"}
                    {s.school?.status === "pending_verifikasi" && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                        Sekolah belum terverifikasi
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="secondary"
                      onClick={() => handleAktivasi(s.id)}
                      disabled={busyId === s.id}
                    >
                      {busyId === s.id ? "Memproses..." : "Aktifkan"}
                    </Button>
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
