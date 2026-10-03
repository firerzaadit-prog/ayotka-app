import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type PeriodeDb = {
  id: string;
  schoolId: string;
  nama: string | null;
  mulai: Date;
  berakhir: Date;
  masaTenggangHari: number;
  seatQuota: number;
  catatan: string | null;
  dicabutAt: Date | null;
  dibuatOlehId: string | null;
  createdAt: Date;
};

type PermintaanDb = {
  id: string;
  schoolId: string;
  status: "menunggu" | "disetujui" | "ditolak";
  kuotaDiminta: number;
  mulaiDiminta: Date;
  berakhirDiminta: Date;
  catatan: string | null;
  periodeId: string | null;
  ditanganiOlehId: string | null;
  ditanganiAt: Date | null;
  catatanAdmin: string | null;
  createdAt: Date;
};

const h = vi.hoisted(() => ({
  store: [] as unknown[],
  permintaan: [] as unknown[],
  requireRole: vi.fn(),
  resolveSchoolId: vi.fn(),
  logAudit: vi.fn(),
  hitungSiswa: vi.fn(),
  sekolah: vi.fn(),
  komisi: vi.fn(),
  sekolahUpdate: vi.fn(),
  updateKursi: vi.fn(),
  kursiPerPeriode: vi.fn(),
}));
const daftar = () => h.store as PeriodeDb[];

