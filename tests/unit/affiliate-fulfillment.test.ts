import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Bentuk kueri yang dipakai kode pemenuhan (cukup untuk meniru Prisma di memori)
type Where = {
  id?: string;
  userId?: string;
  user?: { email: { equals: string } };
  deletedAt?: null;
  gatewayRef?: string | null;
  studentId?: string;
  tipe?: string;
  status?: string;
  jumlah?: number;
  planId?: string;
  paymentChannel?: { startsWith: string };
  createdAt?: { gte: Date };
};
type Row = Record<string, unknown>;

const s = vi.hoisted(() => ({
  siswa: [] as Array<Record<string, unknown>>,
  saldo: [] as Array<Record<string, unknown>>,
  invoice: [] as Array<Record<string, unknown>>,
  entitlement: [] as Array<Record<string, unknown>>,
  plan: [] as Array<Record<string, unknown>>,
  audit: [] as Array<Record<string, unknown>>,
  gagalBuatSaldo: null as null | Error,
  urut: 0,
}));

const lebihBaruDari = (nilai: unknown, batas: Date) => nilai instanceof Date && nilai.getTime() >= batas.getTime();

vi.mock("@/lib/db/prisma", () => {
  const siswaFind = async ({ where }: { where: Where }) =>
    s.siswa.find((x) => {
      // seperti Prisma: baris yang sudah dihapus hanya dikecualikan bila kueri memintanya (deletedAt: null)
      if (where.deletedAt === null && x.deletedAt) return false;
      if (where.id) return x.id === where.id;
      if (where.userId) return x.userId === where.userId;
      if (where.user?.email) return String((x.user as { email: string }).email).toLowerCase() === String(where.user.email.equals).toLowerCase();
      return false;
    }) ?? null;

  const cocokTransaksi = (x: Row, where: Where) => {
    if (where.gatewayRef !== undefined && x.gatewayRef !== where.gatewayRef) return false;
    if (where.studentId !== undefined && x.studentId !== where.studentId) return false;
    if (where.tipe !== undefined && x.tipe !== where.tipe) return false;
    if (where.status !== undefined && x.status !== where.status) return false;
    if (where.jumlah !== undefined && x.jumlah !== where.jumlah) return false;
    if (where.planId !== undefined && x.planId !== where.planId) return false;
    if (where.paymentChannel?.startsWith && !String(x.paymentChannel ?? "").startsWith(where.paymentChannel.startsWith)) return false;
    if (where.createdAt?.gte && !lebihBaruDari(x.createdAt, where.createdAt.gte)) return false;
    return true;
  };
  const buat = (tabel: Array<Record<string, unknown>>, awalan: string) => async ({ data }: { data: Record<string, unknown> }) => {
    const baris = { id: `${awalan}-${++s.urut}`, createdAt: new Date(), ...data };
    tabel.push(baris);
    return baris;
  };

  return {
    prisma: {
      student: { findFirst: siswaFind },
      saldoTransaction: {
        findFirst: async ({ where }: { where: Where }) => s.saldo.find((x) => cocokTransaksi(x, where)) ?? null,
        create: async (arg: { data: Record<string, unknown> }) => {
          if (s.gagalBuatSaldo) throw s.gagalBuatSaldo;
          return buat(s.saldo, "saldo")(arg);
        },
      },
      plan: { findFirst: async ({ where }: { where: Record<string, unknown> }) => s.plan.find((p) => p.kode === where.kode && p.isActive === where.isActive) ?? null },
      invoice: {
        findFirst: async ({ where }: { where: Where }) => s.invoice.find((x) => cocokTransaksi(x, where)) ?? null,
      },
      entitlement: {
        findFirst: async ({ where }: { where: { studentId: string } }) => s.entitlement.filter((e) => e.studentId === where.studentId).sort((a, b) => (b.endsAt as Date).getTime() - (a.endsAt as Date).getTime())[0] ?? null,
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ invoice: { create: buat(s.invoice, "inv") }, entitlement: { create: buat(s.entitlement, "ent") } }),
    },
  };
});
vi.mock("@/lib/audit/log", () => ({ logAudit: async (a: Record<string, unknown>) => void s.audit.push(a) }));
vi.mock("@/lib/billing/kredit-pribadi", () => ({ SUMBER_KREDIT_PRIBADI: ["invoice", "voucher"], selaraskanKreditSiswaAman: vi.fn(async () => undefined) }));

import { AFFILIATE_PRODUCT_IDS, JENDELA_GANDA_MENIT, processAffiliateFulfillment, tentukanProdukAffiliate } from "@/lib/billing/affiliate-fulfillment";

