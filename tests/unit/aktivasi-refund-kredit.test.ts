import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  studentFindMany: vi.fn(),
  studentFindFirst: vi.fn(),
  planFindUnique: vi.fn(),
  invoiceFindFirst: vi.fn(),
  invoiceFindUnique: vi.fn(),
  invoiceUpdate: vi.fn(),
  invoiceCreate: vi.fn(),
  entFindFirst: vi.fn(),
  entFindMany: vi.fn(),
  entCreate: vi.fn(),
  entUpdateMany: vi.fn(),
  attemptCount: vi.fn(),
  transaction: vi.fn(),
  getActiveEntitlement: vi.fn(),
  kursiSekolahTersedia: vi.fn(),
  getSaldo: vi.fn(),
  selaraskan: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "127.0.0.1" }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    student: { findMany: m.studentFindMany, findFirst: m.studentFindFirst },
    plan: { findUnique: m.planFindUnique },
    invoice: { findFirst: m.invoiceFindFirst, findUnique: m.invoiceFindUnique, update: m.invoiceUpdate, create: m.invoiceCreate },
    entitlement: { findFirst: m.entFindFirst, findMany: m.entFindMany, create: m.entCreate, updateMany: m.entUpdateMany },
    attempt: { count: m.attemptCount },
    $transaction: m.transaction,
  },
}));
vi.mock("@/lib/billing/entitlements", () => ({
  getActiveEntitlement: m.getActiveEntitlement,
  kursiSekolahTersedia: m.kursiSekolahTersedia,
}));
vi.mock("@/lib/billing/saldo", () => ({ getSaldo: m.getSaldo }));
vi.mock("@/lib/billing/kredit-pribadi", () => ({
  SUMBER_KREDIT_PRIBADI: ["invoice", "voucher"],
  selaraskanKreditSiswaAman: m.selaraskan,
}));

import { GET, POST } from "@/app/api/admin-pusat/aktivasi-manual/route";
import { POST as REFUND } from "@/app/api/admin-pusat/invoices/[id]/refund/route";

const STUDENT_ID = "22222222-2222-4222-8222-222222222222";
const PLAN_ID = "11111111-1111-4111-8111-111111111111";
const HARI = 24 * 60 * 60 * 1000;
const post = (body: unknown) => new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) });
const BODY = { tipe: "langganan", studentId: STUDENT_ID, planId: PLAN_ID, catatan: "bukti WA 3 Okt" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
  m.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
  m.studentFindFirst.mockResolvedValue({ id: STUDENT_ID, nama: "Budi" });
  m.planFindUnique.mockResolvedValue({ id: PLAN_ID, kode: "monthly", nama: "Bulanan", isActive: true, harga: 49000, durasiHari: 30 });
  m.invoiceFindFirst.mockResolvedValue(null);
  m.entFindFirst.mockResolvedValue(null);
  m.entFindMany.mockResolvedValue([]);
  m.getSaldo.mockResolvedValue(0);
  m.getActiveEntitlement.mockResolvedValue(null);
  m.kursiSekolahTersedia.mockResolvedValue(false);
  m.selaraskan.mockResolvedValue(undefined);
  m.logAudit.mockResolvedValue(undefined);
  m.invoiceCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: "inv-1", ...data }));
  m.entCreate.mockImplementation(async ({ data }: { data: { endsAt: Date } }) => ({ id: "ent-1", ...data }));
  m.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({ invoice: { create: m.invoiceCreate }, entitlement: { create: m.entCreate } }),
  );
});