vi.mock("@/lib/auth/session", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/schools/scope", () => ({ resolveSchoolId: h.resolveSchoolId }));
vi.mock("@/lib/audit/log", () => ({ logAudit: h.logAudit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/students/create", () => ({ hitungKursiTerpakai: h.hitungSiswa }));
vi.mock("@/lib/db/prisma", () => {
  const prisma: Record<string, unknown> = {
    school: { findUnique: h.sekolah, update: h.sekolahUpdate },
    periodeLangganan: {
      findMany: async ({ where }: { where: { schoolId: string; dicabutAt?: null } }) =>
        (h.store as PeriodeDb[])
          .filter((p) => p.schoolId === where.schoolId && (where.dicabutAt === null ? p.dicabutAt === null : true))
          .sort((a, b) => a.mulai.getTime() - b.mulai.getTime()),
      findUnique: async ({ where }: { where: { id: string } }) => (h.store as PeriodeDb[]).find((p) => p.id === where.id) ?? null,
      create: async ({ data }: { data: Partial<PeriodeDb> }) => {
        const baru = { id: `baru-${h.store.length + 1}`, dicabutAt: null, createdAt: new Date(), ...data } as PeriodeDb;
        h.store.push(baru);
        return baru;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<PeriodeDb> }) => {
        const p = (h.store as PeriodeDb[]).find((x) => x.id === where.id)!;
        Object.assign(p, data);
        return p;
      },
    },
    permintaanPerpanjangan: {
      findFirst: async ({ where }: { where: { schoolId: string; status: string | { not: string } } }) =>
        (h.permintaan as PermintaanDb[])
          .filter(
            (x) =>
              x.schoolId === where.schoolId &&
              (typeof where.status === "string" ? x.status === where.status : x.status !== where.status.not),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
      findUnique: async ({ where }: { where: { id: string } }) => (h.permintaan as PermintaanDb[]).find((x) => x.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<PermintaanDb> }) => {
        const x = (h.permintaan as PermintaanDb[]).find((y) => y.id === where.id)!;
        Object.assign(x, data);
        return x;
      },
    },
    partnerCommission: { create: h.komisi },
    partner: { findMany: async () => [{ id: "mitra-1", nama: "Mitra Satu" }] },
    entitlement: { updateMany: h.updateKursi, groupBy: h.kursiPerPeriode },
  };
  // Transaksi sungguhan membatalkan semua tulisan bila ada galat; tiruan ini meniru itu dengan salinan keadaan.
  prisma.$transaction = async (fn: (tx: unknown) => unknown) => {
    const periodeAwal = structuredClone(h.store);
    const permintaanAwal = structuredClone(h.permintaan);
    try {
      return await fn(prisma);
    } catch (error) {
      h.store.splice(0, h.store.length, ...periodeAwal);
      h.permintaan.splice(0, h.permintaan.length, ...permintaanAwal);
      throw error;
    }
  };
  return { prisma };
});

import { GET, POST } from "@/app/api/admin-pusat/schools/[id]/periode/route";
import { PATCH } from "@/app/api/admin-pusat/schools/[id]/periode/[periodeId]/route";
import { GET as statusKuota } from "@/app/api/admin-sekolah/kuota/route";
import { akhirHariWIB, startOfDayWIB } from "@/lib/utils/datetime";

const MITRA = "11111111-1111-4111-8111-111111111111";
const ctx = { params: Promise.resolve({ id: "sch-1" }) };
const ctxPeriode = (periodeId: string, id = "sch-1") => ({ params: Promise.resolve({ id, periodeId }) });
const req = (metode: string, body?: unknown) =>
  new Request("http://localhost/x", {
    method: metode,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

function periode(id: string, mulai: string, berakhir: string, lain: Partial<PeriodeDb> = {}): PeriodeDb {
  return {
    id,
    schoolId: "sch-1",
    nama: null,
    mulai: startOfDayWIB(mulai),
    berakhir: akhirHariWIB(berakhir),
    masaTenggangHari: 14,
    seatQuota: 100,
    catatan: null,
    dicabutAt: null,
    dibuatOlehId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...lain,
  };
}

function permintaan(id: string, lain: Partial<PermintaanDb> = {}): PermintaanDb {
  return {
    id,
    schoolId: "sch-1",
    status: "menunggu",
    kuotaDiminta: 120,
    mulaiDiminta: startOfDayWIB("2026-03-01"),
    berakhirDiminta: akhirHariWIB("2026-08-31"),
    catatan: null,
    periodeId: null,
    ditanganiOlehId: null,
    ditanganiAt: null,
    catatanAdmin: null,
    createdAt: new Date("2026-02-20T00:00:00Z"),
    ...lain,
  };
}

const BODY = { mulai: "2026-03-01", berakhir: "2026-08-31", seatQuota: 120 };
const PERMINTAAN_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.resetAllMocks();
  h.store.length = 0;
  h.permintaan.length = 0;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-01T05:00:00Z"));
  h.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
  h.sekolah.mockResolvedValue({ id: "sch-1", referredByPartner: null });
  h.hitungSiswa.mockResolvedValue(10);
  h.updateKursi.mockResolvedValue({ count: 0 });
  h.kursiPerPeriode.mockResolvedValue([]);
  h.sekolahUpdate.mockResolvedValue({});
});
afterEach(() => vi.useRealTimers());

describe("POST /periode - aktivasi dan perpanjangan", () => {
  it("403 kalau bukan admin pusat", async () => {
    h.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await POST(req("POST", BODY), ctx)).status).toBe(403);
  });

  it("404 kalau sekolah tidak ada", async () => {
    h.sekolah.mockResolvedValue(null);
    expect((await POST(req("POST", BODY), ctx)).status).toBe(404);
  });

  it.each([
    ["tanggal tidak ada di kalender", { ...BODY, mulai: "2026-02-31" }],
    ["format tanggal salah", { ...BODY, berakhir: "31-08-2026" }],
    ["kuota nol", { ...BODY, seatQuota: 0 }],
    ["masa tenggang terlalu panjang", { ...BODY, masaTenggangHari: 91 }],
    ["tanpa tanggal", { seatQuota: 5 }],
  ])("400 kalau %s", async (_nama, body) => {
    expect((await POST(req("POST", body), ctx)).status).toBe(400);
    expect(daftar()).toHaveLength(0);
  });

  it("tanggal diubah jadi awal hari dan AKHIR HARI WIB, tenggang bawaan 14 hari, dan diaudit", async () => {
    const res = await POST(req("POST", BODY), ctx);
    expect(res.status).toBe(201);
    expect(daftar()).toHaveLength(1);
    expect(daftar()[0]).toMatchObject({
      schoolId: "sch-1",
      mulai: startOfDayWIB("2026-03-01"),
      berakhir: akhirHariWIB("2026-08-31"),
      masaTenggangHari: 14,
      seatQuota: 120,
      dibuatOlehId: "pusat-1",
    });
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ aksi: "create", entitas: "school_periods", userId: "pusat-1" }),
    );
  });

  it("aktivasi pertama dengan rujukan mitra: sekolah dicatat dan komisi 'pending' dibuat", async () => {
    const res = await POST(req("POST", { ...BODY, referredByPartnerId: MITRA }), ctx);
    expect(res.status).toBe(201);
    expect(h.sekolahUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ referredByPartnerId: MITRA, seatActivatedById: "pusat-1" }) }),
    );
    expect(h.komisi).toHaveBeenCalledWith({ data: { partnerId: MITRA, schoolId: "sch-1", status: "pending" } });
  });

  it("perpanjangan (sekolah sudah pernah aktif) dengan rujukan mitra: 409 dan tidak ada yang dibuat", async () => {
    h.store.push(periode("lama", "2025-09-01", "2026-02-28"));
    const res = await POST(req("POST", { ...BODY, referredByPartnerId: MITRA }), ctx);
    expect(res.status).toBe(409);
    expect(daftar()).toHaveLength(1);
    expect(h.komisi).not.toHaveBeenCalled();
  });

  it("perpanjangan tanpa mitra: periode baru ditambah, periode lama tidak ditimpa, komisi tidak dibuat otomatis", async () => {
    const lama = periode("lama", "2025-09-01", "2026-02-28");
    h.store.push(lama);
    const res = await POST(req("POST", BODY), ctx);
    expect(res.status).toBe(201);
    expect(daftar()).toHaveLength(2);
    expect(daftar()[0]!.berakhir).toEqual(lama.berakhir);
    expect(h.komisi).not.toHaveBeenCalled();
  });

  it("periode yang langsung berlaku dengan kuota di bawah jumlah siswa terdaftar ditolak", async () => {
    h.hitungSiswa.mockResolvedValue(150);
    const res = await POST(req("POST", BODY), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/minimal 150/);
    expect(daftar()).toHaveLength(0);
  });

  it("periode di masa depan boleh berkuota lebih kecil dari siswa terdaftar (siswa lulus ditandai kemudian)", async () => {
    h.hitungSiswa.mockResolvedValue(150);
    const res = await POST(req("POST", { ...BODY, mulai: "2026-09-01", berakhir: "2027-02-28", seatQuota: 100 }), ctx);
    expect(res.status).toBe(201);
  });

  it("dibuat dari permintaan perpanjangan: permintaan ikut ditandai disetujui dan ditautkan ke periode barunya", async () => {
    h.permintaan.push(permintaan(PERMINTAAN_ID));
    const res = await POST(req("POST", { ...BODY, permintaanId: PERMINTAAN_ID }), ctx);
    expect(res.status).toBe(201);
    const p = (h.permintaan as PermintaanDb[])[0]!;
    expect(p.status).toBe("disetujui");
    expect(p.periodeId).toBe(daftar()[0]!.id);
    expect(p.ditanganiOlehId).toBe("pusat-1");
    expect(p.ditanganiAt).toEqual(new Date("2026-03-01T05:00:00Z"));
  });

  it("tanpa permintaanId: permintaan menunggu otomatis ditutup bila periode baru mencakup tanggal mulai yang diminta", async () => {
    h.permintaan.push(permintaan("a")); // meminta mulai 1 Maret 2026
    const res = await POST(req("POST", BODY), ctx); // periode 1 Maret - 31 Agustus mencakup 1 Maret
    expect(res.status).toBe(201);
    const p = (h.permintaan as PermintaanDb[])[0]!;
    expect(p).toMatchObject({ status: "disetujui", periodeId: daftar()[0]!.id, ditanganiOlehId: "pusat-1" });
  });

  it("tanpa permintaanId: periode yang TIDAK mencakup tanggal mulai yang diminta membiarkan permintaan tetap menunggu", async () => {
    h.permintaan.push(permintaan("a")); // meminta mulai 1 Maret 2026
    const res = await POST(req("POST", { ...BODY, mulai: "2026-04-01", berakhir: "2026-09-30" }), ctx);
    expect(res.status).toBe(201);
    expect((h.permintaan as PermintaanDb[])[0]!.status).toBe("menunggu");
  });

  it("tanpa permintaanId dan tanpa permintaan menunggu: periode dibuat biasa", async () => {
    h.permintaan.push(permintaan("a", { status: "ditolak" }));
    expect((await POST(req("POST", BODY), ctx)).status).toBe(201);
    expect((h.permintaan as PermintaanDb[])[0]!.status).toBe("ditolak"); // yang sudah diproses tidak tersentuh
  });

  it.each([
    ["permintaan sudah diproses", () => permintaan(PERMINTAAN_ID, { status: "ditolak" })],
    ["permintaan milik sekolah lain", () => permintaan(PERMINTAAN_ID, { schoolId: "sch-lain" })],
  ])("%s: 409 dan periode TIDAK ikut tersimpan (transaksi dibatalkan)", async (_nama, buat) => {
    h.permintaan.push(buat());
    const res = await POST(req("POST", { ...BODY, permintaanId: PERMINTAAN_ID }), ctx);
    expect(res.status).toBe(409);
    expect(daftar()).toHaveLength(0);
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("permintaanId yang tidak ada: 409 dan tidak ada periode tersimpan", async () => {
    const res = await POST(req("POST", { ...BODY, permintaanId: PERMINTAAN_ID }), ctx);
    expect(res.status).toBe(409);
    expect(daftar()).toHaveLength(0);
  });

  it("permintaanId bukan UUID ditolak (400)", async () => {
    expect((await POST(req("POST", { ...BODY, permintaanId: "bukan-uuid" }), ctx)).status).toBe(400);
  });

  it("tumpang tindih dengan periode lain ditolak (400) dan tidak membuat apa pun", async () => {
    h.store.push(periode("lama", "2026-01-01", "2026-06-30"));
    const res = await POST(req("POST", BODY), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/bertabrakan/);
    expect(daftar()).toHaveLength(1);
  });
});

