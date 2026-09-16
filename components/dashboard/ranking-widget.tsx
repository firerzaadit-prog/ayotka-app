"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RankingBoardCard } from "@/components/hasil/ranking-board";

type LatestRanking = {
  attemptId: string;
  tryOutNama: string;
  ranking: { peringkatSaya: number; totalPeserta: number; papan: { peringkat: number; nama: string; skor: number; andaSendiri: boolean }[] };
} | null;

const POLL_MS = 15_000;

/**
 * Bagian 8/10 (permintaan user): "ranking bisa dilihat di dashboard siswa,
 * realtime". Realtime di sini artinya polling berkala (bukan push
 * websocket/Supabase Realtime - aplikasi ini sepenuhnya lewat Prisma+API
 * route, tidak pernah pakai Supabase Realtime di tempat lain) - papan
 * ranking otomatis segar tiap POLL_MS tanpa siswa perlu refresh manual,
 * yang dalam praktik terasa realtime untuk kasus ini (menunggu peserta
 * lain menyelesaikan try out yang sama).
 */
export function RankingWidget() {
  const [latest, setLatest] = useState<LatestRanking | undefined>(undefined);

  useEffect(() => {
    let ignore = false;

    async function load() {
      const res = await fetch("/api/siswa/ranking", { cache: "no-store" });
      if (!res.ok || ignore) return;
      const data = await res.json();
      if (!ignore) setLatest(data.latest ?? null);
    }

    void load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  if (!latest) return null;

  return (
    <RankingBoardCard
      ranking={latest.ranking}
      title={`Ranking: ${latest.tryOutNama}`}
      footer={
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
          <span>Papan ini diperbarui otomatis tiap {POLL_MS / 1000} detik.</span>
          <Link href={`/siswa/hasil/${latest.attemptId}`} className="font-medium text-indigo-600 hover:underline">
            Lihat rincian hasil &rarr;
          </Link>
        </div>
      }
    />
  );
}
