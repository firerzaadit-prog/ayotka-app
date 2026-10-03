import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Permintaan = {
  id: string;
  schoolId: string;
  diajukanOlehId: string | null;
  kuotaDiminta: number;
  mulaiDiminta: Date;
  berakhirDiminta: Date;
  catatan: string | null;
  status: "menunggu" | "disetujui" | "ditolak";
  periodeId: string | null;
  ditanganiOlehId: string | null;
  ditanganiAt: Date | null;
  catatanAdmin: string | null;
  createdAt: Date;
};
type PeriodeDb = { id: string; schoolId: string; mulai: Date; berakhir: Date; seatQuota: number; dicabutAt: Date | null };

const h = vi.hoisted(() => ({
  permintaan: [] as unknown[],
  periode: [] as unknown[],
  requireRole: vi.fn(),
  resolveSchoolId: vi.fn(),
  logAudit: vi.fn(),
  siswaAktif: vi.fn(),
  nomor: 0,
}));
const daftar = () => h.permintaan as Permintaan[];

vi.mock("@/lib/auth/session", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/schools/scope", () => ({ resolveSchoolId: h.resolveSchoolId }));
vi.mock("@/lib/audit/log", () => ({ logAudit: h.logAudit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/students/create", () => ({ hitungKursiTerpakai: h.siswaAktif }));
vi.mock("@/lib/db/prisma", () => {
  const cocokStatus = (status: Permintaan["status"], w: string | { not: string } | undefined) =>
    w === undefined ? true : typeof w === "string" ? status === w : status !== w.not;
  const prisma = {
    permintaanPerpanjangan: {
      findFirst: async ({ where, orderBy }: { where: { schoolId: string; status?: string | { not: string } }; orderBy?: Record<string, "asc" | "desc"> }) => {
        const hasil = (h.permintaan as Permintaan[]).filter((p) => p.schoolId === where.schoolId && cocokStatus(p.status, where.status));
        const kolom = orderBy ? Object.keys(orderBy)[0] : null;
        if (kolom) {
          hasil.sort((a, b) => {
            const x = (a as unknown as Record<string, Date | null>)[kolom]?.getTime() ?? 0;
            const y = (b as unknown as Record<string, Date | null>)[kolom]?.getTime() ?? 0;
            return orderBy![kolom] === "desc" ? y - x : x - y;
          });
        }
        return hasil[0] ?? null;
      },
      findUnique: async ({ where }: { where: { id: string } }) => (h.permintaan as Permintaan[]).find((p) => p.id === where.id) ?? null,
      findMany: async ({ where }: { where: { status: string } }) =>
        (h.permintaan as Permintaan[])
          .filter((p) => p.status === where.status)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((p) => ({ ...p, school: { id: p.schoolId, nama: `Sekolah ${p.schoolId}` } })),
      create: async ({ data }: { data: Partial<Permintaan> }) => {
        const baru: Permintaan = {
          id: `r${++h.nomor}`,
          status: "menunggu",
          periodeId: null,
          ditanganiOlehId: null,
          ditanganiAt: null,
          catatanAdmin: null,
          createdAt: new Date(),
          diajukanOlehId: null,
          catatan: null,
          ...data,
        } as Permintaan;
        h.permintaan.push(baru);
        return baru;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Permintaan> }) => {
        const p = (h.permintaan as Permintaan[]).find((x) => x.id === where.id)!;
        Object.assign(p, data);
        return p;
      },
    },
    periodeLangganan: {
      findMany: async ({ where }: { where: { schoolId: string; dicabutAt?: null } }) =>
        (h.periode as PeriodeDb[])
          .filter((p) => p.schoolId === where.schoolId && (where.dicabutAt === null ? p.dicabutAt === null : true))
          .sort((a, b) => a.mulai.getTime() - b.mulai.getTime()),
    },
  };
  return { prisma };
});

import { prisma } from "@/lib/db/prisma";
import {
  ajukanPermintaan,
  ambilPermintaanMenunggu,
  ambilPermintaanTerakhirDiproses,
  PermintaanTidakValidError,
  setujuiPermintaan,
  tolakPermintaan,
} from "@/lib/billing/permintaan-perpanjangan";
import { GET as sekolahGet, POST as sekolahPost } from "@/app/api/admin-sekolah/perpanjangan/route";
import { GET as pusatDaftar } from "@/app/api/admin-pusat/permintaan-perpanjangan/route";
import { PATCH as pusatTolak } from "@/app/api/admin-pusat/permintaan-perpanjangan/[id]/route";
import { akhirHariWIB, startOfDayWIB } from "@/lib/utils/datetime";

const db = prisma as unknown as Parameters<typeof ajukanPermintaan>[0];
const MULAI = startOfDayWIB("2026-07-01");
const BERAKHIR = akhirHariWIB("2026-12-31");
const dasar = { schoolId: "sch-1", diajukanOlehId: "adm-1", kuotaDiminta: 120, mulai: MULAI, berakhir: BERAKHIR };

beforeEach(() => {
  vi.resetAllMocks();
  h.permintaan.length = 0;
  h.periode.length = 0;
  h.nomor = 0;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-01T05:00:00Z"));
  h.requireRole.mockResolvedValue({ id: "adm-1", role: "admin_sekolah" });
  h.resolveSchoolId.mockResolvedValue("sch-1");
  h.siswaAktif.mockResolvedValue(95);
});
afterEach(() => vi.useRealTimers());

describe("ajukanPermintaan", () => {
  it("membuat permintaan berstatus menunggu dan merapikan catatan", async () => {
    const p = await ajukanPermintaan(db, { ...dasar, catatan: "  tolong dipercepat  " });
    expect(p).toMatchObject({ status: "menunggu", kuotaDiminta: 120, mulaiDiminta: MULAI, berakhirDiminta: BERAKHIR, catatan: "tolong dipercepat" });
    expect((await ajukanPermintaan(db, { ...dasar, schoolId: "sch-2", catatan: "   " })).catatan).toBeNull();
  });

  it("tanggal berakhir sebelum mulai ditolak", async () => {
    await expect(ajukanPermintaan(db, { ...dasar, berakhir: startOfDayWIB("2026-06-01") })).rejects.toBeInstanceOf(PermintaanTidakValidError);
    expect(daftar()).toHaveLength(0);
  });

  it("satu sekolah hanya boleh punya satu permintaan menunggu; sekolah lain tidak terpengaruh", async () => {
    await ajukanPermintaan(db, dasar);
    await expect(ajukanPermintaan(db, dasar)).rejects.toThrow(/Sudah ada permintaan/);
    expect(daftar()).toHaveLength(1);
    await expect(ajukanPermintaan(db, { ...dasar, schoolId: "sch-2" })).resolves.toBeTruthy();
  });

  it("setelah diproses (ditolak/disetujui) sekolah boleh mengajukan lagi", async () => {
    const p = await ajukanPermintaan(db, dasar);
    await tolakPermintaan(db, { permintaanId: p.id, adminId: "pusat-1" });
    await expect(ajukanPermintaan(db, dasar)).resolves.toBeTruthy();
  });
});

describe("setujuiPermintaan dan tolakPermintaan", () => {
  it("setuju: ditandai disetujui, ditautkan ke periode, dan dicatat siapa/kapan", async () => {
    const p = await ajukanPermintaan(db, dasar);
    const waktu = new Date("2026-03-02T00:00:00Z");
    const hasil = await setujuiPermintaan(db, { permintaanId: p.id, schoolId: "sch-1", periodeId: "per-1", adminId: "pusat-1" }, waktu);
    expect(hasil).toMatchObject({ status: "disetujui", periodeId: "per-1", ditanganiOlehId: "pusat-1", ditanganiAt: waktu });
  });

  it("setuju ditolak untuk permintaan milik sekolah lain, yang tidak ada, atau yang sudah diproses", async () => {
    const p = await ajukanPermintaan(db, dasar);
    await expect(setujuiPermintaan(db, { permintaanId: p.id, schoolId: "sch-lain", periodeId: "x", adminId: "a" })).rejects.toThrow(/tidak ditemukan/);
    await expect(setujuiPermintaan(db, { permintaanId: "tidak-ada", schoolId: "sch-1", periodeId: "x", adminId: "a" })).rejects.toThrow(/tidak ditemukan/);
    await setujuiPermintaan(db, { permintaanId: p.id, schoolId: "sch-1", periodeId: "x", adminId: "a" });
    await expect(setujuiPermintaan(db, { permintaanId: p.id, schoolId: "sch-1", periodeId: "y", adminId: "a" })).rejects.toThrow(/sudah diproses/);
    expect(daftar()[0]!.periodeId).toBe("x"); // tidak tertimpa
  });

  it("tolak: dicatat beserta alasan (dirapikan); tidak bisa menolak dua kali atau yang sudah disetujui", async () => {
    const p = await ajukanPermintaan(db, dasar);
    const hasil = await tolakPermintaan(db, { permintaanId: p.id, adminId: "pusat-1", catatanAdmin: "  Belum ada pembayaran  " });
    expect(hasil).toMatchObject({ status: "ditolak", catatanAdmin: "Belum ada pembayaran", ditanganiOlehId: "pusat-1" });
    await expect(tolakPermintaan(db, { permintaanId: p.id, adminId: "pusat-1" })).rejects.toThrow(/sudah diproses/);

    const q = await ajukanPermintaan(db, dasar);
    await setujuiPermintaan(db, { permintaanId: q.id, schoolId: "sch-1", periodeId: "x", adminId: "a" });
    await expect(tolakPermintaan(db, { permintaanId: q.id, adminId: "pusat-1" })).rejects.toThrow(/sudah diproses/);
  });

  it("ambil yang menunggu dan yang terakhir diproses", async () => {
    const a = await ajukanPermintaan(db, dasar);
    await tolakPermintaan(db, { permintaanId: a.id, adminId: "pusat-1", catatanAdmin: "x" }, new Date("2026-03-02T00:00:00Z"));
    const b = await ajukanPermintaan(db, dasar);
    expect((await ambilPermintaanMenunggu(db, "sch-1"))?.id).toBe(b.id);
    expect((await ambilPermintaanTerakhirDiproses(db, "sch-1"))?.id).toBe(a.id);
    expect(await ambilPermintaanMenunggu(db, "sch-lain")).toBeNull();
  });
});

describe("rute admin sekolah /perpanjangan", () => {
  const post = (body: unknown) =>
    sekolahPost(new Request("http://localhost/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  const BODY = { kuotaDiminta: 120, mulai: "2026-07-01", berakhir: "2026-12-31" };

  it("403 kalau bukan admin dan 403 kalau akun belum terhubung ke sekolah (GET dan POST)", async () => {
    h.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await sekolahGet()).status).toBe(403);
    expect((await post(BODY)).status).toBe(403);
    h.requireRole.mockResolvedValue({ id: "adm-1", role: "admin_sekolah" });
    h.resolveSchoolId.mockResolvedValue(null);
    expect((await sekolahGet()).status).toBe(403);
    expect((await post(BODY)).status).toBe(403);
  });

  it("POST: membuat permintaan dengan tanggal awal-hari dan AKHIR-HARI WIB, mencatat pengaju, dan diaudit", async () => {
    const res = await post({ ...BODY, catatan: "mohon diproses" });
    expect(res.status).toBe(201);
    expect(daftar()[0]).toMatchObject({
      schoolId: "sch-1",
      diajukanOlehId: "adm-1",
      kuotaDiminta: 120,
      mulaiDiminta: MULAI,
      berakhirDiminta: BERAKHIR,
      catatan: "mohon diproses",
    });
    expect(h.logAudit).toHaveBeenCalledWith(expect.objectContaining({ aksi: "create", entitas: "school_renewal_requests" }));
  });

  it.each([
    ["tanggal tidak ada", { ...BODY, mulai: "2026-02-31" }],
    ["kuota nol", { ...BODY, kuotaDiminta: 0 }],
    ["tanpa tanggal berakhir", { kuotaDiminta: 5, mulai: "2026-07-01" }],
  ])("POST 400 kalau %s", async (_nama, body) => {
    expect((await post(body)).status).toBe(400);
    expect(daftar()).toHaveLength(0);
  });

  it("POST 409 kalau berakhir sebelum mulai atau sudah ada permintaan yang menunggu", async () => {
    expect((await post({ ...BODY, mulai: "2026-12-31", berakhir: "2026-07-01" })).status).toBe(409);
    expect((await post(BODY)).status).toBe(201);
    const kedua = await post(BODY);
    expect(kedua.status).toBe(409);
    expect((await kedua.json()).error).toMatch(/Sudah ada permintaan/);
    expect(daftar()).toHaveLength(1);
  });

  it("GET: usulan mulai = sehari setelah periode terakhir berakhir, tetapi tidak sebelum hari ini", async () => {
    // Belum ada periode: hari ini.
    expect((await (await sekolahGet()).json()).mulaiDefault).toBe("2026-03-01");

    // Periode berjalan sampai 30 Juni: berkesinambungan, mulai 1 Juli.
    h.periode.push({ id: "p1", schoolId: "sch-1", mulai: startOfDayWIB("2026-01-01"), berakhir: akhirHariWIB("2026-06-30"), seatQuota: 80, dicabutAt: null });
    let json = await (await sekolahGet()).json();
    expect(json).toMatchObject({ mulaiDefault: "2026-07-01", kuotaTerakhir: 80, siswaAktif: 95 });

    // Periode sudah lama berakhir: tidak mengusulkan tanggal di masa lalu.
    h.periode.length = 0;
    h.periode.push({ id: "p1", schoolId: "sch-1", mulai: startOfDayWIB("2025-01-01"), berakhir: akhirHariWIB("2025-06-30"), seatQuota: 80, dicabutAt: null });
    json = await (await sekolahGet()).json();
    expect(json.mulaiDefault).toBe("2026-03-01");
  });

  it("GET: menyertakan permintaan menunggu dan alasan penolakan terakhir", async () => {
    const a = await ajukanPermintaan(db, dasar);
    await tolakPermintaan(db, { permintaanId: a.id, adminId: "pusat-1", catatanAdmin: "Belum ada pembayaran" }, new Date("2026-03-02T00:00:00Z"));
    let json = await (await sekolahGet()).json();
    expect(json.menunggu).toBeNull();
    expect(json.terakhirDiproses).toMatchObject({ status: "ditolak", catatanAdmin: "Belum ada pembayaran" });

    await ajukanPermintaan(db, dasar);
    json = await (await sekolahGet()).json();
    expect(json.menunggu).toMatchObject({ kuotaDiminta: 120 });
  });
});

describe("rute admin pusat /permintaan-perpanjangan", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const patch = (id: string, body: unknown) =>
    pusatTolak(new Request("http://localhost/x", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), ctx(id));

  beforeEach(() => {
    h.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
  });

  it("403 kalau bukan admin pusat", async () => {
    h.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await pusatDaftar()).status).toBe(403);
    expect((await patch("r1", { aksi: "tolak" })).status).toBe(403);
  });

  it("GET: hanya yang menunggu, terlama di atas, dengan nama sekolah", async () => {
    const a = await ajukanPermintaan(db, { ...dasar, schoolId: "sch-a" });
    await ajukanPermintaan(db, { ...dasar, schoolId: "sch-b" });
    await tolakPermintaan(db, { permintaanId: a.id, adminId: "pusat-1" });
    const json = await (await pusatDaftar()).json();
    expect(json.permintaan).toHaveLength(1);
    expect(json.permintaan[0]).toMatchObject({ schoolId: "sch-b", schoolNama: "Sekolah sch-b", kuotaDiminta: 120 });
  });

  it("PATCH tolak: 200, alasan tercatat, diaudit", async () => {
    const p = await ajukanPermintaan(db, dasar);
    const res = await patch(p.id, { aksi: "tolak", catatanAdmin: "Pembayaran belum masuk" });
    expect(res.status).toBe(200);
    expect(daftar()[0]).toMatchObject({ status: "ditolak", catatanAdmin: "Pembayaran belum masuk", ditanganiOlehId: "pusat-1" });
    expect(h.logAudit).toHaveBeenCalledWith(expect.objectContaining({ aksi: "update", entitas: "school_renewal_requests", entitasId: p.id }));
  });

  it("PATCH: 404 kalau tidak ada, 409 kalau sudah diproses, 400 kalau aksinya bukan 'tolak' (menyetujui bukan lewat sini)", async () => {
    expect((await patch("tidak-ada", { aksi: "tolak" })).status).toBe(404);
    const p = await ajukanPermintaan(db, dasar);
    expect((await patch(p.id, { aksi: "setujui" })).status).toBe(400);
    expect(daftar()[0]!.status).toBe("menunggu");
    await patch(p.id, { aksi: "tolak" });
    expect((await patch(p.id, { aksi: "tolak" })).status).toBe(409);
  });
});
