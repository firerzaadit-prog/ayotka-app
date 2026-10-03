import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Siswa = {
  id: string;
  schoolId: string | null;
  jalur: "A" | "B";
  deletedAt: Date | null;
  lulusAt: Date | null;
};
type Kursi = { id: string; studentId: string; source: "school_seat" | "invoice" | "voucher"; revokedAt: Date | null };

const h = vi.hoisted(() => ({
  siswa: [] as unknown[],
  kursi: [] as unknown[],
  requireRole: vi.fn(),
  resolveSchoolId: vi.fn(),
  logAudit: vi.fn(),
  assertKuota: vi.fn(),
  kuotaAcuan: vi.fn(),
  hitungTerdaftar: vi.fn(),
  pernahTransaksi: 0,
}));
const daftarSiswa = () => h.siswa as Siswa[];
const daftarKursi = () => h.kursi as Kursi[];

/** Pencocok `where` secukupnya untuk kolom yang dipakai kode: id.in, jalur, deletedAt, schoolId, lulusAt. */
function cocok(s: Siswa, where: Record<string, unknown>): boolean {
  const id = where.id as { in: string[] } | undefined;
  if (id && !id.in.includes(s.id)) return false;
  if ("jalur" in where && s.jalur !== where.jalur) return false;
  if ("deletedAt" in where && where.deletedAt === null && s.deletedAt !== null) return false;
  if ("schoolId" in where) {
    const w = where.schoolId as { not: null } | string;
    if (typeof w === "string" ? s.schoolId !== w : s.schoolId === null) return false;
  }
  if ("lulusAt" in where) {
    const w = where.lulusAt as null | { not: null };
    if (w === null ? s.lulusAt !== null : s.lulusAt === null) return false;
  }
  return true;
}

vi.mock("@/lib/auth/session", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/schools/scope", () => ({ resolveSchoolId: h.resolveSchoolId }));
vi.mock("@/lib/audit/log", () => ({ logAudit: h.logAudit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/students/create", async (importAsli) => {
  const asli = await importAsli<typeof import("@/lib/students/create")>();
  return {
    ...asli,
    assertKuotaTersedia: h.assertKuota,
    kuotaAcuanSekolah: h.kuotaAcuan,
    hitungKursiTerpakai: h.hitungTerdaftar,
  };
});
vi.mock("@/lib/db/prisma", () => {
  const student = {
    findMany: async ({ where }: { where: Record<string, unknown> }) =>
      (h.siswa as Siswa[]).filter((s) => cocok(s, where)).map((s) => ({ ...s })),
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Siswa> }) => {
      for (const s of (h.siswa as Siswa[]).filter((x) => cocok(x, where))) Object.assign(s, data);
      return { count: 0 };
    },
    count: async ({ where }: { where: Record<string, unknown> }) => (h.siswa as Siswa[]).filter((s) => cocok(s, where)).length,
  };
  const entitlement = {
    updateMany: async ({ where, data }: { where: { studentId: { in: string[] }; source: string; revokedAt: null }; data: Partial<Kursi> }) => {
      for (const k of (h.kursi as Kursi[]).filter(
        (x) => where.studentId.in.includes(x.studentId) && x.source === where.source && x.revokedAt === null,
      )) {
        Object.assign(k, data);
      }
      return { count: 0 };
    },
  };
  const prisma = { student, entitlement } as Record<string, unknown>;
  prisma.$transaction = async (fn: (tx: unknown) => unknown) => {
    h.pernahTransaksi++;
    return fn(prisma);
  };
  return { prisma };
});

import { prisma } from "@/lib/db/prisma";
import { batalkanLulusMassal, tandaiLulusMassal } from "@/lib/students/lulus";
import { POST } from "@/app/api/admin-sekolah/siswa/lulus-massal/route";
import { GET as daftarSiswaRoute } from "@/app/api/admin-sekolah/siswa/route";
import { KuotaPenuhError } from "@/lib/students/create";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const siswa = (n: number, lain: Partial<Siswa> = {}): Siswa => ({
  id: ID(n),
  schoolId: "sch-1",
  jalur: "A",
  deletedAt: null,
  lulusAt: null,
  ...lain,
});
const kursi = (n: number, studentId: string, source: Kursi["source"] = "school_seat", revokedAt: Date | null = null): Kursi => ({
  id: `k${n}`,
  studentId,
  source,
  revokedAt,
});
const SEKARANG = new Date("2026-06-30T05:00:00Z");
const db = prisma as unknown as Parameters<typeof tandaiLulusMassal>[0];

