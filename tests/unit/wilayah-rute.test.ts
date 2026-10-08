import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => {
  const tx = {
    school: { create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
    user: { create: vi.fn() },
    schoolUser: { create: vi.fn() },
    dinasAdmin: { create: vi.fn() },
  };
  return {
    tx,
    requireRole: vi.fn(),
    resolveSchoolId: vi.fn(),
    schoolFindUnique: vi.fn(),
    schoolUpdate: vi.fn(),
    userFindUnique: vi.fn(),
    userUpdate: vi.fn(),
    dinasUpsert: vi.fn(),
    transaction: vi.fn(),
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    logAudit: vi.fn(),
    studentUpdateMany: vi.fn(),
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    school: { findUnique: m.schoolFindUnique, update: m.schoolUpdate },
    user: { findUnique: m.userFindUnique, update: m.userUpdate },
    dinasAdmin: { upsert: m.dinasUpsert },
    student: { updateMany: m.studentUpdateMany },
    $transaction: m.transaction,
  },
}));
vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/schools/scope", () => ({ resolveSchoolId: m.resolveSchoolId }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { createUser: m.createUser, deleteUser: m.deleteUser } } }),
}));
vi.mock("@/lib/utils/generate-code", () => ({ generateReadableCode: () => "KODE12", generateTempPassword: () => "Sementara#1" }));
vi.mock("@/lib/billing/periode-sekolah", () => ({
  buatPeriode: vi.fn(),
  pilihPeriodeRujukan: vi.fn(),
  segeraBerakhir: vi.fn(),
  sisaHariWIB: vi.fn(),
  statusPeriode: vi.fn(),
}));

import { POST as sekolahPOST } from "@/app/api/admin-pusat/schools/route";
import { PATCH as sekolahPATCH } from "@/app/api/admin-pusat/schools/[id]/route";
import { POST as pendingPOST } from "@/app/api/admin-pusat/sekolah-pending/[id]/route";
import { GET as profilGET, PATCH as profilPATCH } from "@/app/api/admin-sekolah/profil/route";
import { POST as dinasPOST } from "@/app/api/admin-pusat/dinas-admins/route";
import { PATCH as dinasPATCH } from "@/app/api/admin-pusat/dinas-admins/[id]/route";

const json = (body: unknown, metode = "POST") =>
  new Request("http://localhost/x", { method: metode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const params = (id = "id-1") => ({ params: Promise.resolve({ id }) });
const isi = async (res: Response) => (await res.json()) as Record<string, unknown>;

const DASAR_SEKOLAH = { nama: "SD Negeri 1 Uji", jenjang: "SD" as const };

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
  m.transaction.mockImplementation(async (arg: unknown) => (typeof arg === "function" ? arg(m.tx) : Promise.all(arg as Promise<unknown>[])));
});

