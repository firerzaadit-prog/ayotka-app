import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  studentFindFirst: vi.fn(),
  planFindMany: vi.fn(),
  planFindUnique: vi.fn(),
  invoiceFindFirst: vi.fn(),
  invoiceCount: vi.fn(),
  invoiceCreate: vi.fn(),
  invoiceDelete: vi.fn(),
  entitlementFindMany: vi.fn(),
  voucherFindUnique: vi.fn(),
  transaction: vi.fn(),
  getActiveEntitlement: vi.fn(),
  kursiSekolahTersedia: vi.fn(),
  createSnap: vi.fn(),
  activateVoucher: vi.fn(),
  selaraskan: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "127.0.0.1" }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    student: { findFirst: m.studentFindFirst },
    plan: { findMany: m.planFindMany, findUnique: m.planFindUnique },
    invoice: { findFirst: m.invoiceFindFirst, count: m.invoiceCount, create: m.invoiceCreate, delete: m.invoiceDelete },
    entitlement: { findMany: m.entitlementFindMany },
    voucher: { findUnique: m.voucherFindUnique },
    $transaction: m.transaction,
  },
}));
vi.mock("@/lib/billing/entitlements", () => ({
  getActiveEntitlement: m.getActiveEntitlement,
  kursiSekolahTersedia: m.kursiSekolahTersedia,
}));
vi.mock("@/lib/billing/midtrans", () => ({ createSnapTransaction: m.createSnap }));
vi.mock("@/lib/billing/vouchers", () => ({
  activateVoucher: m.activateVoucher,
  VoucherSudahDipakaiError: class VoucherSudahDipakaiError extends Error {},
}));
vi.mock("@/lib/billing/kredit-pribadi", () => ({
  SUMBER_KREDIT_PRIBADI: ["invoice", "voucher"],
  selaraskanKreditSiswaAman: m.selaraskan,
}));

import { GET, POST } from "@/app/api/siswa/checkout/route";
import { POST as REDEEM } from "@/app/api/siswa/vouchers/redeem/route";

const PLAN_ID = "11111111-1111-4111-8111-111111111111";
const SISWA_A = { id: "siswa-a", userId: "user-1", jalur: "A", schoolId: "sek-1", deletedAt: null, lulusAt: null, nama: "Budi", referralCode: "REF1", referredByStudentId: null, school: { nama: "SMP 1" } };
const post = (body: unknown) => new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.resetAllMocks();
  process.env.PAYMENT_MODE = "midtrans";
  m.requireRole.mockResolvedValue({ id: "user-1", role: "siswa", email: "budi@nisn.ayotka.id" });
  m.studentFindFirst.mockResolvedValue(SISWA_A);
  m.planFindUnique.mockResolvedValue({ id: PLAN_ID, kode: "monthly", isActive: true, harga: 49000, nama: "Bulanan", durasiHari: 30 });
  m.planFindMany.mockResolvedValue([]);
  m.invoiceFindFirst.mockResolvedValue(null);
  m.invoiceCount.mockResolvedValue(0);
  m.invoiceCreate.mockResolvedValue({ id: "inv-1" });
  m.createSnap.mockResolvedValue({ token: "tok", redirectUrl: "https://bayar" });
  m.entitlementFindMany.mockResolvedValue([]);
  m.getActiveEntitlement.mockResolvedValue(null);
  m.kursiSekolahTersedia.mockResolvedValue(false);
  m.logAudit.mockResolvedValue(undefined);
  m.selaraskan.mockResolvedValue(undefined);
});