beforeEach(() => {
  vi.resetAllMocks();
  h.siswa.length = 0;
  h.kursi.length = 0;
  h.pernahTransaksi = 0;
  h.requireRole.mockResolvedValue({ id: "adm-1", role: "admin_sekolah" });
  h.resolveSchoolId.mockResolvedValue("sch-1");
  h.assertKuota.mockResolvedValue(undefined);
  h.kuotaAcuan.mockResolvedValue(null);
  h.hitungTerdaftar.mockResolvedValue(0);
});

describe("tandaiLulusMassal", () => {
  it("menandai siswa aktif lulus dan mencabut kursi sekolahnya, tanpa menyentuh langganan pribadi", async () => {
    h.siswa.push(siswa(1), siswa(2));
    h.kursi.push(kursi(1, ID(1)), kursi(2, ID(1), "invoice"), kursi(3, ID(2)));
    const hasil = await tandaiLulusMassal(db, [ID(1)], SEKARANG);

    expect(hasil).toEqual({ ditandai: [ID(1)], dilewati: 0 });
    expect(daftarSiswa()[0]!.lulusAt).toEqual(SEKARANG);
    expect(daftarSiswa()[1]!.lulusAt).toBeNull();
    expect(daftarKursi().find((k) => k.id === "k1")!.revokedAt).toEqual(SEKARANG);
    expect(daftarKursi().find((k) => k.id === "k2")!.revokedAt).toBeNull(); // langganan pribadi aman
    expect(daftarKursi().find((k) => k.id === "k3")!.revokedAt).toBeNull(); // siswa lain aman
  });

  it("siswa yang sudah lulus atau sudah dihapus dilewati dan tidak menimpa waktu lulus aslinya", async () => {
    const dulu = new Date("2026-01-01T00:00:00Z");
    h.siswa.push(siswa(1, { lulusAt: dulu }), siswa(2, { deletedAt: new Date() }), siswa(3));
    const hasil = await tandaiLulusMassal(db, [ID(1), ID(2), ID(3)], SEKARANG);
    expect(hasil).toEqual({ ditandai: [ID(3)], dilewati: 2 });
    expect(daftarSiswa()[0]!.lulusAt).toEqual(dulu);
    expect(daftarSiswa()[1]!.lulusAt).toBeNull();
  });

  it("daftar kosong: tidak membuka transaksi", async () => {
    expect(await tandaiLulusMassal(db, [])).toEqual({ ditandai: [], dilewati: 0 });
    expect(h.pernahTransaksi).toBe(0);
  });
});

describe("batalkanLulusMassal", () => {
  it("mengembalikan alumni ke siswa aktif tanpa membuat kursi (kursi dibuat otomatis saat ujian berikutnya)", async () => {
    h.siswa.push(siswa(1, { lulusAt: SEKARANG }), siswa(2));
    h.kursi.push(kursi(1, ID(1), "school_seat", SEKARANG));
    const hasil = await batalkanLulusMassal(db, [ID(1), ID(2)]);
    expect(hasil).toEqual({ dipulihkan: [ID(1)], dilewati: 1 });
    expect(daftarSiswa()[0]!.lulusAt).toBeNull();
    expect(daftarKursi()[0]!.revokedAt).toEqual(SEKARANG); // tetap dicabut; dihidupkan lazy oleh grantSchoolSeatIfAvailable
  });
});

