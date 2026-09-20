"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type Info = {
  nama: string;
  jumlahSoal: number;
  durasiMenit: number;
  kategori?: "mandiri" | "nasional";
  jenisPaket?: "tryout" | "latihan";
  selesai?: string;
  bukaMulai?: string | null;
  subject?: { id: string; nama: string };
} | null;

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
  const tryOutGroupId = searchParams.get("tryOutGroupId");

  const [info, setInfo] = useState<Info>(undefined as unknown as Info);
  const [gunakanLA, setGunakanLA] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/siswa/ujian");
      const data = await res.json();
      if (assignmentId) {
        const a = (data.assignments ?? []).find((x: { id: string }) => x.id === assignmentId);
        setInfo(a ? { ...a.package, selesai: a.selesai, kategori: a.package.kategori ?? "mandiri" } : null);
      } else if (tryOutGroupId) {
        const g = (data.tryOutGroups ?? []).find((x: { id: string }) => x.id === tryOutGroupId);
        setInfo(g ?? null);
      } else {
        const p = (data.packages ?? []).find((x: { id: string }) => x.id === packageId);
        setInfo(p ?? null);
      }
    })();
  }, [assignmentId, packageId, tryOutGroupId]);

  async function handleMulai() {
    setError(null);
    setErrorCode(null);
    setStarting(true);

    const payload: Record<string, unknown> = assignmentId
      ? { assignmentId }
      : tryOutGroupId
      ? { tryOutGroupId }
      : { packageId };

    // Bagian D/G: Sertakan pilihan opt-in Learning Analytics jika try out mandiri
    if (info?.kategori !== "nasional" && info?.jenisPaket !== "latihan") {
      payload.gunakanLearningAnalytics = gunakanLA;
    }

    const res = await fetch("/api/siswa/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setStarting(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal memulai ujian.");
      setErrorCode(data.code ?? null);
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

  const isNasional = info.kategori === "nasional";
  const isLatihan = info.jenisPaket === "latihan";
  // Event nasional yang belum dibuka tampil di daftar supaya siswa tahu
  // jadwalnya, tapi tidak boleh dimulai (server juga menolak, lihat
  // includeUpcomingNasional di lib/exam/visibility.ts).
  const belumDibuka = Boolean(info.bukaMulai && new Date(info.bukaMulai) > new Date());

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {isNasional ? (
            <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
              Try Out Nasional
            </span>
          ) : isLatihan ? (
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
              Latihan Soal
            </span>
          ) : (
            <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
              Try Out Mandiri
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-slate-900">{info.nama}</h1>
      </div>

      {error && (
        <Alert variant="danger">
          <p>{error}</p>
          {errorCode === "SALDO_TIDAK_CUKUP" && (
            <div className="mt-3">
              <Link
                href="/siswa/wallet"
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
              >
                Isi Saldo Wallet Sekarang →
              </Link>
            </div>
          )}
          {(errorCode === "NASIONAL_QUOTA_HABIS" || errorCode === "PERLU_LANGGANAN") && (
            <div className="mt-3">
              <Link
                href="/siswa/langganan"
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
              >
                Pilih / Upgrade Paket →
              </Link>
            </div>
          )}
        </Alert>
      )}

      <Card className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-slate-500">Jumlah Soal</span>
          <span className="font-semibold text-slate-900">{info.jumlahSoal} butir</span>
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-slate-500">Durasi Waktu</span>
          <span className="font-semibold text-slate-900">{info.durasiMenit} menit</span>
        </div>
        {info.subject && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Mata Pelajaran</span>
            <span className="font-semibold text-slate-900">{info.subject.nama}</span>
          </div>
        )}
      </Card>

      {/* Fitur AI Learning Analytics / Pilihan Centang Sesuai Bagian G */}
      {isNasional ? (
        <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50/40 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white text-sm font-bold">
              AI
            </span>
            <div className="flex flex-col text-xs">
              <span className="font-bold text-violet-950">Analisis AI Learning Analytics Termasuk</span>
              <span className="text-slate-600 mt-0.5">
                Try Out Nasional otomatis mencakup analisis mendalam capaian kompetensi, rekomendasi materi, dan perankingan serentak nasional.
              </span>
            </div>
          </div>
        </div>
      ) : isLatihan ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Paket latihan mandiri hanya menampilkan skor nilai dan peta kompetensi dasar setelah selesai dikerjakan.
        </div>
      ) : (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={gunakanLA}
              onChange={(e) => setGunakanLA(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex flex-col text-xs">
              <span className="font-bold text-slate-900">
                Gunakan Analisis AI (Learning Analytics) untuk sesi ini
              </span>
              <span className="text-slate-600 mt-1 leading-relaxed">
                Mendapatkan laporan mendalam capaian kompetensi per subtopik &amp; rekomendasi AI.
                Otomatis menggunakan <span className="font-medium text-indigo-700">jatah kuota paket</span> jika ada, atau <span className="font-medium text-indigo-700">saldo wallet</span> jika kuota habis.
              </span>
            </div>
          </label>
        </div>
      )}

      <Alert variant="warning">
        <p className="font-semibold">Petunjuk sebelum mulai:</p>
        <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed">
          {tryOutGroupId && (
            <li>Soal dipilih secara acak dari beberapa variasi resmi dan dirangking setara bersama seluruh peserta.</li>
          )}
          <li>Timer mulai berjalan begitu kamu menekan tombol &quot;Mulai Ujian&quot;.</li>
          <li>Jawaban tersimpan otomatis secara real-time ke server.</li>
          <li>Jika waktu habis, lembar jawaban akan langsung tersubmit otomatis.</li>
          <li>Dilarang berpindah tab atau aplikasi selama pengerjaan berlangsung.</li>
        </ul>
      </Alert>

      {belumDibuka && info.bukaMulai && (
        <Alert variant="warning">
          Try out ini baru dibuka pada {new Date(info.bukaMulai).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}. Kamu bisa mulai mengerjakan begitu jadwalnya tiba.
        </Alert>
      )}

      <Button onClick={handleMulai} disabled={starting || belumDibuka} className="w-full py-2.5 font-semibold">
        {starting ? "Memulai Ujian..." : "Mulai Ujian"}
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