const T50 = AFFILIATE_PRODUCT_IDS.TOPUP_50K;
const T25 = AFFILIATE_PRODUCT_IDS.TOPUP_25K;
const BULANAN = AFFILIATE_PRODUCT_IDS.PLAN_MONTHLY;
const SEMESTER = AFFILIATE_PRODUCT_IDS.PLAN_SEMESTER;

beforeEach(() => {
  s.siswa = [
    { id: "siswa-1", userId: "user-1", nama: "Budi", deletedAt: null, user: { email: "Budi@Example.com" } },
    { id: "siswa-hapus", userId: "user-9", nama: "Dihapus", deletedAt: new Date(), user: { email: "dihapus@example.com" } },
  ];
  s.saldo = [];
  s.invoice = [];
  s.entitlement = [];
  s.audit = [];
  s.plan = [
    { id: "plan-m", kode: "monthly", nama: "Paket Bulanan", harga: 59_000, durasiHari: 30, isActive: true },
    { id: "plan-s", kode: "semester", nama: "Paket Semester", harga: 299_000, durasiHari: 180, isActive: true },
  ];
  s.gagalBuatSaldo = null;
  s.urut = 0;
});

const catatan = (entitas: string) => s.audit.filter((a) => a.entitas === entitas);

describe("tentukanProdukAffiliate", () => {
  it.each([
    [{ productId: T50 }, "topup_50k"],
    [{ productId: T25 }, "topup_25k"],
    [{ productId: BULANAN }, "langganan_bulanan"],
    [{ productId: SEMESTER }, "langganan_semester"],
    [{ productId: ` ${T50} ` }, "topup_50k"],
    [{ productTitle: "AyoTKAID Top Up Kredit 50000" }, "topup_50k"],
    [{ productTitle: "AYOTKID Pembayaran Topup Kredit 25000" }, "topup_25k"],
    [{ productTitle: "Top Up 50.000" }, "topup_50k"],
    [{ productTitle: "Top Up Kredit", amount: 25_000 }, "topup_25k"],
    [{ productTitle: "AyoTKAID Bulanan" }, "langganan_bulanan"],
    [{ productTitle: "AYOTKAID Pembayaran 1 Semester" }, "langganan_semester"],
    [{ productId: "id-bentuk-lain", productTitle: "AyoTKAID Top Up Kredit 25000" }, "topup_25k"],
    [{ amount: 50_000 }, "topup_50k"],
    [{ amount: 25_000 }, "topup_25k"],
  ])("%j -> %s", (masuk, hasil) => {
    expect(tentukanProdukAffiliate(masuk)).toBe(hasil);
  });

  it("produk tak dikenal DITOLAK (null), tidak lagi diam-diam dianggap top-up 50.000", () => {
    for (const masuk of [
      {},
      { productId: "produk-lain-di-affiliate" },
      { productTitle: "Kaos AyoTKA" },
      { productTitle: "Kaos AyoTKA", amount: 50_000 },
      { productTitle: "Top Up Kredit" },
      { amount: 12_345 },
      { amount: Number.NaN },
      { productId: "tidak-dikenal", amount: 99_000 },
    ]) {
      expect(tentukanProdukAffiliate(masuk), JSON.stringify(masuk)).toBeNull();
    }
  });
});