describe("POST /api/admin-sekolah/siswa/lulus-massal", () => {
  const req = (body: unknown) =>
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("403 kalau bukan admin", async () => {
    h.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await POST(req({ ids: [ID(1)], lulus: true }))).status).toBe(403);
  });

  it.each([
    ["bukan JSON", "bukan json"],
    ["tanpa lulus", { ids: [ID(1)] }],
    ["ids kosong", { ids: [], lulus: true }],
    ["ID bukan UUID", { ids: ["x"], lulus: true }],
    ["lebih dari 200 ID", { ids: Array.from({ length: 201 }, (_, i) => ID(i + 1)), lulus: true }],
  ])("400 kalau %s", async (_nama, body) => {
    expect((await POST(req(body))).status).toBe(400);
    expect(h.pernahTransaksi).toBe(0);
  });

  it("tandai lulus: hanya yang baru ditandai yang diaudit; Jalur B, dihapus, dan sekolah lain tidak diproses", async () => {
    h.siswa.push(
      siswa(1),
      siswa(2, { lulusAt: new Date("2026-01-01T00:00:00Z") }), // sudah lulus -> dilewati
      siswa(3, { jalur: "B" }), // siswa mandiri -> tidak ditemukan
      siswa(4, { deletedAt: new Date() }), // dihapus -> tidak ditemukan
      siswa(5, { schoolId: "sch-lain" }), // sekolah lain -> tidak ditemukan
    );
    h.kursi.push(kursi(1, ID(1)));
    const res = await POST(req({ ids: [ID(1), ID(2), ID(3), ID(4), ID(5)], lulus: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ditandai: 1, dilewati: 1, tidakDitemukan: 3 });
    expect(daftarSiswa().find((s) => s.id === ID(3))!.lulusAt).toBeNull();
    expect(daftarSiswa().find((s) => s.id === ID(5))!.lulusAt).toBeNull();
    expect(daftarKursi()[0]!.revokedAt).not.toBeNull();
    expect(h.logAudit).toHaveBeenCalledTimes(1);
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ aksi: "update", entitas: "students", entitasId: ID(1), before: { lulusAt: null } }),
    );
  });

  it("batalkan lulus: kuota dicek per sekolah sebelum mengubah apa pun; ditolak 409 bila tidak cukup", async () => {
    h.siswa.push(siswa(1, { lulusAt: SEKARANG }), siswa(2, { lulusAt: SEKARANG }));
    h.assertKuota.mockRejectedValue(new KuotaPenuhError("Kuota siswa sekolah tidak mencukupi."));
    const res = await POST(req({ ids: [ID(1), ID(2)], lulus: false }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/tidak mencukupi/);
    expect(h.assertKuota).toHaveBeenCalledWith("sch-1", 2);
    expect(daftarSiswa().every((s) => s.lulusAt !== null)).toBe(true); // tidak ada yang dipulihkan
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("batalkan lulus berhasil bila kuota cukup, diaudit per siswa yang dipulihkan", async () => {
    h.siswa.push(siswa(1, { lulusAt: SEKARANG }), siswa(2));
    const res = await POST(req({ ids: [ID(1), ID(2)], lulus: false }));
    expect(await res.json()).toEqual({ dipulihkan: 1, dilewati: 1, tidakDitemukan: 0 });
    expect(daftarSiswa()[0]!.lulusAt).toBeNull();
    expect(h.assertKuota).toHaveBeenCalledWith("sch-1", 1); // hanya alumni yang memakan kursi lagi
    expect(h.logAudit).toHaveBeenCalledTimes(1);
  });

  it("admin pusat: pembatalan ditolak bila melewati kuota periode, tetapi tidak diblokir saat langganan berakhir", async () => {
    h.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
    h.siswa.push(siswa(1, { lulusAt: SEKARANG }), siswa(2, { lulusAt: SEKARANG }));

    h.kuotaAcuan.mockResolvedValue(10);
    h.hitungTerdaftar.mockResolvedValue(9); // 9 + 2 > 10
    expect((await POST(req({ ids: [ID(1), ID(2)], lulus: false }))).status).toBe(409);
    expect(h.assertKuota).not.toHaveBeenCalled();

    h.kuotaAcuan.mockResolvedValue(null); // langganan berakhir: tidak ada kuota yang berlaku, admin pusat tetap boleh
    expect((await POST(req({ ids: [ID(1), ID(2)], lulus: false }))).status).toBe(200);
  });
});

describe("GET /api/admin-sekolah/siswa - tab Aktif dan Alumni", () => {
  const get = (qs = "") => daftarSiswaRoute(new Request(`http://localhost/api/admin-sekolah/siswa${qs}`));

  beforeEach(() => {
    h.siswa.push(
      siswa(1),
      siswa(2),
      siswa(3, { lulusAt: SEKARANG }),
      siswa(4, { jalur: "B" }),
      siswa(5, { deletedAt: new Date() }),
    );
  });

  it("bawaan: hanya siswa aktif (belum lulus) Jalur A, dengan jumlah kedua tab", async () => {
    const json = await (await get()).json();
    expect(json.students.map((s: Siswa) => s.id).sort()).toEqual([ID(1), ID(2)]);
    expect(json.jumlah).toEqual({ aktif: 2, alumni: 1 });
  });

  it("?status=alumni: hanya alumni; siswa mandiri dan yang dihapus tidak pernah muncul", async () => {
    const json = await (await get("?status=alumni")).json();
    expect(json.students.map((s: Siswa) => s.id)).toEqual([ID(3)]);
    expect(json.jumlah).toEqual({ aktif: 2, alumni: 1 });
  });

  it("nilai status yang aneh jatuh ke tab aktif", async () => {
    const json = await (await get("?status=apa-saja")).json();
    expect(json.students).toHaveLength(2);
  });
});
