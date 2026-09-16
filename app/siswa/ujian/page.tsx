"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";
import { ListSkeleton, PageSkeleton } from "@/components/ui/skeleton";
import { IconClipboardCheck } from "@/components/ui/empty-state-icons";
import { formatWIB } from "@/lib/utils/datetime";
import { getMapelIcon } from "@/components/icons/mapel-icons";

type AssignmentItem = {
  id: string;
  mulai: string;
  selesai: string;
  package: { nama: string; jumlahSoal: number; durasiMenit: number; subject: { nama: string } };
};
type PackageItem = {
  id: string;
  nama: string;
  jumlahSoal: number;
  durasiMenit: number;
  jenisPaket: "tryout" | "latihan";
  bukaSelesai: string | null;
  subject: { nama: string };
};
type TryOutGroupItem = {
  id: string;
  nama: string;
  jumlahSoal: number;
  durasiMenit: number;
  bukaSelesai: string | null;
  subject: { nama: string };
};
type AttemptSummary = {
  id: string;
  assignmentId: string | null;
  packageId: string;
  tryOutGroupId: string | null;
  status: "berjalan" | "paused" | "selesai" | "kedaluwarsa";
};

function JenisPaketBadge({ jenisPaket }: { jenisPaket: "tryout" | "latihan" }) {
  const isTryout = jenisPaket === "tryout";
  return (
    <span
      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
        isTryout ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {isTryout ? "Try Out" : "Latihan"}
    </span>
  );
}

function MapelIconBadge({ nama }: { nama: string }) {
  // Dipanggil sebagai fungsi biasa (bukan tag JSX <Icon />) supaya tidak
  // kena aturan lint react-hooks/static-components ("component created
  // during render") - referensi fungsinya memang berasal dari lookup
  // dinamis per nama mapel, tapi elemen yang dihasilkan tetap stabil.
  const icon = getMapelIcon(nama)({ className: "h-5 w-5" });
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-indigo-600">
      {icon}
    </span>
  );
}

export default function SiswaUjianPage() {
  const [jalur, setJalur] = useState<"A" | "B" | null>(null);
  const [assignments, setAssignments] = useState<AssignmentItem[] | null>(null);
  const [packages, setPackages] = useState<PackageItem[] | null>(null);
  const [tryOutGroups, setTryOutGroups] = useState<TryOutGroupItem[] | null>(null);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/siswa/ujian");
      const data = await res.json();
      if (!ignore) {
        setJalur(data.jalur ?? "B");
        setAssignments(data.assignments ?? []);
        setPackages(data.packages ?? []);
        setTryOutGroups(data.tryOutGroups ?? []);
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

  function attemptForGroup(groupId: string) {
    return attempts.find((a) => a.tryOutGroupId === groupId);
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

  function actionHrefGroup(attempt: AttemptSummary | undefined, groupId: string) {
    if (attempt?.status === "berjalan") return `/siswa/attempt/${attempt.id}`;
    if (attempt?.status === "selesai" || attempt?.status === "kedaluwarsa") {
      return `/siswa/hasil/${attempt.id}`;
    }
    return `/siswa/ujian/mulai?tryOutGroupId=${groupId}`;
  }

  // jalur masih null sebelum fetch selesai - tanpa gerbang ini, render di
  // bawah jatuh ke tampilan "Jalur B" secara default (bukan skeleton) untuk
  // SEMUA siswa termasuk Jalur A, sampai terbukti keliru sesaat kemudian.
  if (jalur === null) {
    return <PageSkeleton />;
  }

  // Jalur A: hanya Ujian Ditugaskan
  if (jalur === "A") {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Ujian"
          description="Daftar ujian yang ditugaskan oleh sekolahmu."
        />
        <div>
          {assignments === null && <ListSkeleton items={3} />}
          {assignments?.length === 0 && (
            <EmptyState icon={<IconClipboardCheck />} title="Tidak ada ujian aktif" description="Belum ada ujian yang ditugaskan sekolahmu saat ini." />
          )}
          {assignments && assignments.length > 0 && (
            <div className="flex flex-col gap-2">
              {assignments.map((a) => {
                const attempt = attemptFor(a.id, "");
                const disabled = attempt?.status === "paused";
                return (
                  <Card key={a.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MapelIconBadge nama={a.package.subject.nama} />
                      <div>
                        <p className="font-medium text-slate-900">{a.package.nama}</p>
                        <p className="text-xs text-slate-500">
                          {a.package.subject.nama} · {a.package.jumlahSoal} soal · {a.package.durasiMenit} menit ·
                          {" "}Buka sampai {formatWIB(a.selesai)}
                        </p>
                      </div>
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
      </div>
    );
  }

  // Jalur B: hanya Latihan Mandiri
  const nothingAvailable =
    packages !== null && packages.length === 0 && tryOutGroups !== null && tryOutGroups.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Try Out"
        description="Paket try out yang tersedia untukmu."
      />

      {(packages === null || tryOutGroups === null) && <ListSkeleton items={3} />}

      {nothingAvailable && (
        <EmptyState icon={<IconClipboardCheck />} title="Belum ada paket tersedia" description="Belum ada paket try out yang tersedia untuk tingkatmu saat ini." />
      )}

      {tryOutGroups && tryOutGroups.length > 0 && (
        <div>
          <div className="flex flex-col gap-2">
            {tryOutGroups.map((g) => {
              const attempt = attemptForGroup(g.id);
              return (
                <Card key={g.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapelIconBadge nama={g.subject.nama} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{g.nama}</p>
                        <JenisPaketBadge jenisPaket="tryout" />
                        <span className="shrink-0 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                          Soal diacak
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {g.subject.nama} · {g.jumlahSoal} soal · {g.durasiMenit} menit
                        {g.bukaSelesai && <> · Buka sampai {formatWIB(g.bukaSelesai)}</>}
                      </p>
                    </div>
                  </div>
                  <Link href={actionHrefGroup(attempt, g.id)} className={buttonClassName("secondary")}>
                    {attempt ? actionLabel(attempt) : "Mulai"}
                  </Link>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div>
        {packages && packages.length > 0 && (
          <div className="flex flex-col gap-2">
            {packages.map((p) => {
              const attempt = attemptFor(null, p.id);
              return (
                <Card key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapelIconBadge nama={p.subject.nama} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{p.nama}</p>
                        <JenisPaketBadge jenisPaket={p.jenisPaket} />
                      </div>
                      <p className="text-xs text-slate-500">
                        {p.subject.nama} · {p.jumlahSoal} soal · {p.durasiMenit} menit
                        {p.bukaSelesai && <> · Buka sampai {formatWIB(p.bukaSelesai)}</>}
                      </p>
                    </div>
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