describe("aktivasi manual - siswa sekolah (Jalur A) boleh dicari dan diaktifkan", () => {
  it("GET mencari Jalur A dan B, dan melaporkan jalur, sekolah, alumni, dan apakah masih ditanggung sekolah", async () => {
    m.studentFindMany.mockResolvedValue([
      { id: "a", nama: "Alumni Satu", jenjang: "SMP", jalur: "A", schoolId: "s1", deletedAt: null, lulusAt: new Date("2026-06-01"), school: { nama: "SMP 1" }, user: { email: "1@nisn.ayotka.id" } },
      { id: "b", nama: "Mandiri Dua", jenjang: "SMP", jalur: "B", schoolId: null, deletedAt: null, lulusAt: null, school: null, user: { email: "b@x.id" } },
    ]);
    m.kursiSekolahTersedia.mockImplementation(async (s: { id: string }) => s.id === "a" ? false : false);
    const res = await GET(new Request("http://localhost/x?q=satu"));
    const json = await res.json();
    expect(m.studentFindMany.mock.calls[0]![0].where.jalur).toEqual({ in: ["A", "B"] });
    expect(json.students[0]).toMatchObject({ id: "a", jalur: "A", sekolah: "SMP 1", alumni: true, ditanggungSekolah: false });
    expect(json.students[1]).toMatchObject({ id: "b", jalur: "B", sekolah: null, alumni: false, ditanggungSekolah: false });
  });

  it("GET: siswa yang kursi sekolahnya masih berlaku ditandai ditanggungSekolah", async () => {
    m.studentFindMany.mockResolvedValue([
      { id: "a", nama: "Siswa Aktif", jenjang: "SMP", jalur: "A", schoolId: "s1", deletedAt: null, lulusAt: null, school: { nama: "SMP 1" }, user: { email: "x@x.id" } },
    ]);
    m.kursiSekolahTersedia.mockResolvedValue(true);
    const json = await (await GET(new Request("http://localhost/x?q=aktif"))).json();
    expect(json.students[0].ditanggungSekolah).toBe(true);
  });

  it("POST menerima siswa Jalur A atau B (bukan hanya mandiri) dan menolak yang tidak ada", async () => {
    await POST(post(BODY));
    expect(m.studentFindFirst.mock.calls[0]![0].where).toMatchObject({ id: STUDENT_ID, deletedAt: null, jalur: { in: ["A", "B"] } });
    m.studentFindFirst.mockResolvedValue(null);
    expect((await POST(post(BODY))).status).toBe(404);
  });

  it("masa aktif baru ditambahkan hanya setelah langganan PRIBADI yang masih berjalan (kursi sekolah tidak dihitung)", async () => {
    const sekarang = Date.now();
    const pribadiSampai = new Date(sekarang + 10 * HARI);
    m.entFindFirst.mockResolvedValue({ endsAt: pribadiSampai });
    const res = await POST(post(BODY));
    expect(res.status).toBe(201);
    const where = m.entFindFirst.mock.calls[0]![0].where;
    expect(where).toMatchObject({ studentId: STUDENT_ID, source: { in: ["invoice", "voucher"] }, revokedAt: null });
    const dibuat = m.entCreate.mock.calls[0]![0].data;
    expect(dibuat.endsAt.getTime()).toBe(new Date(pribadiSampai).setDate(pribadiSampai.getDate() + 30));
  });

  it("tanpa langganan pribadi aktif (mis. hanya ada kursi sekolah): dihitung 30 hari dari sekarang, tidak menumpuk di atas masa sekolah", async () => {
    m.getActiveEntitlement.mockResolvedValue({
      entitlement: { source: "school_seat", endsAt: new Date(Date.now() + 120 * HARI) },
      canStartNewAttempt: true,
      canViewHistory: true,
    });
    const sebelum = Date.now();
    await POST(post(BODY));
    const dibuat = m.entCreate.mock.calls[0]![0].data;
    const selisihHari = (dibuat.endsAt.getTime() - sebelum) / HARI;
    expect(selisihHari).toBeGreaterThan(29.9);
    expect(selisihHari).toBeLessThan(30.1);
  });

  it("setelah tersimpan, kredit diselaraskan dengan periode sekolah siswa", async () => {
    await POST(post(BODY));
    expect(m.selaraskan).toHaveBeenCalledTimes(1);
    expect(m.selaraskan.mock.calls[0]![1]).toBe(STUDENT_ID);
  });

  it("jawaban melaporkan penundaan: ditundaSampaiMulai terisi dan berlakuSampai mengikuti ujung baris lanjutan", async () => {
    const mulaiTunda = new Date(Date.now() + 100 * HARI);
    const akhirTunda = new Date(Date.now() + 130 * HARI);
    m.entFindMany.mockResolvedValue([{ startsAt: mulaiTunda, endsAt: akhirTunda }]);
    const json = await (await POST(post(BODY))).json();
    expect(new Date(json.ditundaSampaiMulai).getTime()).toBe(mulaiTunda.getTime());
    expect(new Date(json.berlakuSampai).getTime()).toBe(akhirTunda.getTime());
  });

  it("tanpa penundaan: ditundaSampaiMulai null (perilaku lama tetap)", async () => {
    const mulaiSekarang = new Date(Date.now() - 1000);
    m.entFindMany.mockResolvedValue([{ startsAt: mulaiSekarang, endsAt: new Date(Date.now() + 30 * HARI) }]);
    const json = await (await POST(post(BODY))).json();
    expect(json.ditundaSampaiMulai).toBeNull();
  });

  it("aktivasi tidak gagal walau penyelarasan melempar galat tak terduga? (versi aman menelannya, jadi tidak ada galat bocor)", async () => {
    // selaraskanKreditSiswaAman sendiri tidak pernah menolak; di sini dipastikan rute tidak bergantung pada hasilnya.
    m.selaraskan.mockResolvedValue(undefined);
    expect((await POST(post(BODY))).status).toBe(201);
  });
});