describe("POST /api/admin-pusat/schools - wilayah dan status sekolah", () => {
  beforeEach(() => {
    m.schoolFindUnique.mockResolvedValue(null); // kode sekolah unik
    m.tx.school.create.mockResolvedValue({ id: "s-baru" });
    m.tx.school.findUniqueOrThrow.mockResolvedValue({ id: "s-baru", kodeSekolah: "KODE12" });
  });
  const dataDisimpan = () => (m.tx.school.create.mock.calls[0]![0] as { data: Record<string, unknown> }).data;

  it("provinsi + kota/kabupaten + status disimpan", async () => {
    const res = await sekolahPOST(json({ ...DASAR_SEKOLAH, provinsi: "Jawa Barat", kabupatenKota: "Kota Bandung", statusSekolah: "swasta" }));
    expect(res.status).toBe(201);
    expect(dataDisimpan()).toMatchObject({ nama: DASAR_SEKOLAH.nama, jenjang: "SD", provinsi: "Jawa Barat", kabupatenKota: "Kota Bandung", statusSekolah: "swasta", status: "aktif" });
  });

  it("formulir lama (hanya kota/kabupaten Jawa Timur): provinsi dilengkapi otomatis", async () => {
    const res = await sekolahPOST(json({ ...DASAR_SEKOLAH, kabupatenKota: "Kota Malang" }));
    expect(res.status).toBe(201);
    expect(dataDisimpan()).toMatchObject({ provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: null });
  });

  it("tanpa wilayah dan status: tersimpan kosong (null), bukan string kosong", async () => {
    await sekolahPOST(json({ ...DASAR_SEKOLAH, provinsi: "", kabupatenKota: "", statusSekolah: "" }));
    expect(dataDisimpan()).toMatchObject({ provinsi: null, kabupatenKota: null, statusSekolah: null });
  });

  it("hanya provinsi: kota/kabupaten null", async () => {
    await sekolahPOST(json({ ...DASAR_SEKOLAH, provinsi: "Bali" }));
    expect(dataDisimpan()).toMatchObject({ provinsi: "Bali", kabupatenKota: null });
  });

  it.each([
    ["kota/kabupaten bukan bagian provinsi", { provinsi: "Bali", kabupatenKota: "Kota Malang" }],
    ["provinsi tidak dikenal", { provinsi: "Atlantis" }],
    ["kota/kabupaten tidak dikenal", { kabupatenKota: "Kota Atlantis" }],
    ["status sekolah tidak valid", { statusSekolah: "pemerintah" }],
  ])("%s: 400 dan tidak ada yang disimpan", async (_nama, tambahan) => {
    const res = await sekolahPOST(json({ ...DASAR_SEKOLAH, ...tambahan }));
    expect(res.status).toBe(400);
    expect(m.tx.school.create).not.toHaveBeenCalled();
    expect(m.createUser).not.toHaveBeenCalled();
  });

  it("akun admin sekolah TIDAK dibuat bila wilayahnya salah (tidak ada akun yatim)", async () => {
    const res = await sekolahPOST(json({ ...DASAR_SEKOLAH, provinsi: "Bali", kabupatenKota: "Kota Malang", adminEmail: "admin@uji.sch.id" }));
    expect(res.status).toBe(400);
    expect(m.createUser).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin-pusat/schools/[id] - wilayah dan status sekolah", () => {
  const SEBELUM = { id: "id-1", nama: "SD Lama", provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: null };
  beforeEach(() => {
    m.schoolFindUnique.mockResolvedValue(SEBELUM);
    m.schoolUpdate.mockImplementation(async ({ data }: { data: object }) => ({ ...SEBELUM, ...data }));
  });
  const dataDiubah = () => (m.schoolUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;

  it("ganti provinsi + kota/kabupaten + status sekaligus", async () => {
    const res = await sekolahPATCH(json({ provinsi: "Bali", kabupatenKota: "Kota Denpasar", statusSekolah: "negeri" }, "PATCH"), params());
    expect(res.status).toBe(200);
    expect(dataDiubah()).toMatchObject({ provinsi: "Bali", kabupatenKota: "Kota Denpasar", statusSekolah: "negeri" });
  });

  it("klien lama hanya mengirim kota/kabupaten di provinsi lain: provinsi ikut berganti", async () => {
    await sekolahPATCH(json({ kabupatenKota: "Kota Bandung" }, "PATCH"), params());
    expect(dataDiubah()).toMatchObject({ provinsi: "Jawa Barat", kabupatenKota: "Kota Bandung" });
  });

  it("mengganti provinsi tanpa memilih ulang kota/kabupaten: 400, tidak ada yang berubah", async () => {
    const res = await sekolahPATCH(json({ provinsi: "Bali" }, "PATCH"), params());
    expect(res.status).toBe(400);
    expect(((await isi(res)).error as string)).toMatch(/Kota Malang berada di Provinsi Jawa Timur/);
    expect(m.schoolUpdate).not.toHaveBeenCalled();
  });

  it("perubahan yang tidak menyentuh wilayah (mis. alamat) tidak menulis ulang provinsi/kota/status", async () => {
    await sekolahPATCH(json({ alamat: "Jl. Baru 1" }, "PATCH"), params());
    const data = dataDiubah();
    expect(data).toMatchObject({ alamat: "Jl. Baru 1" });
    for (const k of ["provinsi", "kabupatenKota", "statusSekolah"]) expect(data).not.toHaveProperty(k);
  });

  it("mengosongkan kota/kabupaten dan status", async () => {
    await sekolahPATCH(json({ kabupatenKota: "", statusSekolah: "" }, "PATCH"), params());
    expect(dataDiubah()).toMatchObject({ provinsi: "Jawa Timur", kabupatenKota: null, statusSekolah: null });
  });

  it("sekolah tidak ada: 404", async () => {
    m.schoolFindUnique.mockResolvedValue(null);
    expect((await sekolahPATCH(json({ statusSekolah: "negeri" }, "PATCH"), params())).status).toBe(404);
  });

  it("bukan admin pusat: 403", async () => {
    m.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await sekolahPATCH(json({ statusSekolah: "negeri" }, "PATCH"), params())).status).toBe(403);
  });
});

describe("POST /api/admin-pusat/sekolah-pending/[id] approve - wilayah dan status", () => {
  const PENDING = { id: "id-1", nama: "SD Baru", status: "pending_verifikasi", provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: "swasta" };
  beforeEach(() => {
    m.schoolFindUnique.mockResolvedValue(PENDING);
    m.schoolUpdate.mockImplementation(async ({ data }: { data: object }) => ({ ...PENDING, ...data }));
  });
  const dataDiubah = () => (m.schoolUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;

  it("formulir persetujuan dikosongkan: isian siswa saat mendaftar TIDAK terhapus", async () => {
    const res = await pendingPOST(json({ action: "approve", nama: "SD Baru", npsn: "", alamat: "", provinsi: "", kabupatenKota: "", statusSekolah: "" }), params());
    expect(res.status).toBe(200);
    expect(dataDiubah()).toMatchObject({ provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", status: "aktif" });
    expect(dataDiubah()).not.toHaveProperty("statusSekolah");
  });

  it("admin pusat mengoreksi wilayah dan status: isian admin yang dipakai", async () => {
    await pendingPOST(json({ action: "approve", nama: "SD Baru", provinsi: "Bali", kabupatenKota: "Kota Denpasar", statusSekolah: "negeri" }), params());
    expect(dataDiubah()).toMatchObject({ provinsi: "Bali", kabupatenKota: "Kota Denpasar", statusSekolah: "negeri" });
  });

  it("pasangan tidak cocok: 400 dan sekolah tetap pending", async () => {
    const res = await pendingPOST(json({ action: "approve", nama: "SD Baru", provinsi: "Bali", kabupatenKota: "Kota Malang" }), params());
    expect(res.status).toBe(400);
    expect(m.schoolUpdate).not.toHaveBeenCalled();
  });
});

describe("/api/admin-sekolah/profil", () => {
  const SEKOLAH = { id: "sek-1", nama: "SMP Uji", npsn: "12345678", jenjang: "SMP", alamat: null, provinsi: null, kabupatenKota: null, statusSekolah: null };
  beforeEach(() => {
    m.requireRole.mockResolvedValue({ id: "adm-1", role: "admin_sekolah" });
    m.resolveSchoolId.mockResolvedValue("sek-1");
    m.schoolFindUnique.mockResolvedValue(SEKOLAH);
    m.schoolUpdate.mockImplementation(async ({ data }: { data: object }) => ({ ...SEKOLAH, ...data }));
  });
  const dataDiubah = () => (m.schoolUpdate.mock.calls[0]![0] as { where: { id: string }; data: Record<string, unknown> });

  it("GET: profil sekolah sendiri (bukan sekolah lain)", async () => {
    const res = await profilGET();
    expect(res.status).toBe(200);
    expect((await isi(res)).school).toMatchObject({ nama: "SMP Uji", provinsi: null });
    expect(m.schoolFindUnique.mock.calls[0]![0].where).toEqual({ id: "sek-1" });
  });

  it("PATCH: alamat, wilayah, dan status disimpan ke sekolah milik akun, dicatat di audit log", async () => {
    const res = await profilPATCH(json({ alamat: "Jl. Mawar 5", provinsi: "Jawa Tengah", kabupatenKota: "Kota Semarang", statusSekolah: "negeri" }, "PATCH"));
    expect(res.status).toBe(200);
    expect(dataDiubah().where).toEqual({ id: "sek-1" });
    expect(dataDiubah().data).toEqual({ alamat: "Jl. Mawar 5", provinsi: "Jawa Tengah", kabupatenKota: "Kota Semarang", statusSekolah: "negeri" });
    expect(m.logAudit).toHaveBeenCalledWith(expect.objectContaining({ aksi: "update", entitas: "schools", entitasId: "sek-1" }));
  });

  it("PATCH: nama, NPSN, jenjang, status akun tidak bisa diubah lewat rute ini (dibuang oleh skema)", async () => {
    await profilPATCH(json({ nama: "Nama Curang", npsn: "99999999", jenjang: "SD", status: "suspend", seatQuota: 999, statusSekolah: "swasta" }, "PATCH"));
    const data = dataDiubah().data;
    expect(data).toEqual({ statusSekolah: "swasta" });
  });

  it("PATCH: id sekolah di body diabaikan - yang diubah selalu sekolah milik sesi (tidak bisa mengubah sekolah lain)", async () => {
    await profilPATCH(json({ id: "sekolah-lain", schoolId: "sekolah-lain", statusSekolah: "negeri" }, "PATCH"));
    expect(dataDiubah().where).toEqual({ id: "sek-1" });
    expect(m.schoolFindUnique.mock.calls[0]![0].where).toEqual({ id: "sek-1" });
  });

  it("PATCH: alamat dikosongkan jadi null", async () => {
    await profilPATCH(json({ alamat: "" }, "PATCH"));
    expect(dataDiubah().data).toEqual({ alamat: null });
  });

  it.each([
    ["pasangan tidak cocok", { provinsi: "Bali", kabupatenKota: "Kota Malang" }],
    ["status tidak valid", { statusSekolah: "yayasan" }],
    ["alamat terlalu panjang", { alamat: "x".repeat(301) }],
  ])("PATCH %s: 400 dan tidak ada yang tersimpan", async (_nama, body) => {
    expect((await profilPATCH(json(body, "PATCH"))).status).toBe(400);
    expect(m.schoolUpdate).not.toHaveBeenCalled();
  });

  it("akun belum terhubung ke sekolah: 403", async () => {
    m.resolveSchoolId.mockResolvedValue(null);
    expect((await profilGET()).status).toBe(403);
    expect((await profilPATCH(json({ statusSekolah: "negeri" }, "PATCH"))).status).toBe(403);
  });

  it("peran lain (siswa, dinas): 403", async () => {
    m.requireRole.mockRejectedValue(new Error("forbidden"));
    expect((await profilGET()).status).toBe(403);
    expect((await profilPATCH(json({ statusSekolah: "negeri" }, "PATCH"))).status).toBe(403);
  });
});

describe("akun dinas pendidikan - provinsi dan kota/kabupaten", () => {
  const DASAR_DINAS = { email: "dinas@uji.go.id", nama: "Penanggung Jawab", instansi: "Dinas Pendidikan Uji" };
  const dataProfil = () => (m.tx.dinasAdmin.create.mock.calls[0]![0] as { data: Record<string, unknown> }).data;

  describe("POST (buat akun)", () => {
    beforeEach(() => {
      m.userFindUnique.mockResolvedValue(null);
      m.createUser.mockResolvedValue({ data: { user: { id: "u-dinas" } }, error: null });
    });

    it("Dinas Kota/Kabupaten: provinsi + kota/kabupaten", async () => {
      const res = await dinasPOST(json({ ...DASAR_DINAS, provinsi: "Jawa Barat", kabupatenKota: "Kota Bandung" }));
      expect(res.status).toBe(201);
      expect(dataProfil()).toMatchObject({ provinsi: "Jawa Barat", kabupatenKota: "Kota Bandung" });
    });

    it("Dinas Provinsi: hanya provinsi, kota/kabupaten null (semua kota/kabupaten di provinsi itu)", async () => {
      const res = await dinasPOST(json({ ...DASAR_DINAS, provinsi: "Jawa Timur", kabupatenKota: "" }));
      expect(res.status).toBe(201);
      expect(dataProfil()).toMatchObject({ provinsi: "Jawa Timur", kabupatenKota: null });
    });

    it("formulir lama (hanya kota/kabupaten): provinsi dilengkapi", async () => {
      const res = await dinasPOST(json({ ...DASAR_DINAS, kabupatenKota: "Kota Malang" }));
      expect(res.status).toBe(201);
      expect(dataProfil()).toMatchObject({ provinsi: "Jawa Timur", kabupatenKota: "Kota Malang" });
    });

    it.each([
      ["tanpa wilayah sama sekali", {}],
      ["wilayah kosong", { provinsi: "", kabupatenKota: "" }],
      ["pasangan tidak cocok", { provinsi: "Bali", kabupatenKota: "Kota Malang" }],
      ["provinsi tidak dikenal", { provinsi: "Atlantis" }],
    ])("%s: 400 dan akun login TIDAK dibuat", async (_nama, wilayah) => {
      const res = await dinasPOST(json({ ...DASAR_DINAS, ...wilayah }));
      expect(res.status).toBe(400);
      expect(m.createUser).not.toHaveBeenCalled();
    });
  });

  describe("PATCH (ubah wilayah)", () => {
    const profil = (provinsi: string | null, kabupatenKota: string | null) => ({
      id: "id-1",
      role: "dinas_pendidikan",
      status: "aktif",
      dinasProfile: { nama: "PJ", instansi: "Dinas", provinsi, kabupatenKota },
    });
    const dataUpsert = () => m.dinasUpsert.mock.calls[0]![0] as { update: Record<string, unknown>; create: Record<string, unknown> };
    beforeEach(() => {
      m.userFindUnique.mockResolvedValue(profil("Jawa Timur", "Kota Malang"));
      m.userUpdate.mockResolvedValue({ status: "aktif" });
      m.dinasUpsert.mockResolvedValue({});
    });

    it("ubah Dinas Kota menjadi Dinas Provinsi: kirim provinsi yang sama dan kota/kabupaten kosong", async () => {
      const res = await dinasPATCH(json({ provinsi: "Jawa Timur", kabupatenKota: "" }, "PATCH"), params());
      expect(res.status).toBe(200);
      expect(dataUpsert().update).toEqual({ provinsi: "Jawa Timur", kabupatenKota: null });
    });

    it("pindah ke wilayah lain", async () => {
      await dinasPATCH(json({ provinsi: "Bali", kabupatenKota: "Kota Denpasar" }, "PATCH"), params());
      expect(dataUpsert().update).toEqual({ provinsi: "Bali", kabupatenKota: "Kota Denpasar" });
    });

    it("klien lama hanya mengirim kota/kabupaten: provinsi mengikuti", async () => {
      await dinasPATCH(json({ kabupatenKota: "Kota Bandung" }, "PATCH"), params());
      expect(dataUpsert().update).toEqual({ provinsi: "Jawa Barat", kabupatenKota: "Kota Bandung" });
    });

    it("mengganti provinsi tanpa memilih ulang kota/kabupaten: 400 (wilayah dinas tidak berpindah diam-diam)", async () => {
      const res = await dinasPATCH(json({ provinsi: "Bali" }, "PATCH"), params());
      expect(res.status).toBe(400);
      expect(m.dinasUpsert).not.toHaveBeenCalled();
    });

    it("mengosongkan SEMUA wilayah: 400 (akun akan ditolak di semua halaman dinas)", async () => {
      const res = await dinasPATCH(json({ provinsi: "", kabupatenKota: "" }, "PATCH"), params());
      expect(res.status).toBe(400);
      expect(((await isi(res)).error as string)).toMatch(/tidak boleh tanpa wilayah/);
      expect(m.dinasUpsert).not.toHaveBeenCalled();
    });

    it("hanya mengganti status akun: profil dinas tidak disentuh", async () => {
      await dinasPATCH(json({ status: "nonaktif" }, "PATCH"), params());
      expect(m.dinasUpsert).not.toHaveBeenCalled();
    });

    it("akun lama tanpa profil dinas diberi wilayah: profil dibuat dengan wilayah itu (bukan string kosong)", async () => {
      m.userFindUnique.mockResolvedValue({ id: "id-1", role: "dinas_pendidikan", status: "aktif", dinasProfile: null });
      await dinasPATCH(json({ nama: "PJ Baru", instansi: "Dinas Baru", provinsi: "Aceh" }, "PATCH"), params());
      expect(dataUpsert().create).toMatchObject({ userId: "id-1", nama: "PJ Baru", instansi: "Dinas Baru", provinsi: "Aceh", kabupatenKota: null });
    });
  });
});
