import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getOwnerScope: vi.fn(),
  assertOwnsPackage: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  queryRaw: vi.fn(),
  validateBlueprint: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/packages/scope", () => ({ getOwnerScope: m.getOwnerScope, assertOwnsPackage: m.assertOwnsPackage }));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn(), getClientIp: () => "127.0.0.1" }));
vi.mock("@/lib/blueprint/validate", () => ({
  validateBlueprintCompliance: m.validateBlueprint,
  formatBlueprintGapMessage: () => "",
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    package: { create: m.create, update: m.update, findUnique: m.findUnique, findFirst: m.findFirst, findMany: m.findMany },
    $queryRaw: m.queryRaw,
  },
}));

import { GET as DAFTAR, POST } from "@/app/api/packages/route";
import { PATCH } from "@/app/api/packages/[id]/route";
import { POST as PUBLISH } from "@/app/api/packages/[id]/publish/route";
import { GET as URUTAN } from "@/app/api/packages/urutan-seri/route";

const MAPEL = "11111111-1111-4111-8111-111111111111";
const MAPEL_LAIN = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";

const json = (url: string, method: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const dasar = { subjectId: MAPEL, nama: "Paket Uji", jenjang: "SMP", durasiMenit: 90, jumlahSoal: 30 };
const params = { params: Promise.resolve({ id: ID }) };

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "admin-1", role: "admin_pusat" });
  m.getOwnerScope.mockResolvedValue({ ownerType: "pusat", ownerId: "admin-1" });
  m.assertOwnsPackage.mockResolvedValue(true);
  m.findFirst.mockResolvedValue(null); // tidak ada paket lain dengan urutan itu
  m.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: ID, ...data }));
  m.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: ID, ...data }));
});

