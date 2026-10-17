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
    schoolFindUnique: vi.fn(),
    userFindUnique: vi.fn(),
    userCreate: vi.fn(),
    schoolUserCreate: vi.fn(),
    transaction: vi.fn(),
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    logAudit: vi.fn(),
    kirimEmailAkunBaru: vi.fn(),
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    school: { findUnique: m.schoolFindUnique },
    user: { findUnique: m.userFindUnique, create: m.userCreate },
    schoolUser: { create: m.schoolUserCreate },
    $transaction: m.transaction,
  },
}));
vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
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
// Hanya pengiriman yang ditiru; fungsi murni (konteksDinas, dst.) tetap yang asli.
vi.mock("@/lib/email/akun-baru", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/email/akun-baru")>()), kirimEmailAkunBaru: m.kirimEmailAkunBaru }));

import { POST as adminSekolahPOST } from "@/app/api/admin-pusat/school-admins/route";
import { POST as dinasPOST } from "@/app/api/admin-pusat/dinas-admins/route";
import { POST as sekolahPOST } from "@/app/api/admin-pusat/schools/route";

const SEKOLAH_ID = "11111111-1111-4111-8111-111111111111";
const json = (body: unknown) =>
  new Request("http://localhost:3100/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const isi = async (res: Response) => (await res.json()) as Record<string, unknown>;
const HASIL_OK = { tujuan: "budi@sekolah.sch.id", terkirim: true, lewat: "resend" as const };

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
  m.transaction.mockImplementation(async (arg: unknown) => (typeof arg === "function" ? arg(m.tx) : Promise.all(arg as Promise<unknown>[])));
  m.userFindUnique.mockResolvedValue(null);
  m.createUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
  m.deleteUser.mockResolvedValue({});
  m.kirimEmailAkunBaru.mockResolvedValue(HASIL_OK);
  m.userCreate.mockResolvedValue({ id: "auth-1", email: "budi@sekolah.sch.id" });
  m.schoolUserCreate.mockResolvedValue({});
});

