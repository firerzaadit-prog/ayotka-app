import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  executeRaw: vi.fn(),
  aggregate: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => {
  const tx = { $executeRaw: m.executeRaw, saldoTransaction: { aggregate: m.aggregate, create: m.create } };
  return { prisma: { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});

import { debitSaldoUntukAnalisis } from "@/lib/billing/saldo";

const params = { studentId: "siswa-1", attemptId: "att-1", subjectNama: "Matematika", harga: 9000 };

beforeEach(() => {
  vi.resetAllMocks();
  m.executeRaw.mockResolvedValue(0);
  m.create.mockResolvedValue({});
});

describe("debitSaldoUntukAnalisis", () => {
  it("mengunci per siswa SEBELUM membaca saldo (dua debit serentak harus bergantian, bukan sama-sama lolos)", async () => {
    m.aggregate.mockResolvedValue({ _sum: { jumlah: 20000 } });
    await debitSaldoUntukAnalisis(params);
    expect(m.executeRaw).toHaveBeenCalledTimes(1);
    expect(m.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(m.aggregate.mock.invocationCallOrder[0]!);
    // kunci memakai id siswa (nilai kedua dari tagged template: [strings, studentId])
    expect(m.executeRaw.mock.calls[0]!.slice(1)).toEqual(["siswa-1"]);
    expect((m.executeRaw.mock.calls[0]![0] as string[]).join("")).toMatch(/pg_advisory_xact_lock/);
  });

  it("saldo cukup: mencatat debit bernilai negatif sebesar harga dan mengembalikan true", async () => {
    m.aggregate.mockResolvedValue({ _sum: { jumlah: 20000 } });
    expect(await debitSaldoUntukAnalisis(params)).toBe(true);
    expect(m.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ studentId: "siswa-1", tipe: "debit_analisis", status: "berhasil", jumlah: -9000 }),
    });
  });

  it("saldo persis sama dengan harga: lolos", async () => {
    m.aggregate.mockResolvedValue({ _sum: { jumlah: 9000 } });
    expect(await debitSaldoUntukAnalisis(params)).toBe(true);
  });

  it("saldo kurang: false dan tidak menulis apa pun", async () => {
    m.aggregate.mockResolvedValue({ _sum: { jumlah: 8999 } });
    expect(await debitSaldoUntukAnalisis(params)).toBe(false);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("belum pernah ada transaksi (jumlah null) dianggap saldo 0", async () => {
    m.aggregate.mockResolvedValue({ _sum: { jumlah: null } });
    expect(await debitSaldoUntukAnalisis(params)).toBe(false);
  });
});