describe("POST /api/packages - urutan seri WAJIB untuk Try Out Mandiri pusat dan tidak boleh kembar", () => {
  const buat = (extra: Record<string, unknown>) => POST(json("/api/packages", "POST", { ...dasar, ...extra }));

  it("Mandiri tanpa urutan -> 400 URUTAN_SERI_WAJIB, paket tidak dibuat", async () => {
    const res = await buat({ kategori: "mandiri" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("URUTAN_SERI_WAJIB");
    expect(body.error).toContain("Urutan seri wajib diisi");
    expect(m.create).not.toHaveBeenCalled();
  });

  it("kategori tidak dikirim (bawaan Mandiri) tanpa urutan -> 400", async () => {
    expect((await buat({})).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("urutan dikirim kosong ('') -> 400", async () => {
    expect((await buat({ kategori: "mandiri", urutanSeri: "" })).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("urutan yang belum dipakai -> 201 dan tersimpan", async () => {
    const res = await buat({ kategori: "mandiri", urutanSeri: 5 });
    expect(res.status).toBe(201);
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.create.mock.calls[0]![0].data.urutanSeri).toBe(5);
  });

  it("urutan yang SUDAH dipakai paket lain di mapel itu -> 409 URUTAN_SERI_BENTROK, paket tidak dibuat", async () => {
    m.findFirst.mockResolvedValue({ id: "paket-lain" });
    const res = await buat({ kategori: "mandiri", urutanSeri: 3 });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("URUTAN_SERI_BENTROK");
    expect(m.create).not.toHaveBeenCalled();
    // pemeriksaan memakai mapel & kategori mandiri, tanpa paket diarsipkan
    expect(m.findFirst.mock.calls[0]![0].where).toMatchObject({
      subjectId: MAPEL,
      jenjang: "SMP",
      kategori: "mandiri",
      urutanSeri: 3,
      status: { not: "archived" },
    });
  });

  it("pemeriksaan kembar memakai jenjang paket: nomor yang sama di jenjang SD diperiksa di lingkup SD, bukan SMP", async () => {
    const res = await buat({ kategori: "mandiri", jenjang: "SD", urutanSeri: 1 });
    expect(res.status).toBe(201);
    expect(m.findFirst.mock.calls[0]![0].where).toMatchObject({ subjectId: MAPEL, jenjang: "SD", urutanSeri: 1 });
  });

  it("dua permintaan serentak: indeks unik menolak yang kedua (P2002) -> 409 yang jelas, bukan 500", async () => {
    m.create.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    const res = await buat({ kategori: "mandiri", urutanSeri: 5 });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("URUTAN_SERI_BENTROK");
    expect(body.error).toContain("baru saja dipakai paket lain");
  });

  it("galat database lain tetap dilempar (bukan disamarkan jadi 409)", async () => {
    m.create.mockRejectedValueOnce(new Error("koneksi putus"));
    await expect(buat({ kategori: "mandiri", urutanSeri: 5 })).rejects.toThrow("koneksi putus");
  });

  it("Try Out Nasional tidak berseri: tanpa urutan lolos, urutan yang dikirim diabaikan (null)", async () => {
    expect((await buat({ kategori: "nasional" })).status).toBe(201);
    expect(m.create.mock.calls[0]![0].data.urutanSeri).toBeNull();
    m.create.mockClear();
    expect((await buat({ kategori: "nasional", urutanSeri: 3 })).status).toBe(201);
    expect(m.create.mock.calls[0]![0].data.urutanSeri).toBeNull();
  });

  it("paket milik SEKOLAH tidak diwajibkan berurutan", async () => {
    m.getOwnerScope.mockResolvedValue({ ownerType: "sekolah", ownerId: "sekolah-1" });
    m.requireRole.mockResolvedValue({ id: "admin-s", role: "admin_sekolah" });
    expect((await buat({ kategori: "mandiri" })).status).toBe(201);
    expect(m.create.mock.calls[0]![0].data.urutanSeri).toBeNull();
  });
});

describe("PATCH /api/packages/[id] - diperiksa terhadap keadaan AKHIR paket", () => {
  const sebelum = (extra: Record<string, unknown> = {}) => ({
    id: ID,
    subjectId: MAPEL,
    jenjang: "SMP",
    ownerType: "pusat",
    kategori: "mandiri",
    urutanSeri: null,
    status: "published",
    bukaMulai: null,
    bukaSelesai: null,
    ...extra,
  });
  const ubah = (body: Record<string, unknown>) => PATCH(json(`/api/packages/${ID}`, "PATCH", body), params);

  it("paket lama tanpa urutan: mengubah nama saja ditolak sampai urutan diisi", async () => {
    m.findUnique.mockResolvedValue(sebelum());
    const res = await ubah({ nama: "Nama Baru" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("URUTAN_SERI_WAJIB");
    expect(m.update).not.toHaveBeenCalled();
  });

  it("paket lama tanpa urutan: diisi urutan yang kosong -> berhasil dan tersimpan", async () => {
    m.findUnique.mockResolvedValue(sebelum());
    const res = await ubah({ nama: "Nama Baru", urutanSeri: 7 });
    expect(res.status).toBe(200);
    expect(m.update.mock.calls[0]![0].data.urutanSeri).toBe(7);
  });

  it("paket yang sudah punya urutan: mengubah nama saja lolos (urutan tersimpan tetap dipakai, paket sendiri dikecualikan)", async () => {
    m.findUnique.mockResolvedValue(sebelum({ urutanSeri: 3 }));
    const res = await ubah({ nama: "Nama Baru" });
    expect(res.status).toBe(200);
    expect(m.findFirst.mock.calls[0]![0].where).toMatchObject({ urutanSeri: 3, id: { not: ID } });
    expect(m.update.mock.calls[0]![0].data).not.toHaveProperty("urutanSeri");
  });

  it("dua permintaan serentak: P2002 pada update -> 409 yang jelas", async () => {
    m.findUnique.mockResolvedValue(sebelum({ urutanSeri: 3 }));
    m.update.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    const res = await ubah({ urutanSeri: 9 });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("URUTAN_SERI_BENTROK");
  });

  it("mengosongkan urutan ('') pada Mandiri pusat ditolak", async () => {
    m.findUnique.mockResolvedValue(sebelum({ urutanSeri: 3 }));
    const res = await ubah({ urutanSeri: "" });
    expect(res.status).toBe(400);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("memakai urutan yang sudah dipakai paket lain -> 409", async () => {
    m.findUnique.mockResolvedValue(sebelum({ urutanSeri: 3 }));
    m.findFirst.mockResolvedValue({ id: "paket-lain" });
    const res = await ubah({ urutanSeri: 2 });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("URUTAN_SERI_BENTROK");
    expect(m.update).not.toHaveBeenCalled();
  });

  it("pindah ke mapel lain yang nomornya sudah dipakai -> 409 (diperiksa di mapel BARU)", async () => {
    m.findUnique.mockResolvedValue(sebelum({ urutanSeri: 3 }));
    m.findFirst.mockResolvedValue({ id: "paket-lain" });
    const res = await ubah({ subjectId: MAPEL_LAIN });
    expect(res.status).toBe(409);
    expect(m.findFirst.mock.calls[0]![0].where).toMatchObject({ subjectId: MAPEL_LAIN, urutanSeri: 3 });
  });

  it("pindah jenjang: nomor diperiksa di lingkup jenjang BARU (SD) - bukan jenjang lama", async () => {
    m.findUnique.mockResolvedValue(sebelum({ urutanSeri: 3 }));
    expect((await ubah({ jenjang: "SD" })).status).toBe(200);
    expect(m.findFirst.mock.calls[0]![0].where).toMatchObject({ subjectId: MAPEL, jenjang: "SD", urutanSeri: 3 });
  });

  it("diganti ke Nasional: urutan dikosongkan dan lolos", async () => {
    m.findUnique.mockResolvedValue(sebelum({ urutanSeri: 3 }));
    const res = await ubah({ kategori: "nasional" });
    expect(res.status).toBe(200);
    expect(m.update.mock.calls[0]![0].data.urutanSeri).toBeNull();
  });

  it("paket yang sudah diarsipkan tidak diperiksa", async () => {
    m.findUnique.mockResolvedValue(sebelum({ status: "archived" }));
    expect((await ubah({ nama: "Nama Baru" })).status).toBe(200);
  });

  it("paket milik sekolah tidak diwajibkan", async () => {
    m.findUnique.mockResolvedValue(sebelum({ ownerType: "sekolah" }));
    expect((await ubah({ nama: "Nama Baru" })).status).toBe(200);
  });
});

describe("POST /api/packages/[id]/publish - tidak bisa terbit tanpa urutan", () => {
  const paket = (extra: Record<string, unknown> = {}) => ({
    id: ID,
    subjectId: MAPEL,
    jenjang: "SMP",
    ownerType: "pusat",
    kategori: "mandiri",
    urutanSeri: null,
    blueprint: null,
    questions: [],
    ...extra,
  });
  const terbit = () => PUBLISH(json(`/api/packages/${ID}/publish`, "POST"), params);

  it("Mandiri pusat tanpa urutan -> 400, tidak diterbitkan, pesan menunjuk ke Edit paket", async () => {
    m.findUnique.mockResolvedValue(paket());
    const res = await terbit();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("URUTAN_SERI_WAJIB");
    expect(body.error).toContain("Edit paket");
    expect(m.update).not.toHaveBeenCalled();
  });

  it("dengan urutan -> diterbitkan", async () => {
    m.findUnique.mockResolvedValue(paket({ urutanSeri: 4 }));
    expect((await terbit()).status).toBe(200);
    expect(m.update.mock.calls[0]![0].data.status).toBe("published");
  });

  it("urutan kembar dengan paket lain (mis. data lama) -> 409, tidak diterbitkan", async () => {
    m.findUnique.mockResolvedValue(paket({ urutanSeri: 4 }));
    m.findFirst.mockResolvedValue({ id: "paket-lain" });
    const res = await terbit();
    expect(res.status).toBe(409);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("pemeriksaan kembar saat terbit memakai jenjang paket", async () => {
    m.findUnique.mockResolvedValue(paket({ urutanSeri: 4, jenjang: "SD" }));
    expect((await terbit()).status).toBe(200);
    expect(m.findFirst.mock.calls[0]![0].where).toMatchObject({ jenjang: "SD", urutanSeri: 4 });
  });

  it("paket arsip diterbitkan lagi saat nomornya sudah dipakai paket lain: P2002 -> 409", async () => {
    m.findUnique.mockResolvedValue(paket({ urutanSeri: 4 }));
    m.update.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    const res = await terbit();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("URUTAN_SERI_BENTROK");
  });

  it("Nasional dan paket sekolah tetap bisa terbit tanpa urutan", async () => {
    m.findUnique.mockResolvedValue(paket({ kategori: "nasional" }));
    expect((await terbit()).status).toBe(200);
    m.findUnique.mockResolvedValue(paket({ ownerType: "sekolah" }));
    expect((await terbit()).status).toBe(200);
  });
});

describe("GET /api/packages/urutan-seri - nomor terpakai untuk form (per mapel dan jenjang)", () => {
  const ambil = (qs: string) => URUTAN(new Request(`http://localhost/api/packages/urutan-seri?${qs}`));

  it("mengembalikan nomor unik terurut dan nomor kosong berikutnya (lintas pemilik)", async () => {
    m.findMany.mockResolvedValue([{ urutanSeri: 4 }, { urutanSeri: 1 }, { urutanSeri: 2 }, { urutanSeri: 2 }]);
    const res = await ambil(`subjectId=${MAPEL}&jenjang=SMP`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ terpakai: [1, 2, 4], berikutnya: 5 });
    expect(m.findMany.mock.calls[0]![0].where).toMatchObject({
      subjectId: MAPEL,
      jenjang: "SMP",
      kategori: "mandiri",
      urutanSeri: { not: null },
      status: { not: "archived" },
    });
    // lintas pemilik: tidak ada filter ownerType/ownerId
    expect(m.findMany.mock.calls[0]![0].where).not.toHaveProperty("ownerId");
  });

  it("jenjang menentukan lingkup: SD dan SMP dibaca terpisah (nomor yang sama boleh ada di keduanya)", async () => {
    m.findMany.mockResolvedValue([]);
    await ambil(`subjectId=${MAPEL}&jenjang=SD`);
    expect(m.findMany.mock.calls[0]![0].where.jenjang).toBe("SD");
    await ambil(`subjectId=${MAPEL}&jenjang=SMP`);
    expect(m.findMany.mock.calls[1]![0].where.jenjang).toBe("SMP");
  });

  it("mapel belum punya paket berseri: kosong, berikutnya 1", async () => {
    m.findMany.mockResolvedValue([]);
    expect(await (await ambil(`subjectId=${MAPEL}&jenjang=SMP`)).json()).toEqual({ terpakai: [], berikutnya: 1 });
  });

  it("exclude = paket yang sedang diedit tidak dihitung", async () => {
    m.findMany.mockResolvedValue([]);
    await ambil(`subjectId=${MAPEL}&jenjang=SMP&exclude=${ID}`);
    expect(m.findMany.mock.calls[0]![0].where).toMatchObject({ id: { not: ID } });
  });

  it("subjectId atau jenjang tidak valid/kosong -> 400; bukan admin -> 403", async () => {
    expect((await ambil("subjectId=bukan-uuid&jenjang=SMP")).status).toBe(400);
    expect((await ambil(`subjectId=${MAPEL}`)).status).toBe(400);
    expect((await ambil(`subjectId=${MAPEL}&jenjang=SMA`)).status).toBe(400);
    expect((await ambil("")).status).toBe(400);
    m.requireRole.mockRejectedValue(new Error("x"));
    expect((await ambil(`subjectId=${MAPEL}&jenjang=SMP`)).status).toBe(403);
  });
});

describe("GET /api/packages - jumlah siswa yang sudah menyelesaikan paket berseri (untuk panel posisi urutan)", () => {
  const paketBerseri = (id: string, urutan: number | null, kategori = "mandiri") => ({
    id,
    kategori,
    urutanSeri: urutan,
    subject: { id: MAPEL, nama: "Matematika" },
  });

  it("mengembalikan siswaSelesai per paket berseri dari satu query agregat", async () => {
    m.findMany.mockResolvedValue([paketBerseri("p1", 1), paketBerseri("p2", 2), paketBerseri("p3", null), paketBerseri("n1", null, "nasional")]);
    m.queryRaw.mockResolvedValue([{ package_id: "p1", siswa: 12n }, { package_id: "p2", siswa: 3 }]);
    const res = await DAFTAR();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.siswaSelesai).toEqual({ p1: 12, p2: 3 });
    expect(body.packages).toHaveLength(4);
    expect(m.queryRaw).toHaveBeenCalledTimes(1);
    // hanya id paket berseri yang dikirim ke query (p3 tanpa urutan dan Nasional tidak ikut)
    const nilai = (m.queryRaw.mock.calls[0]![0] as { values: unknown[] }).values.flat();
    expect(nilai).toEqual(["p1", "p2"]);
  });

  it("tanpa paket berseri: tidak ada query agregat sama sekali", async () => {
    m.findMany.mockResolvedValue([paketBerseri("p3", null)]);
    const body = await (await DAFTAR()).json();
    expect(body.siswaSelesai).toEqual({});
    expect(m.queryRaw).not.toHaveBeenCalled();
  });

  it("query agregat gagal: daftar paket tetap tampil, siswaSelesai null (angka disembunyikan, bukan 0)", async () => {
    const galat = vi.spyOn(console, "error").mockImplementation(() => undefined);
    m.findMany.mockResolvedValue([paketBerseri("p1", 1)]);
    m.queryRaw.mockRejectedValue(new Error("db putus"));
    const res = await DAFTAR();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.siswaSelesai).toBeNull();
    expect(body.packages).toHaveLength(1);
    galat.mockRestore();
  });
});