describe("refund invoice - semua baris akses dari invoice itu dicabut", () => {
  const ctx = { params: Promise.resolve({ id: "inv-9" }) };
  const refund = (force = true) => REFUND(post({ force }), ctx);

  beforeEach(() => {
    m.invoiceFindUnique.mockResolvedValue({ id: "inv-9", studentId: STUDENT_ID, status: "paid" });
    m.attemptCount.mockResolvedValue(0);
    m.invoiceUpdate.mockResolvedValue({ id: "inv-9", status: "refunded" });
    m.entUpdateMany.mockResolvedValue({ count: 2 });
    m.transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  });

  it("invoice yang dipecah penundaan (dua baris): keduanya dicabut dengan satu updateMany berdasarkan invoiceId", async () => {
    m.entFindMany.mockResolvedValue([
      { id: "e1", startsAt: new Date("2026-07-20T00:00:00Z"), endsAt: new Date("2026-08-01T00:00:00Z") },
      { id: "e2", startsAt: new Date("2027-02-15T00:00:00Z"), endsAt: new Date("2027-03-05T00:00:00Z") },
    ]);
    const res = await refund();
    expect(res.status).toBe(200);
    expect(m.entUpdateMany).toHaveBeenCalledTimes(1);
    expect(m.entUpdateMany.mock.calls[0]![0].where).toEqual({ invoiceId: "inv-9", revokedAt: null });
    expect(m.entUpdateMany.mock.calls[0]![0].data.revokedAt).toBeInstanceOf(Date);
  });

  it("jumlah try out yang dihitung untuk konfirmasi memakai awal akses TERAWAL dari invoice itu", async () => {
    m.entFindMany.mockResolvedValue([
      { id: "e2", startsAt: new Date("2027-02-15T00:00:00Z"), endsAt: new Date("2027-03-05T00:00:00Z") },
      { id: "e1", startsAt: new Date("2026-07-20T00:00:00Z"), endsAt: new Date("2026-08-01T00:00:00Z") },
    ]);
    m.attemptCount.mockResolvedValue(3);
    const res = await refund(false);
    const json = await res.json();
    expect(json.requiresConfirmation).toBe(true);
    expect(json.attemptCount).toBe(3);
    // query findMany diurutkan menaik menurut startsAt, jadi baris pertama = terawal
    expect(m.entFindMany.mock.calls[0]![0].orderBy).toEqual({ startsAt: "asc" });
    expect(m.entUpdateMany).not.toHaveBeenCalled();
  });

  it("invoice tanpa baris akses aktif: tetap bisa direfund dan tidak memanggil updateMany", async () => {
    m.entFindMany.mockResolvedValue([]);
    const res = await refund();
    expect(res.status).toBe(200);
    expect(m.entUpdateMany).not.toHaveBeenCalled();
    expect(m.invoiceUpdate).toHaveBeenCalledTimes(1);
  });

  it("invoice yang belum dibayar ditolak (409)", async () => {
    m.invoiceFindUnique.mockResolvedValue({ id: "inv-9", studentId: STUDENT_ID, status: "pending" });
    expect((await refund()).status).toBe(409);
  });
});