describe("GET /periode - riwayat", () => {
  it("403 kalau bukan admin pusat; 404 kalau sekolah tidak ada", async () => {
    h.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await GET(req("GET"), ctx)).status).toBe(403);
    h.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
    h.sekolah.mockResolvedValue(null);
    expect((await GET(req("GET"), ctx)).status).toBe(404);
  });

  it("belum ada periode: isFirstActivation true", async () => {
    const json = await (await GET(req("GET"), ctx)).json();
    expect(json.isFirstActivation).toBe(true);
    expect(json.periode).toEqual([]);
    expect(json.permintaanMenunggu).toBeNull();
  });

  it("menyertakan permintaan perpanjangan yang menunggu (bukan yang sudah diproses)", async () => {
    h.permintaan.push(permintaan("a", { status: "ditolak" }), permintaan("b"));
    const json = await (await GET(req("GET"), ctx)).json();
    expect(json.permintaanMenunggu).toMatchObject({ id: "b", kuotaDiminta: 120 });
  });

  it("terbaru di atas, dengan status turunan, akhir efektif, dan kursi terpakai per periode", async () => {
    h.store.push(periode("a", "2025-09-01", "2026-02-28", { seatQuota: 50 }), periode("b", "2026-03-01", "2026-08-31"));
    h.kursiPerPeriode.mockResolvedValue([{ periodeId: "b", _count: { _all: 42 } }]);
    const json = await (await GET(req("GET"), ctx)).json();
    expect(json.isFirstActivation).toBe(false);
    expect(json.periode.map((p: { id: string }) => p.id)).toEqual(["b", "a"]);
    expect(json.periode[0]).toMatchObject({ id: "b", status: "aktif", kursiTerpakai: 42, seatQuota: 100 });
    expect(json.periode[1]).toMatchObject({ id: "a", status: "tenggang", kursiTerpakai: 0 });
    expect(json.siswaTerdaftar).toBe(10);
  });

  it("periode yang dicabut tetap tampil di riwayat tetapi tidak membuat isFirstActivation true", async () => {
    h.store.push(periode("x", "2026-01-01", "2026-06-30", { dicabutAt: new Date() }));
    const json = await (await GET(req("GET"), ctx)).json();
    expect(json.isFirstActivation).toBe(false);
    expect(json.periode[0]).toMatchObject({ id: "x", status: "dicabut" });
  });
});