describe("POST /api/admin-pusat/school-admins - email detail login", () => {
  beforeEach(() => {
    m.schoolFindUnique.mockResolvedValue({ id: SEKOLAH_ID, nama: "SD Negeri 1 Uji" });
  });
  const kirim = (tambahan: Record<string, unknown> = {}) =>
    adminSekolahPOST(json({ schoolId: SEKOLAH_ID, email: "Budi@Sekolah.sch.id", nama: "Pak Budi", ...tambahan }));

  it("akun jadi: email dikirim DENGAN password yang sama yang ditampilkan di layar; respons memuat hasil email", async () => {
    const res = await kirim();
    expect(res.status).toBe(201);
    const badan = await isi(res);
    expect(badan.tempPassword).toBe("Sementara#1");
    expect(badan.emailLogin).toEqual(HASIL_OK);
    expect(m.kirimEmailAkunBaru).toHaveBeenCalledTimes(1);
    expect(m.kirimEmailAkunBaru).toHaveBeenCalledWith({
      peran: "admin_sekolah",
      nama: "Pak Budi",
      email: "budi@sekolah.sch.id", // dinormalkan huruf kecil
      passwordSementara: "Sementara#1",
      konteks: "SD Negeri 1 Uji",
      asal: "http://localhost:3100",
    });
  });

  it("kirimEmail=false: tidak ada email, emailLogin null, akun tetap jadi dan password tetap dikembalikan", async () => {
    const res = await kirim({ kirimEmail: false });
    expect(res.status).toBe(201);
    expect(m.kirimEmailAkunBaru).not.toHaveBeenCalled();
    expect(await isi(res)).toMatchObject({ tempPassword: "Sementara#1", emailLogin: null });
  });

  it("email gagal terkirim: akun TETAP jadi (201), password dikembalikan, alasan gagal diteruskan ke layar", async () => {
    m.kirimEmailAkunBaru.mockResolvedValue({ tujuan: "budi@sekolah.sch.id", terkirim: false, alasan: "Kuota email Resend sedang habis, cadangan Gmail/SMTP belum diatur." });
    const res = await kirim();
    expect(res.status).toBe(201);
    expect(await isi(res)).toMatchObject({ tempPassword: "Sementara#1", emailLogin: { terkirim: false, alasan: expect.stringContaining("Kuota email Resend") } });
  });

  it("email dikirim SESUDAH akun tersimpan dan tercatat di audit (bukan sebelum)", async () => {
    const urutan: string[] = [];
    m.createUser.mockImplementation(async () => (urutan.push("auth"), { data: { user: { id: "auth-1" } }, error: null }));
    m.logAudit.mockImplementation(async () => void urutan.push("audit"));
    m.kirimEmailAkunBaru.mockImplementation(async () => (urutan.push("email"), HASIL_OK));
    await kirim();
    expect(urutan).toEqual(["auth", "audit", "email"]);
  });

  it.each([
    ["email sudah dipakai (409)", () => m.userFindUnique.mockResolvedValue({ id: "ada" }), 409],
    ["sekolah tidak ditemukan (404)", () => m.schoolFindUnique.mockResolvedValue(null), 404],
    ["gagal membuat akun login (502)", () => m.createUser.mockResolvedValue({ data: { user: null }, error: { message: "boom" } }), 502],
  ])("%s: tidak ada email yang dikirim", async (_nama, atur, status) => {
    atur();
    const res = await kirim();
    expect(res.status).toBe(status);
    expect(m.kirimEmailAkunBaru).not.toHaveBeenCalled();
  });

  it("data tidak sah (400) atau kirimEmail bukan boolean: ditolak, tanpa email", async () => {
    expect((await adminSekolahPOST(json({ schoolId: SEKOLAH_ID, email: "bukan-email", nama: "Pak Budi" }))).status).toBe(400);
    expect((await kirim({ kirimEmail: "ya" })).status).toBe(400);
    expect(m.kirimEmailAkunBaru).not.toHaveBeenCalled();
  });

  it("bukan admin pusat: 403, tanpa email", async () => {
    m.requireRole.mockRejectedValue(new Error("x"));
    expect((await kirim()).status).toBe(403);
    expect(m.kirimEmailAkunBaru).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin-pusat/dinas-admins - email detail login", () => {
  const kirim = (tambahan: Record<string, unknown> = {}) =>
    dinasPOST(json({ email: "kadis@malang.go.id", nama: "Ibu Sari", instansi: "Dinas Pendidikan Kota Malang", kabupatenKota: "Kota Malang", ...tambahan }));

  it("email dikirim dengan peran dinas, konteks 'instansi (kota/kabupaten)', dan password yang sama", async () => {
    const res = await kirim();
    expect(res.status).toBe(201);
    const badan = await isi(res);
    expect(badan.tempPassword).toBe("Sementara#1");
    expect(badan.emailLogin).toEqual(HASIL_OK);
    expect(m.kirimEmailAkunBaru).toHaveBeenCalledWith({
      peran: "dinas_pendidikan",
      nama: "Ibu Sari",
      email: "kadis@malang.go.id",
      passwordSementara: "Sementara#1",
      konteks: "Dinas Pendidikan Kota Malang", // wilayah sudah ada di nama instansi: tidak diulang
      asal: "http://localhost:3100",
    });
  });

  it("dinas provinsi (tanpa kota/kabupaten): wilayahnya ditambahkan bila nama instansi tidak menyebutnya", async () => {
    await dinasPOST(json({ email: "kadis@bali.go.id", nama: "Pak Made", instansi: "Dinas Pendidikan dan Kebudayaan", provinsi: "Bali" }));
    expect(m.kirimEmailAkunBaru.mock.calls[0]![0]).toMatchObject({ konteks: "Dinas Pendidikan dan Kebudayaan (Bali)" });
  });

  it("kirimEmail=false: tidak dikirim; email gagal: akun tetap jadi dan alasan diteruskan", async () => {
    const mati = await kirim({ kirimEmail: false });
    expect(mati.status).toBe(201);
    expect(m.kirimEmailAkunBaru).not.toHaveBeenCalled();
    expect((await isi(mati)).emailLogin).toBeNull();

    m.kirimEmailAkunBaru.mockResolvedValue({ tujuan: "kadis@malang.go.id", terkirim: false, alasan: "Resend/Mailketing gagal (resend-401)." });
    const gagal = await kirim();
    expect(gagal.status).toBe(201);
    expect(await isi(gagal)).toMatchObject({ tempPassword: "Sementara#1", emailLogin: { terkirim: false } });
  });

  it("akun gagal disimpan di database (login yang terlanjur dibuat dihapus): tidak ada email", async () => {
    m.transaction.mockRejectedValue(new Error("db mati"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await kirim();
    expect(res.status).toBe(502);
    expect(m.deleteUser).toHaveBeenCalledWith("auth-1");
    expect(m.kirimEmailAkunBaru).not.toHaveBeenCalled();
  });

  it("email sudah dipakai (409): tidak ada email", async () => {
    m.userFindUnique.mockResolvedValue({ id: "ada" });
    expect((await kirim()).status).toBe(409);
    expect(m.kirimEmailAkunBaru).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin-pusat/schools (sekolah + akun admin) - email detail login", () => {
  beforeEach(() => {
    m.schoolFindUnique.mockResolvedValue(null); // kode sekolah unik
    m.tx.school.create.mockResolvedValue({ id: "s-baru" });
    m.tx.school.findUniqueOrThrow.mockResolvedValue({ id: "s-baru", nama: "SD Negeri 1 Uji", kodeSekolah: "KODE12" });
  });
  const kirim = (tambahan: Record<string, unknown> = {}) =>
    sekolahPOST(json({ nama: "SD Negeri 1 Uji", jenjang: "SD", adminEmail: "budi@sekolah.sch.id", adminNama: "Pak Budi", ...tambahan }));

  it("sekolah + admin dibuat: respons memuat tempPassword {email,password} DAN emailLogin; email memakai nama sekolah", async () => {
    const res = await kirim();
    expect(res.status).toBe(201);
    const badan = await isi(res);
    expect(badan.tempPassword).toEqual({ email: "budi@sekolah.sch.id", password: "Sementara#1" });
    expect(badan.emailLogin).toEqual(HASIL_OK);
    expect(m.kirimEmailAkunBaru).toHaveBeenCalledWith({
      peran: "admin_sekolah",
      nama: "Pak Budi",
      email: "budi@sekolah.sch.id",
      passwordSementara: "Sementara#1",
      konteks: "SD Negeri 1 Uji",
      asal: "http://localhost:3100",
    });
  });

  it("tanpa nama admin: sapaan dikosongkan (diganti sapaan netral oleh pembuat email)", async () => {
    await kirim({ adminNama: undefined });
    expect(m.kirimEmailAkunBaru.mock.calls[0]![0]).toMatchObject({ nama: "" });
  });

  it("sekolah tanpa akun admin: tidak ada email, emailLogin null", async () => {
    const res = await sekolahPOST(json({ nama: "SD Negeri 1 Uji", jenjang: "SD" }));
    expect(res.status).toBe(201);
    expect(m.kirimEmailAkunBaru).not.toHaveBeenCalled();
    expect(await isi(res)).toMatchObject({ tempPassword: null, emailLogin: null });
  });

  it("kirimEmail=false: tidak ada email walau akun admin dibuat", async () => {
    const res = await kirim({ kirimEmail: false });
    expect(res.status).toBe(201);
    expect(m.kirimEmailAkunBaru).not.toHaveBeenCalled();
    expect(await isi(res)).toMatchObject({ tempPassword: { password: "Sementara#1" }, emailLogin: null });
  });

  it("sekolah gagal disimpan (transaksi gagal): login admin dihapus lagi dan TIDAK ada email terkirim ke alamat itu", async () => {
    m.tx.school.create.mockRejectedValue(new Error("db mati"));
    await expect(kirim()).rejects.toThrow("db mati");
    expect(m.deleteUser).toHaveBeenCalledWith("auth-1");
    expect(m.kirimEmailAkunBaru).not.toHaveBeenCalled();
  });

  it("email gagal terkirim: sekolah dan akun tetap jadi, alasan diteruskan", async () => {
    m.kirimEmailAkunBaru.mockResolvedValue({ tujuan: "budi@sekolah.sch.id", terkirim: false, alasan: "Kuota email Resend sedang habis, cadangan Gmail/SMTP belum diatur." });
    const res = await kirim();
    expect(res.status).toBe(201);
    expect(await isi(res)).toMatchObject({ emailLogin: { terkirim: false } });
  });
});
