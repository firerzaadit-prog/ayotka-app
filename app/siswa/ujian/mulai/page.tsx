"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type Info = { nama: string; jumlahSoal: number; durasiMenit: number; selesai?: string } | null;

function InstruksiSkeleton() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-20" />
      <Skeleton className="h-10" />
    </div>
  );
}

/** Tiket 4.4 (Bagian 3.2 brief): halaman instruksi - aturan, durasi, jumlah soal, sebelum timer mulai jalan. */
function InstruksiContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("assignmentId");
  const packageId = searchParams.get("packageId");

  const [info, setInfo] = useState<Info>(undefined as unknown as Info);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/siswa/ujian");
      const data = await res.json();
      if (assignmentId) {
        const a = (data.assignments ?? []).find((x: { id: string }) => x.id === assignmentId);
        setInfo(a ? { ...a.package, selesai: a.selesai } : null);
      } else {
        const p = (data.packages ?? []).find((x: { id: string }) => x.id === packageId);
        setInfo(p ?? null);
      }
    })();
  }, [assignmentId, packageId]);

  async function handleMulai() {
    setError(null);
    setStarting(true);
    const res = await fetch("/api/siswa/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assignmentId ? { assignmentId } : { packageId }),
    });
    const data = await res.json();
    setStarting(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal memulai ujian.");
      return;
    }
    router.push(`/siswa/attempt/${data.attempt.id}`);
  }

  if (info === undefined) return <InstruksiSkeleton />;
  if (info === null) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Alert variant="danger">Ujian tidak ditemukan atau sudah tidak tersedia.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">{info.nama}</h1>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="text-sm">
        <p>
          <span className="font-medium">Jumlah soal:</span> {info.jumlahSoal}
        </p>
        <p>
          <span className="font-medium">Durasi:</span> {info.durasiMenit} menit
        </p>
      </Card>

      <Alert variant="warning">
        <p className="font-medium">Sebelum mulai:</p>
        <ul className="mt-1 list-disc pl-5">
          <li>Timer mulai berjalan begitu kamu klik &quot;Mulai&quot; dan dihitung di server — tidak bisa dicurangi lewat jam HP.</li>
          <li>Jawabanmu tersimpan otomatis tiap kali kamu menjawab.</li>
          <li>Waktu habis = jawaban yang sudah ada otomatis tersubmit.</li>
          <li>Jangan berpindah tab atau menyalin/menempel selama ujian berlangsung.</li>
        </ul>
      </Alert>

      <Button onClick={handleMulai} disabled={starting} className="w-full">
        {starting ? "Memulai..." : "Mulai"}
      </Button>
    </div>
  );
}

export default function InstruksiPage() {
  return (
    <Suspense fallback={<InstruksiSkeleton />}>
      <InstruksiContent />
    </Suspense>
  );
}