describe("processAffiliateFulfillment: top-up", () => {
  it("top-up 50.000 untuk siswa yang dicari lewat email (tanpa peduli huruf besar/kecil); tercatat dengan nomor order dan kanal", async () => {
    const r = await processAffiliateFulfillment({ email: " budi@example.COM ", orderRef: "ORD-1", productId: T50, paymentChannel: "affiliate_get_webhook" });
    expect(r).toMatchObject({ ok: true, type: "topup", nominal: 50_000, studentName: "Budi" });
    expect(s.saldo).toHaveLength(1);
    expect(s.saldo[0]).toMatchObject({ studentId: "siswa-1", tipe: "topup", status: "berhasil", jumlah: 50_000, gatewayRef: "affiliate_ORD-1", paymentChannel: "affiliate_get_webhook" });
    expect(catatan("saldo_transactions")).toHaveLength(1);
  });

  it("nominal ditentukan PRODUK, bukan angka kiriman: produk 25.000 dengan amount 999999 tetap 25.000", async () => {
    const r = await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "ORD-2", productId: T25, amount: 999_999 });
    expect(r).toMatchObject({ ok: true, nominal: 25_000 });
    expect(s.saldo[0]!.jumlah).toBe(25_000);
  });

  it("dicari lewat studentId atau userId; siswa yang sudah dihapus tidak dikenali", async () => {
    expect((await processAffiliateFulfillment({ studentId: "siswa-1", orderRef: "A", productId: T25 })).ok).toBe(true);
    expect((await processAffiliateFulfillment({ userId: "user-1", orderRef: "B", productId: T50 })).ok).toBe(true);
    for (const [i, kunci] of [{ email: "dihapus@example.com" }, { studentId: "siswa-hapus" }, { userId: "user-9" }].entries()) {
      const hapus = await processAffiliateFulfillment({ ...kunci, orderRef: `C${i}`, productId: T50 });
      expect(hapus, JSON.stringify(kunci)).toMatchObject({ ok: false, kode: "siswa_tidak_ditemukan" });
    }
  });

  it("nomor order SAMA dua kali: hanya sekali ditambahkan (idempoten), jawaban kedua ok dan ditandai alreadyProcessed", async () => {
    await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "ORD-3", productId: T50 });
    const ulang = await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "ORD-3", productId: T50 });
    expect(ulang).toMatchObject({ ok: true, alreadyProcessed: true });
    expect(s.saldo).toHaveLength(1);
  });

  it("DUA PANGGILAN UNTUK SATU PEMBAYARAN (nomor order beda atau tidak ada): yang kedua dianggap ganda, dicatat, saldo tidak bertambah dua kali", async () => {
    await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "ORD-PURCHASE", productId: T50, paymentChannel: "affiliate_get_webhook" });
    const kedua = await processAffiliateFulfillment({ userId: "user-1", orderRef: "TRX-SUCCESS", productId: T50, paymentChannel: "affiliate_saas_success" });
    expect(kedua).toMatchObject({ ok: true, alreadyProcessed: true });
    expect(kedua.message).toMatch(/Diduga panggilan ganda/);
    expect(s.saldo).toHaveLength(1);
    expect(catatan("affiliate_callback_ganda")).toHaveLength(1);
    expect(catatan("affiliate_callback_ganda")[0]!.after).toMatchObject({ kode: "diduga_ganda", email: null, productId: T50, channel: "affiliate_saas_success" });

    // tanpa nomor order sama sekali
    s.saldo = [];
    s.audit = [];
    await processAffiliateFulfillment({ email: "budi@example.com", productId: T25 });
    const tanpaOrder = await processAffiliateFulfillment({ email: "budi@example.com", productId: T25 });
    expect(tanpaOrder.alreadyProcessed).toBe(true);
    expect(s.saldo).toHaveLength(1);
  });

  it("jendela ganda hanya berlaku untuk siswa + nominal yang sama dan dalam waktunya: nominal lain atau sudah lewat lima menit = pembelian sah", async () => {
    await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "A", productId: T50 });
    // nominal berbeda segera sesudahnya: sah
    expect((await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "B", productId: T25 })).alreadyProcessed).toBeUndefined();
    expect(s.saldo).toHaveLength(2);
    // pembelian 50.000 yang sama, tetapi transaksi sebelumnya sudah lebih dari jendela
    s.saldo[0]!.createdAt = new Date(Date.now() - (JENDELA_GANDA_MENIT + 1) * 60_000);
    const baru = await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "C", productId: T50 });
    expect(baru.alreadyProcessed).toBeUndefined();
    expect(s.saldo).toHaveLength(3);
  });

  it("transaksi manual/kanal lain (bukan affiliate) tidak dianggap ganda", async () => {
    s.saldo.push({ id: "m1", studentId: "siswa-1", tipe: "topup", status: "berhasil", jumlah: 50_000, paymentChannel: "midtrans", gatewayRef: "mid-1", createdAt: new Date() });
    const r = await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "X", productId: T50 });
    expect(r.alreadyProcessed).toBeUndefined();
    expect(s.saldo).toHaveLength(2);
  });

  it("dua panggilan berpapasan: pelanggaran unik database (P2002) bukan galat 500, melainkan idempoten", async () => {
    s.gagalBuatSaldo = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    const r = await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "ORD-RACE", productId: T50 });
    expect(r).toMatchObject({ ok: true, alreadyProcessed: true, nominal: 50_000 });
    expect(s.saldo).toHaveLength(0);
  });

  it("galat database lain tetap dilempar (tidak ditelan diam-diam)", async () => {
    s.gagalBuatSaldo = new Error("koneksi putus");
    await expect(processAffiliateFulfillment({ email: "budi@example.com", orderRef: "ORD-E", productId: T50 })).rejects.toThrow("koneksi putus");
  });

  it("nomor order panjang dipotong dan dipangkas spasinya", async () => {
    await processAffiliateFulfillment({ email: "budi@example.com", orderRef: `  ${"x".repeat(300)}  `, productId: T50 });
    expect(String(s.saldo[0]!.gatewayRef)).toBe(`affiliate_${"x".repeat(120)}`);
  });
});

