import { describe, expect, it, vi } from "vitest";
import { transitionSubscriptionStatuses } from "@/lib/billing/cron";

type FakeClient = Parameters<typeof transitionSubscriptionStatuses>[0];
type FakeCall = {
  where: { status: { in: string[] } | string; berakhirAt: { lte: Date } };
  data: { status: string };
};

function makeFakePrisma(counts: { kedaluwarsa: number; tenggang: number }) {
  const calls: FakeCall[] = [];
  const updateMany = vi.fn(async (args: FakeCall) => {
    calls.push(args);
    return { count: args.data.status === "kedaluwarsa" ? counts.kedaluwarsa : counts.tenggang };
  });
  const prisma = { subscription: { updateMany } } as unknown as FakeClient;
  return { prisma, calls };
}

describe("transitionSubscriptionStatuses (Tiket 6.6, Bagian 7.1 brief: cron harian aktif -> tenggang -> kedaluwarsa)", () => {
  it("transisi kedaluwarsa dijalankan SEBELUM tenggang, supaya subscription yang lompat langsung dari aktif ke kedaluwarsa tidak salah kehitung dobel", async () => {
    const { prisma, calls } = makeFakePrisma({ kedaluwarsa: 2, tenggang: 3 });

    const result = await transitionSubscriptionStatuses(prisma, new Date("2026-06-15T00:00:00.000Z"));

    expect(calls.map((c) => c.data.status)).toEqual(["kedaluwarsa", "tenggang"]);
    expect(result).toEqual({ keKedaluwarsa: 2, keTenggang: 3 });
  });

  it("filter kedaluwarsa pakai ambang 3 hari sebelum now dan mencakup status aktif+tenggang; filter tenggang cuma aktif & ambang now", async () => {
    const { prisma, calls } = makeFakePrisma({ kedaluwarsa: 0, tenggang: 0 });
    const now = new Date("2026-06-15T00:00:00.000Z");

    await transitionSubscriptionStatuses(prisma, now);

    expect(calls).toHaveLength(2);
    const kedaluwarsaCall = calls[0]!;
    const tenggangCall = calls[1]!;
    const kedaluwarsaStatusIn = kedaluwarsaCall.where.status as { in: string[] };

    expect([...kedaluwarsaStatusIn.in].sort()).toEqual(["aktif", "tenggang"]);
    expect(kedaluwarsaCall.where.berakhirAt.lte).toEqual(new Date("2026-06-12T00:00:00.000Z"));

    expect(tenggangCall.where.status).toBe("aktif");
    expect(tenggangCall.where.berakhirAt.lte).toEqual(now);
  });

  it("default now = waktu saat ini kalau tidak diberikan", async () => {
    const { prisma, calls } = makeFakePrisma({ kedaluwarsa: 0, tenggang: 0 });
    const before = Date.now();

    await transitionSubscriptionStatuses(prisma);

    expect(calls).toHaveLength(2);
    const tenggangCall = calls[1]!;
    expect(tenggangCall.where.berakhirAt.lte.getTime()).toBeGreaterThanOrEqual(before);
    expect(tenggangCall.where.berakhirAt.lte.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
