"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type Info = { nama: string; jumlahSoal: number; durasiMenit: number; selesai?: string } | null;

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

  if (info === undefined) return <p className="p-6 text-sm text-slate-500">Memuat...</p>;
  if (info === null) {
    return (
      <div className="mx-auto max-w-md p-6">
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Ujian tidak ditemukan atau sudah tidak tersedia.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">{info.nama}</h1>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <p>
          <span className="font-medium">Jumlah soal:</span> {info.jumlahSoal}
        </p>
        <p>
          <span className="font-medium">Durasi:</span> {info.durasiMenit} menit
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">Sebelum mulai:</p>
        <ul className="mt-1 list-disc pl-5">
          <li>Timer mulai berjalan begitu kamu klik &quot;Mulai&quot; dan dihitung di server — tidak bisa dicurangi lewat jam HP.</li>
          <li>Jawabanmu tersimpan otomatis tiap kali kamu menjawab.</li>
          <li>Waktu habis = jawaban yang sudah ada otomatis tersubmit.</li>
          <li>Jangan berpindah tab atau menyalin/menempel selama ujian berlangsung.</li>
        </ul>
      </div>

      <Button onClick={handleMulai} disabled={starting} className="w-full">
        {starting ? "Memulai..." : "Mulai"}
      </Button>
    </div>
  );
}

export default function InstruksiPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Memuat...</p>}>
      <InstruksiContent />
    </Suspense>
  );
}