describe("PATCH /periode/[periodeId] - ubah dan cabut", () => {
  beforeEach(() => {
    h.store.push(periode("p1", "2026-01-01", "2026-06-30"));
  });

  it("404 kalau periode milik sekolah lain atau tidak ada", async () => {
    expect((await PATCH(req("PATCH", { seatQuota: 5 }), ctxPeriode("p1", "sch-lain"))).status).toBe(404);
    expect((await PATCH(req("PATCH", { seatQuota: 5 }), ctxPeriode("tidak-ada"))).status).toBe(404);
  });

  it("400 kalau badan kosong", async () => {
    expect((await PATCH(req("PATCH", {}), ctxPeriode("p1"))).status).toBe(400);
  });

  it("memperpanjang tanggal berakhir menggeser batas kursi siswa yang sudah ada", async () => {
    const res = await PATCH(req("PATCH", { berakhir: "2026-09-30" }), ctxPeriode("p1"));
    expect(res.status).toBe(200);
    expect(h.updateKursi).toHaveBeenCalledWith({
      where: { periodeId: "p1", source: "school_seat", revokedAt: null },
      data: { endsAt: new Date(akhirHariWIB("2026-09-30").getTime() + 14 * 24 * 60 * 60 * 1000) },
    });
    expect(h.logAudit).toHaveBeenCalledWith(expect.objectContaining({ aksi: "update", entitas: "school_periods" }));
  });

  it("kuota periode yang sedang berlaku tidak boleh di bawah siswa terdaftar", async () => {
    h.hitungSiswa.mockResolvedValue(60);
    const res = await PATCH(req("PATCH", { seatQuota: 50 }), ctxPeriode("p1"));
    expect(res.status).toBe(400);
    expect(daftar()[0]!.seatQuota).toBe(100);
  });

  it("kuota periode yang belum mulai boleh diturunkan di bawah siswa terdaftar", async () => {
    h.store.push(periode("depan", "2026-09-01", "2027-02-28"));
    h.hitungSiswa.mockResolvedValue(60);
    const res = await PATCH(req("PATCH", { seatQuota: 50 }), ctxPeriode("depan"));
    expect(res.status).toBe(200);
  });

  it("mengubah rentang jadi bertabrakan dengan periode lain ditolak", async () => {
    h.store.push(periode("p2", "2026-07-01", "2026-12-31"));
    const res = await PATCH(req("PATCH", { berakhir: "2026-07-15" }), ctxPeriode("p1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/bertabrakan/);
  });

  it("mencabut periode: dicabutAt terisi, kursinya dicabut, diaudit sebagai 'delete'", async () => {
    const res = await PATCH(req("PATCH", { dicabut: true }), ctxPeriode("p1"));
    expect(res.status).toBe(200);
    expect(daftar()[0]!.dicabutAt).toEqual(new Date("2026-03-01T05:00:00Z"));
    expect(h.updateKursi).toHaveBeenCalledWith({
      where: { periodeId: "p1", revokedAt: null },
      data: { revokedAt: new Date("2026-03-01T05:00:00Z") },
    });
    expect(h.logAudit).toHaveBeenCalledWith(expect.objectContaining({ aksi: "delete" }));
  });

  it("periode yang sudah dicabut tidak bisa diubah lagi", async () => {
    daftar()[0]!.dicabutAt = new Date();
    expect((await PATCH(req("PATCH", { seatQuota: 5 }), ctxPeriode("p1"))).status).toBe(400);
  });
});

describe("GET /api/admin-sekolah/kuota - status untuk admin sekolah", () => {
  beforeEach(() => {
    h.requireRole.mockResolvedValue({ id: "adm-1", role: "admin_sekolah" });
    h.resolveSchoolId.mockResolvedValue("sch-1");
    h.hitungSiswa.mockResolvedValue(40);
  });

  it("403 kalau bukan admin; 403 kalau akun belum terhubung ke sekolah", async () => {
    h.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await statusKuota()).status).toBe(403);
    h.requireRole.mockResolvedValue({ id: "adm-1", role: "admin_sekolah" });
    h.resolveSchoolId.mockResolvedValue(null);
    expect((await statusKuota()).status).toBe(403);
  });

  it("belum ada periode: belum_aktif tanpa kuota", async () => {
    const json = await (await statusKuota()).json();
    expect(json).toMatchObject({ status: "belum_aktif", seatQuota: null, validUntil: null, isFull: false });
  });

  it("periode aktif: kuota, kursi terpakai, dan penuh/tidak", async () => {
    h.store.push(periode("p1", "2026-01-01", "2026-06-30", { seatQuota: 40, nama: "Semester Genap" }));
    const json = await (await statusKuota()).json();
    expect(json).toMatchObject({ status: "aktif", seatQuota: 40, seatsUsed: 40, isFull: true, namaPeriode: "Semester Genap" });
  });

  it("masa tenggang: status tenggang dengan batas terakhir ujian", async () => {
    h.store.push(periode("p1", "2025-09-01", "2026-02-28"));
    const json = await (await statusKuota()).json();
    expect(json.status).toBe("tenggang");
    expect(new Date(json.tenggangSampai)).toEqual(new Date(akhirHariWIB("2026-02-28").getTime() + 14 * 24 * 60 * 60 * 1000));
  });

  it("dibekukan (periode berakhir): status berakhir, tidak dianggap 'kuota penuh'", async () => {
    h.store.push(periode("p1", "2025-01-01", "2025-06-30", { seatQuota: 10 }));
    const json = await (await statusKuota()).json();
    expect(json).toMatchObject({ status: "berakhir", isFull: false });
  });

  it("H-7: periode aktif yang berakhir 7 hari lagi ditandai segeraBerakhir; H-8 belum", async () => {
    // Sekarang 1 Maret 2026 (WIB). Berakhir 8 Maret = 7 hari lagi.
    h.store.push(periode("p1", "2026-01-01", "2026-03-08"));
    let json = await (await statusKuota()).json();
    expect(json).toMatchObject({ status: "aktif", sisaHari: 7, segeraBerakhir: true });

    h.store.length = 0;
    h.store.push(periode("p1", "2026-01-01", "2026-03-09"));
    json = await (await statusKuota()).json();
    expect(json).toMatchObject({ status: "aktif", sisaHari: 8, segeraBerakhir: false });
  });

  it("hari terakhir: sisaHari 0 dan masih segeraBerakhir; sesudahnya masa tenggang tidak lagi 'segera'", async () => {
    h.store.push(periode("p1", "2026-01-01", "2026-03-01"));
    let json = await (await statusKuota()).json();
    expect(json).toMatchObject({ status: "aktif", sisaHari: 0, segeraBerakhir: true });

    h.store.length = 0;
    h.store.push(periode("p1", "2025-09-01", "2026-02-28"));
    json = await (await statusKuota()).json();
    expect(json).toMatchObject({ status: "tenggang", sisaHari: -1, segeraBerakhir: false });
  });

  it("permintaanMenunggu true bila admin sekolah sudah mengajukan perpanjangan", async () => {
    h.store.push(periode("p1", "2026-01-01", "2026-06-30"));
    expect((await (await statusKuota()).json()).permintaanMenunggu).toBe(false);
    h.permintaan.push(permintaan("a"));
    expect((await (await statusKuota()).json()).permintaanMenunggu).toBe(true);
  });

  it("periode berikutnya dijadwalkan: status akan_datang dengan tanggal mulai", async () => {
    h.store.push(periode("p1", "2026-09-01", "2027-02-28"));
    const json = await (await statusKuota()).json();
    expect(json.status).toBe("akan_datang");
    expect(new Date(json.mulai)).toEqual(startOfDayWIB("2026-09-01"));
  });
});
