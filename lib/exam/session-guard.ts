import "server-only";
import { prisma } from "@/lib/db/prisma";

/**
 * Tiket 4.13: "satu sesi aktif per akun" - versi dasar dibatasi ke level
 * attempt (buka ujian yang sama di 2 tab/device sekaligus). Disimpan di
 * kolom Attempt.activeTabToken/activeTabLastSeen (BUKAN lagi Map in-memory)
 * - deployment sesungguhnya (Vercel serverless) bisa multi-instance, jadi
 * state ini harus dibagi lewat database supaya klaim/tolak konsisten lepas
 * dari instance mana yang menangani tiap request. Tab pertama yang membuka
 * attempt "mengklaim" sesinya; tab lain yang mencoba mengaksesnya ditolak
 * selama tab pertama masih mengirim heartbeat (dianggap mati kalau lebih
 * dari STALE_MS tanpa heartbeat, baru boleh diklaim tab lain).
 *
 * Klaim dilakukan lewat SATU UPDATE...WHERE atomik (bukan baca-lalu-tulis
 * terpisah) supaya aman dari race dua request bersamaan - Postgres
 * menjamin satu statement UPDATE tunggal berjalan serial per baris.
 */
const STALE_MS = 60_000;

export async function checkAndClaimSession(attemptId: string, tabToken: string): Promise<boolean> {
  const staleThreshold = new Date(Date.now() - STALE_MS);
  const result = await prisma.attempt.updateMany({
    where: {
      id: attemptId,
      OR: [
        { activeTabToken: null },
        { activeTabToken: tabToken },
        { activeTabLastSeen: { lt: staleThreshold } },
      ],
    },
    data: { activeTabToken: tabToken, activeTabLastSeen: new Date() },
  });
  return result.count > 0;
}

export async function releaseSession(attemptId: string): Promise<void> {
  await prisma.attempt.updateMany({
    where: { id: attemptId },
    data: { activeTabToken: null, activeTabLastSeen: null },
  });
}
