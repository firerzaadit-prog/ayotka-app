import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWithRateLimit } from "@/lib/utils/rate-limited-dispatch";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runWithRateLimit", () => {
  it("membatasi laju dispatch - task berikutnya baru mulai setelah intervalMs", async () => {
    const startedAt: number[] = [];
    const tasks = Array.from({ length: 4 }, () => async () => {
      startedAt.push(Date.now());
    });

    const run = runWithRateLimit(tasks, { intervalMs: 100, maxConcurrent: 10 });
    await vi.advanceTimersByTimeAsync(1000);
    await run;

    expect(startedAt).toEqual([0, 100, 200, 300]);
  });

  it("tidak pernah menjalankan lebih dari maxConcurrent task bersamaan", async () => {
    let running = 0;
    let peakConcurrent = 0;
    const tasks = Array.from({ length: 6 }, () => async () => {
      running++;
      peakConcurrent = Math.max(peakConcurrent, running);
      await new Promise((r) => setTimeout(r, 500));
      running--;
    });

    // intervalMs kecil supaya semua task "mau" dispatch cepat - maxConcurrent
    // yang seharusnya jadi satu-satunya pengerem di sini.
    const run = runWithRateLimit(tasks, { intervalMs: 10, maxConcurrent: 2 });
    await vi.advanceTimersByTimeAsync(5000);
    await run;

    expect(peakConcurrent).toBeLessThanOrEqual(2);
  });

  it("memanggil onSettled dengan hasil dan index yang benar untuk tiap task", async () => {
    const tasks = [async () => "a", async () => "b", async () => "c"];
    const settled: Array<{ result: string; index: number }> = [];

    const run = runWithRateLimit(tasks, {
      intervalMs: 50,
      maxConcurrent: 10,
      onSettled: (result, index) => settled.push({ result, index }),
    });
    await vi.advanceTimersByTimeAsync(1000);
    await run;

    expect(settled).toEqual([
      { result: "a", index: 0 },
      { result: "b", index: 1 },
      { result: "c", index: 2 },
    ]);
  });

  it("satu task yang reject tidak menggagalkan batch lainnya", async () => {
    const settled: string[] = [];
    const tasks = [
      async () => "ok-1",
      async () => {
        throw new Error("gagal sengaja");
      },
      async () => "ok-2",
    ];

    const run = runWithRateLimit(tasks, {
      intervalMs: 10,
      maxConcurrent: 10,
      onSettled: (result: string) => settled.push(result),
    });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(run).resolves.toBeUndefined();

    expect(settled).toEqual(["ok-1", "ok-2"]);
  });

  it("array task kosong langsung selesai tanpa error", async () => {
    await expect(runWithRateLimit([], { intervalMs: 100, maxConcurrent: 5 })).resolves.toBeUndefined();
  });
});
