"use client";

import { useEffect, useState } from "react";

type Quota = {
  id: string;
  tryOutPerSiswa: number;
  kuotaSiswa: number;
  subject: { id: string; nama: string; jenjang: string };
};

/** Ringkasan kuota try out per mapel yang dijatah admin pusat - read-only, dipakai di dashboard & Kelola Siswa admin sekolah. */
export function KuotaSummary() {
  const [quotas, setQuotas] = useState<Quota[] | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-sekolah/kuota");
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok) setQuotas(data.quotas ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  if (quotas === null) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-sm font-medium text-slate-700">Kuota Try Out dari Admin Pusat</h2>
      {quotas.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          Belum ada kuota try out per mata pelajaran yang dijatah admin pusat untuk sekolah ini.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-3">
          {quotas.map((q) => (
            <div
              key={q.id}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="font-medium text-slate-800">{q.subject.nama}</span>
              <span className="ml-1.5 text-xs text-slate-400">{q.subject.jenjang}</span>
              <p className="mt-0.5 text-xs text-slate-500">
                {q.tryOutPerSiswa}× try out/siswa &middot; maks {q.kuotaSiswa.toLocaleString("id-ID")}{" "}
                siswa
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
