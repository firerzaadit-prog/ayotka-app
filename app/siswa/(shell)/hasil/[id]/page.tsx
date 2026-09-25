"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnalisisAiPanel } from "@/components/ai/analisis-panel";
import { AnalisisAiTeaser } from "@/components/ai/analisis-teaser";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";
import { RincianJawaban, type PerSoal } from "@/components/hasil/rincian-jawaban";
import { PetaKompetensiChart } from "@/components/hasil/peta-kompetensi-chart";
import { RankingBoardCard } from "@/components/hasil/ranking-board";

type Hasil = {
  attempt: {
    id: string;
    status: string;
    skorMentah: number | null;
    skorAkhir: number | null;
    mulaiAt: string;
    selesaiAt: string | null;
  };
  package: { nama: string };
  siswa: { nama: string; idSamar: string };
  canShowPembahasan: boolean;
  isFreeTrial: boolean;
  ranking: { peringkatSaya: number; totalPeserta: number; papan: { peringkat: number; nama: string; skor: number; andaSendiri: boolean }[] } | null;
  perSoal: PerSoal[];
  materiScores: { materiNama: string; jmlBenar: number; jmlSoal: number; persentase: number }[];
};

/**
 * Tiket 5.9: watermark identitas siswa di halaman pembahasan (bank soal
 * gampang bocor lewat screenshot kalau tidak ada jejak siapa yang
 * mengambilnya) - dirender sebagai background berulang, jadi ikut
 * terbawa di screenshot, bukan overlay terpisah yang gampang dihapus.
 */
function watermarkBackground(nama: string, idSamar: string): string {
  const escaped = `${nama} · ${idSamar}`.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><text x="0" y="90" transform="rotate(-28 160 80)" font-family="sans-serif" font-size="13" fill="rgba(15,23,42,0.14)">${escaped}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Tiket 4.10: halaman hasil - nilai, rincian benar/salah, pembahasan (kalau sudah boleh tampil). */
export default function HasilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let retryCount = 0;
    const MAX_RETRIES = 10; // tunggu hingga 10 × 800ms = ~8 detik
    const RETRY_DELAY_MS = 800;

    async function tryLoad() {
      const res = await fetch(`/api/siswa/attempts/${id}`, {
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal memuat hasil.");
        return;
      }
      // Jika ujian masih berjalan, kemungkinan finalize belum selesai di server.
      // Coba beberapa kali sebelum menyerah dan redirect.
      if (data.attempt.status === "berjalan" || data.attempt.status === "paused") {
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          setTimeout(tryLoad, RETRY_DELAY_MS);
        } else {
          // Setelah MAX_RETRIES tetap belum selesai, kembalikan ke halaman ujian
          router.replace(`/siswa/attempt/${id}`);
        }
        return;
      }
      setHasil(data);
    }

    void tryLoad();
  }, [id, router]);

  if (error) {
    return <p className="p-6 text-sm text-rose-700">{error}</p>;
  }
  if (!hasil) {
    return <p className="p-6 text-sm text-slate-500">Memuat hasil...</p>;
  }

  return (
    <div className="relative mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{ backgroundImage: watermarkBackground(hasil.siswa.nama, hasil.siswa.idSamar) }}
      />
      <PageHeader
        title={hasil.package.nama}
        description={hasil.attempt.status === "kedaluwarsa" ? "Waktu habis — disubmit otomatis." : "Selesai."}
        action={
          <a href={`/api/siswa/attempts/${id}/rapor`} className={buttonClassName("secondary")}>
            Unduh Rapor (PDF)
          </a>
        }
      />

      <Card className="text-center">
        <p className="text-sm text-slate-500">Nilai</p>
        <p className="text-4xl font-bold text-slate-900">
          {hasil.attempt.skorAkhir?.toFixed(0) ?? "-"}
        </p>
      </Card>

      {hasil.ranking && <RankingBoardCard ranking={hasil.ranking} />}

      {hasil.materiScores.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Peta Kompetensi</h2>
          <PetaKompetensiChart scores={hasil.materiScores} />
        </Card>
      )}

      {hasil.isFreeTrial ? (
        <AnalisisAiTeaser />
      ) : (
        <AnalisisAiPanel attemptId={id} canTrigger={false} />
      )}

      <div
        className="select-none"
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
      >
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Rincian Jawaban</h2>
        <RincianJawaban perSoal={hasil.perSoal} canShowPembahasan={hasil.canShowPembahasan} />
      </div>
    </div>
  );
}
