/**
 * Jalankan banyak task async dengan laju DISPATCH maksimum (bukan cuma batas
 * konkurensi seperti runWithConcurrencyLimit di lib/exam/finalize.ts) - task
 * berikutnya paling cepat dimulai `intervalMs` setelah yang sebelumnya, dan
 * jumlah yang berjalan bersamaan tidak pernah melebihi `maxConcurrent`
 * (jaring pengaman kalau ada task yang jauh lebih lambat dari laju dispatch,
 * mis. retry Gemini yang bisa sampai puluhan detik).
 *
 * Dipakai lib/ai/queue-worker.ts supaya laju panggilan ke Gemini API
 * terkendali (mis. beberapa per detik) berapa pun banyaknya attempt yang
 * masuk antrean sekaligus, alih-alih fire-and-forget semuanya bersamaan.
 *
 * Dipisah jadi util murni (tidak menyentuh Prisma/Gemini sama sekali) supaya
 * bisa diuji langsung dengan task palsu + fake timer, konsisten dengan pola
 * "logika murni terpisah dari orkestrasi DB" di lib/exam/scoring.ts.
 */
export async function runWithRateLimit<T>(
  tasks: Array<() => Promise<T>>,
  opts: {
    intervalMs: number;
    maxConcurrent: number;
    onSettled?: (result: T, index: number) => void;
  },
): Promise<void> {
  const inFlight = new Set<Promise<void>>();

  for (let i = 0; i < tasks.length; i++) {
    while (inFlight.size >= opts.maxConcurrent) {
      await Promise.race(inFlight);
    }

    const task = tasks[i];
    if (!task) continue;
    const index = i;
    const settle = task()
      .then((result) => opts.onSettled?.(result, index))
      .catch(() => {
        // Task diharapkan menangani error-nya sendiri (mis. processOne di
        // queue-worker.ts selalu resolve, tidak pernah reject) - catch di
        // sini murni jaring pengaman supaya satu task gagal tidak pernah
        // jadi unhandled rejection yang menjatuhkan seluruh batch.
      });
    const tracked: Promise<void> = settle.finally(() => {
      inFlight.delete(tracked);
    });
    inFlight.add(tracked);

    if (i < tasks.length - 1) {
      await sleep(opts.intervalMs);
    }
  }

  await Promise.all(inFlight);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
