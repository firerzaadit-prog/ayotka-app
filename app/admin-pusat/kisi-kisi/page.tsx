"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

type Subject = { id: string; nama: string; kode: string; jenjang: "SD" | "SMP" };

export default function KisiKisiPage() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/subjects");
      const data = await res.json();
      if (!ignore) setSubjects(data.subjects ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  if (!subjects) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
    );
  }

  const byJenjang = {
    SD: subjects.filter((s) => s.jenjang === "SD"),
    SMP: subjects.filter((s) => s.jenjang === "SMP"),
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Kisi-kisi</h1>
        <p className="text-sm text-slate-500">
          Target jumlah soal per kompetensi, tingkat kesulitan, dan format - dipakai untuk
          memvalidasi komposisi paket sebelum di-publish. Pilih mapel untuk mulai.
        </p>
      </div>

      {(["SD", "SMP"] as const).map((jenjang) => (
        <div key={jenjang}>
          <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">{jenjang}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {byJenjang[jenjang].map((subject) => (
              <Link
                key={subject.id}
                href={`/admin-pusat/kisi-kisi/${subject.id}`}
                className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-slate-900 hover:border-slate-400"
              >
                {subject.nama}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
