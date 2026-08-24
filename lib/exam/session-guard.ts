import "server-only";

/**
 * Tiket 4.13: "satu sesi aktif per akun" - versi dasar dibatasi ke level
 * attempt (buka ujian yang sama di 2 tab/device sekaligus). Disimpan
 * in-memory per proses (pola yang sama seperti lib/rate-limit.ts) - cukup
 * untuk 1 instance server, perlu Redis/store bersama kalau nanti deploy
 * multi-instance. Tab pertama yang membuka attempt "mengklaim" sesinya;
 * tab lain yang mencoba mengaksesnya ditolak selama tab pertama masih
 * mengirim heartbeat (dianggap mati kalau lebih dari STALE_MS tanpa
 * heartbeat, baru boleh diklaim tab lain).
 */

type SessionEntry = { tabToken: string; lastSeen: number };

const activeSessions = new Map<string, SessionEntry>();
const STALE_MS = 60_000;

export function checkAndClaimSession(attemptId: string, tabToken: string): boolean {
  const existing = activeSessions.get(attemptId);
  const isStale = existing ? Date.now() - existing.lastSeen > STALE_MS : true;

  if (!existing || existing.tabToken === tabToken || isStale) {
    activeSessions.set(attemptId, { tabToken, lastSeen: Date.now() });
    return true;
  }
  return false;
}

export function releaseSession(attemptId: string): void {
  activeSessions.delete(attemptId);
}