describe("processAffiliateFulfillment: ditolak dan dicatat untuk admin", () => {
  it("siswa tidak ditemukan: tidak ada yang dibuat, kode + email + produk + nominal masuk audit gagal", async () => {
    const r = await processAffiliateFulfillment({ email: "orang.lain@example.com", orderRef: "ORD-9", productId: T50, amount: 50_000, paymentChannel: "affiliate_saas_success" });
    expect(r).toMatchObject({ ok: false, kode: "siswa_tidak_ditemukan" });
    expect(s.saldo).toHaveLength(0);
    const [c] = catatan("affiliate_callback_gagal");
    expect(c).toMatchObject({ userId: null, aksi: "create", entitasId: "ORD-9" });
    expect(c!.after).toMatchObject({ kode: "siswa_tidak_ditemukan", email: "orang.lain@example.com", productId: T50, amount: 50_000, channel: "affiliate_saas_success" });
  });

  it("produk tidak dikenal: ditolak walau siswanya ada; tidak ada saldo/invoice, dicatat", async () => {
    for (const masuk of [{ productId: "produk-lain" }, { productTitle: "Kaos" }, { amount: 12_345 }, {}]) {
      const r = await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "ORD-P", ...masuk });
      expect(r, JSON.stringify(masuk)).toMatchObject({ ok: false, kode: "produk_tidak_dikenal" });
    }
    expect(s.saldo).toHaveLength(0);
    expect(s.invoice).toHaveLength(0);
    expect(catatan("affiliate_callback_gagal")).toHaveLength(4);
  });

  it("panggilan sukses tidak meninggalkan catatan gagal", async () => {
    await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "ORD-OK", productId: T50 });
    expect(catatan("affiliate_callback_gagal")).toHaveLength(0);
    expect(catatan("affiliate_callback_ganda")).toHaveLength(0);
  });
});

describe("processAffiliateFulfillment: langganan", () => {
  it("paket bulanan: invoice lunas + entitlement 30 hari dari sekarang", async () => {
    const r = await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "ORD-L1", productId: BULANAN, paymentChannel: "affiliate_saas_success" });
    expect(r).toMatchObject({ ok: true, type: "langganan", planName: "Paket Bulanan" });
    expect(s.invoice[0]).toMatchObject({ studentId: "siswa-1", planId: "plan-m", amount: 59_000, status: "paid", gatewayRef: "affiliate_ORD-L1" });
    const ent = s.entitlement[0]!;
    expect(ent).toMatchObject({ studentId: "siswa-1", planId: "plan-m", source: "invoice", invoiceId: s.invoice[0]!.id });
    const hari = ((ent.endsAt as Date).getTime() - (ent.startsAt as Date).getTime()) / 86_400_000;
    expect(Math.round(hari)).toBe(30);
  });

  it("semester lewat judul produk; perpanjangan dihitung dari akhir langganan pribadi yang masih berjalan", async () => {
    const akhir = new Date(Date.now() + 10 * 86_400_000);
    s.entitlement.push({ id: "lama", studentId: "siswa-1", source: "invoice", startsAt: new Date(Date.now() - 86_400_000), endsAt: akhir });
    await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "ORD-L2", productTitle: "AYOTKAID Pembayaran 1 Semester" });
    const baru = s.entitlement.find((e) => e.planId === "plan-s")!;
    expect(Math.round(((baru.endsAt as Date).getTime() - akhir.getTime()) / 86_400_000)).toBe(180);
  });

  it("nomor order sama -> sekali; dua panggilan berdekatan untuk paket yang sama -> yang kedua ganda, tidak ada langganan dobel", async () => {
    await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "ORD-L3", productId: BULANAN });
    expect((await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "ORD-L3", productId: BULANAN })).alreadyProcessed).toBe(true);
    const lain = await processAffiliateFulfillment({ userId: "user-1", orderRef: "TRX-L3", productId: BULANAN });
    expect(lain.alreadyProcessed).toBe(true);
    expect(lain.message).toMatch(/Diduga panggilan ganda/);
    expect(s.invoice).toHaveLength(1);
    expect(s.entitlement).toHaveLength(1);
    expect(catatan("affiliate_callback_ganda")).toHaveLength(1);
  });

  it("paket tidak ada/tidak aktif di database: ditolak dan dicatat (bukan top-up diam-diam)", async () => {
    s.plan = [];
    const r = await processAffiliateFulfillment({ email: "budi@example.com", orderRef: "ORD-L4", productId: SEMESTER });
    expect(r).toMatchObject({ ok: false, kode: "paket_tidak_ada" });
    expect(s.saldo).toHaveLength(0);
    expect(catatan("affiliate_callback_gagal")[0]!.after).toMatchObject({ kode: "paket_tidak_ada" });
  });
});
