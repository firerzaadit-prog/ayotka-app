"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";
import { formatWIB } from "@/lib/utils/datetime";

type AssignmentItem = {
  id: string;
  mulai: string;
  selesai: string;
  package: { nama: string; jumlahSoal: number; durasiMenit: number };
};
type PackageItem = {
  id: string;
  nama: string;
  jumlahSoal: number;
  durasiMenit: number;
  subject: { nama: string };
};
type AttemptSummary = {
  id: string;
  assignmentId: string | null;
  packageId: string;
  status: "berjalan" | "paused" | "selesai" | "kedaluwarsa";
};

export default function SiswaUjianPage() {
  const [assignments, setAssignments] = useState<AssignmentItem[] | null>(null);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/siswa/ujian");
      const data = await res.json();
      if (!ignore) {
        setAssignments(data.assignments ?? []);
        setPackages(data.packages ?? []);
        setAttempts(data.attempts ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  function attemptFor(assignmentId: string | null, packageId: string) {
    return attempts.find((a) =>
      assignmentId ? a.assignmentId === assignmentId : a.packageId === packageId && !a.assignmentId,
    );
  }

  function actionLabel(attempt: AttemptSummary | undefined) {
    if (!attempt) return "Mulai";
    if (attempt.status === "berjalan") return "Lanjutkan";
    if (attempt.status === "paused") return "Dijeda admin";
    return "Lihat hasil";
  }

  function actionHref(attempt: AttemptSummary | undefined, assignmentId: string | null, packageId: string) {
    if (attempt?.status === "berjalan") return `/siswa/attempt/${attempt.id}`;
    if (attempt?.status === "selesai" || attempt?.status === "kedaluwarsa") {
      return `/siswa/hasil/${attempt.id}`;
    }
    const qs = assignmentId ? `assignmentId=${assignmentId}` : `packageId=${packageId}`;
    return `/siswa/ujian/mulai?${qs}`;
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Ujian"
        description="Ujian yang ditugaskan sekolahmu & paket latihan mandiri."
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Ujian Ditugaskan</h2>
        {assignments === null && <p className="text-sm text-slate-500">Memuat...</p>}
        {assignments?.length === 0 && (
          <EmptyState title="Tidak ada ujian aktif" description="Belum ada ujian yang ditugaskan sekolahmu saat ini." />
        )}
        {assignments && assignments.length > 0 && (
          <div className="flex flex-col gap-2">
            {assignments.map((a) => {
              const attempt = attemptFor(a.id, "");
              const disabled = attempt?.status === "paused";
              return (
                <Card key={a.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{a.package.nama}</p>
                    <p className="text-xs text-slate-500">
                      {a.package.jumlahSoal} soal · {a.package.durasiMenit} menit · Buka sampai{" "}
                      {formatWIB(a.selesai)}
                    </p>
                  </div>
                  {disabled ? (
                    <span className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-700">
                      {actionLabel(attempt)}
                    </span>
                  ) : (
                    <Link href={actionHref(attempt, a.id, "")} className={buttonClassName("primary")}>
                      {actionLabel(attempt)}
                    </Link>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Latihan Mandiri</h2>
        {packages.length === 0 ? (
          <EmptyState title="Belum ada paket latihan" description="Belum ada paket latihan mandiri untuk tingkatmu." />
        ) : (
          <div className="flex flex-col gap-2">
            {packages.map((p) => {
              const attempt = attemptFor(null, p.id);
              return (
                <Card key={p.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{p.nama}</p>
                    <p className="text-xs text-slate-500">
                      {p.subject.nama} · {p.jumlahSoal} soal · {p.durasiMenit} menit
                    </p>
                  </div>
                  <Link href={actionHref(attempt, null, p.id)} className={buttonClassName("secondary")}>
                    {attempt ? actionLabel(attempt) : "Mulai"}
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