describe("POST /api/siswa/checkout - blokir selama sekolah menanggung", () => {
  it("siswa Jalur A yang masih ditanggung sekolah: 409, tidak ada invoice dan tidak memanggil Midtrans", async () => {
    m.kursiSekolahTersedia.mockResolvedValue(true);
    const res = await POST(post({ planId: PLAN_ID }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("DITANGGUNG_SEKOLAH");
    expect(m.invoiceCreate).not.toHaveBeenCalled();
    expect(m.createSnap).not.toHaveBeenCalled();
  });

  it("alumni atau sekolah yang berhenti menanggung (kursi tidak tersedia): pembelian jalan seperti biasa", async () => {
    const res = await POST(post({ planId: PLAN_ID }));
    expect(res.status).toBe(201);
    expect(m.invoiceCreate).toHaveBeenCalledTimes(1);
    expect(m.kursiSekolahTersedia).toHaveBeenCalledWith(SISWA_A);
  });

  it("siswa mandiri: tidak terpengaruh (pemeriksaan kursi sekolah hanya berlaku untuk siswa sekolah)", async () => {
    m.studentFindFirst.mockResolvedValue({ ...SISWA_A, jalur: "B", schoolId: null });
    const res = await POST(post({ planId: PLAN_ID }));
    expect(res.status).toBe(201);
  });

  it("urutan pemeriksaan: pesan 'ditanggung sekolah' muncul sebelum paket dicari, jadi tidak membocorkan galat lain", async () => {
    m.kursiSekolahTersedia.mockResolvedValue(true);
    m.planFindUnique.mockResolvedValue(null);
    expect((await POST(post({ planId: PLAN_ID }))).status).toBe(409);
  });
});

describe("GET /api/siswa/checkout - data tambahan untuk halaman Langganan", () => {
  it("melaporkan ditanggungSekolah, alumni, dan rentang kredit pribadi yang ditunda", async () => {
    m.kursiSekolahTersedia.mockResolvedValue(false);
    m.studentFindFirst.mockResolvedValue({ ...SISWA_A, lulusAt: new Date("2026-06-01T00:00:00Z") });
    m.entitlementFindMany.mockResolvedValue([
      { startsAt: new Date("2027-02-10T00:00:00Z"), endsAt: new Date("2027-02-25T00:00:00Z") },
      { startsAt: new Date("2027-02-05T00:00:00Z"), endsAt: new Date("2027-03-07T00:00:00Z") },
    ]);
    const json = await (await GET()).json();
    expect(json).toMatchObject({ jalur: "A", ditanggungSekolah: false, alumni: true });
    expect(new Date(json.kreditDitunda.mulai).toISOString()).toBe("2027-02-05T00:00:00.000Z");
    expect(new Date(json.kreditDitunda.sampai).toISOString()).toBe("2027-03-07T00:00:00.000Z");
  });

  it("tanpa kredit tertunda: kreditDitunda null; siswa ditanggung sekolah: ditanggungSekolah true", async () => {
    m.kursiSekolahTersedia.mockResolvedValue(true);
    const json = await (await GET()).json();
    expect(json).toMatchObject({ ditanggungSekolah: true, alumni: false, kreditDitunda: null });
  });

  it("hanya kredit pribadi yang belum mulai yang dicari (kursi sekolah bukan kredit pribadi)", async () => {
    await GET();
    const where = m.entitlementFindMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({ studentId: "siswa-a", source: { in: ["invoice", "voucher"] }, revokedAt: null });
    expect(where.startsAt.gt).toBeInstanceOf(Date);
  });
});

describe("POST /api/siswa/vouchers/redeem - blokir selama sekolah menanggung", () => {
  const VOUCHER = { id: "v1", code: "ABC123", status: "unused", planId: PLAN_ID, partnerId: "p1", plan: { durasiHari: 30 } };

  beforeEach(() => {
    m.voucherFindUnique.mockResolvedValue(VOUCHER);
    m.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}));
    m.activateVoucher.mockResolvedValue({ id: "ent-1" });
  });

  it("ditanggung sekolah: 409 dan voucher dibiarkan utuh (belum dipakai, tidak membuka transaksi)", async () => {
    m.kursiSekolahTersedia.mockResolvedValue(true);
    const res = await REDEEM(post({ code: "abc123" }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("DITANGGUNG_SEKOLAH");
    expect(m.voucherFindUnique).not.toHaveBeenCalled();
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.selaraskan).not.toHaveBeenCalled();
  });

  it("tidak ditanggung: voucher aktif dan kredit diselaraskan setelah penukaran (penundaan bila sekolah akan menanggung)", async () => {
    const res = await REDEEM(post({ code: "abc123" }));
    expect(res.status).toBe(201);
    expect(m.activateVoucher).toHaveBeenCalledTimes(1);
    expect(m.selaraskan).toHaveBeenCalledTimes(1);
    expect(m.selaraskan.mock.calls[0]![1]).toBe("siswa-a");
  });

  it("penyelarasan hanya setelah penukaran berhasil: voucher sudah dipakai orang lain tidak memicunya", async () => {
    const { VoucherSudahDipakaiError } = await import("@/lib/billing/vouchers");
    m.activateVoucher.mockRejectedValue(new VoucherSudahDipakaiError());
    const res = await REDEEM(post({ code: "abc123" }));
    expect(res.status).toBe(409);
    expect(m.selaraskan).not.toHaveBeenCalled();
  });
});
