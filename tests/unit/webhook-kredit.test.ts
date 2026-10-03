import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  invoiceFindUnique: vi.fn(),
  invoiceUpdate: vi.fn(),
  entCreate: vi.fn(),
  transaction: vi.fn(),
  studentFindUnique: vi.fn(),
  verify: vi.fn(),
  logAudit: vi.fn(),
  urutan: [] as string[],
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    invoice: { findUnique: m.invoiceFindUnique, update: m.invoiceUpdate },
    entitlement: { create: m.entCreate },
    student: { findUnique: m.studentFindUnique },
    voucherOrder: { findUnique: vi.fn().mockResolvedValue(null) },
    saldoTransaction: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: m.transaction,
  },
}));
vi.mock("@/lib/billing/midtrans", () => ({ verifyMidtransSignature: m.verify }));
vi.mock("@/lib/billing/vouchers", () => ({ generateUniqueVoucherCodes: vi.fn() }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit }));

import { POST } from "@/app/api/webhooks/midtrans/route";

const notif = (status = "settlement") =>
  new Request("http://localhost/x", {
    method: "POST",
    body: JSON.stringify({
      order_id: "inv-1",
      status_code: "200",
      gross_amount: "49000.00",
      signature_key: "sig",
      transaction_status: status,
      transaction_id: "trx-1",
      payment_type: "qris",
    }),
  });

beforeEach(() => {
  vi.resetAllMocks();
  m.urutan.length = 0;
  m.verify.mockResolvedValue(true);
  m.logAudit.mockResolvedValue(undefined);
  m.invoiceFindUnique.mockResolvedValue({ id: "inv-1", studentId: "siswa-1", planId: "plan-1", status: "pending", plan: { durasiHari: 30 } });
  m.invoiceUpdate.mockResolvedValue({});
  m.entCreate.mockImplementation(async () => {
    m.urutan.push("entitlement-dibuat");
    return {};
  });
  m.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const hasil = await fn({ invoice: { update: m.invoiceUpdate }, entitlement: { create: m.entCreate } });
    m.urutan.push("transaksi-commit");
    return hasil;
  });
  m.studentFindUnique.mockImplementation(async () => {
    m.urutan.push("penyelarasan-dimulai");
    return { schoolId: "sek-1", jalur: "B", deletedAt: null, lulusAt: null };
  });
});

describe("webhook Midtrans - penyelarasan kredit tidak boleh mengganggu pembayaran", () => {
  it("penyelarasan berjalan SETELAH transaksi pembayaran commit", async () => {
    const res = await POST(notif());
    expect(res.status).toBe(200);
    expect(m.urutan).toEqual(["entitlement-dibuat", "transaksi-commit", "penyelarasan-dimulai"]);
  });

  it("database galat saat penyelarasan: webhook tetap menjawab 200 dan pembayaran sudah tercatat (Midtrans tidak mengulang)", async () => {
    const galat = vi.spyOn(console, "error").mockImplementation(() => undefined);
    m.studentFindUnique.mockRejectedValue(new Error("db putus"));
    const res = await POST(notif());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(m.entCreate).toHaveBeenCalledTimes(1);
    expect(m.logAudit).toHaveBeenCalledTimes(1);
    expect(galat).toHaveBeenCalled();
    galat.mockRestore();
  });

  it("pembayaran gagal/kedaluwarsa tidak membuat kredit dan tidak memicu penyelarasan", async () => {
    const res = await POST(notif("expire"));
    expect(res.status).toBe(200);
    expect(m.entCreate).not.toHaveBeenCalled();
    expect(m.studentFindUnique).not.toHaveBeenCalled();
  });

  it("webhook terkirim ulang untuk invoice yang sudah dibayar: tidak memicu apa pun lagi", async () => {
    m.invoiceFindUnique.mockResolvedValue({ id: "inv-1", studentId: "siswa-1", planId: "plan-1", status: "paid", plan: { durasiHari: 30 } });
    await POST(notif());
    expect(m.entCreate).not.toHaveBeenCalled();
    expect(m.studentFindUnique).not.toHaveBeenCalled();
  });
});
