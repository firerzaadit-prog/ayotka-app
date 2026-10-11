import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  schoolFindUnique: vi.fn(),
  userCreate: vi.fn(),
  studentCreate: vi.fn(),
  partnerCreate: vi.fn(),
  transaksi: vi.fn(),
  generateLink: vi.fn(),
  updateUserById: vi.fn(),
  deleteUser: vi.fn(),
  kirimEmail: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findFirst: m.userFindFirst, findUnique: m.userFindUnique, create: m.userCreate },
    school: { findUnique: m.schoolFindUnique },
    partner: { create: m.partnerCreate },
    $transaction: m.transaksi,
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { generateLink: m.generateLink, updateUserById: m.updateUserById, deleteUser: m.deleteUser } },
  }),
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.audit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => true }));
vi.mock("@/lib/students/create", () => ({ generateUniqueStudentReferralCode: async () => "REFSISWA1" }));
vi.mock("@/lib/partners/create", () => ({ generateUniqueReferralCode: async () => "REFMITRA1" }));
vi.mock("@/lib/registrasi/referral", () => ({ resolveKodeReferral: vi.fn() }));
vi.mock("@/lib/billing/vouchers", () => ({ activateVoucher: vi.fn(), VoucherSudahDipakaiError: class extends Error {} }));
// Pesan layar memakai fungsi aslinya; hanya pengiriman yang ditiru.
vi.mock("@/lib/email/konfirmasi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/konfirmasi")>()),
  kirimEmailKonfirmasi: m.kirimEmail,
}));

import { POST as daftarMandiri } from "@/app/api/registrasi/mandiri/route";
import { POST as daftarMitra } from "@/app/api/registrasi/mitra/route";

const post = (url: string, body: unknown) =>
  new Request(`https://localhost:3001${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const SISWA = { nama: "Budi", email: "Budi@Example.com", password: "rahasia123", jenjang: "SMP", asalSekolahId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" };
const MITRA = { nama: "Toko Buku", email: "mitra@example.com", password: "rahasia123" };
const PESAN_DASAR =
  'Akunmu sudah dibuat, tapi email konfirmasi belum berhasil terkirim. Klik "Kirim ulang email konfirmasi" di bawah untuk mencoba lagi.';

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.userFindFirst.mockResolvedValue(null);
  m.userFindUnique.mockResolvedValue(null);
  m.schoolFindUnique.mockResolvedValue({ id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" });
  m.generateLink.mockResolvedValue({
    data: { user: { id: "auth-1" }, properties: { hashed_token: "hash123" } },
    error: null,
  });
  m.updateUserById.mockResolvedValue({ error: null });
  m.deleteUser.mockResolvedValue({});
  m.studentCreate.mockResolvedValue({ id: "siswa-1" });
  m.userCreate.mockResolvedValue({});
  m.partnerCreate.mockResolvedValue({});
  m.transaksi.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)({ user: { create: m.userCreate }, student: { create: m.studentCreate } })
      : Promise.all(arg as unknown[]),
  );
  m.kirimEmail.mockResolvedValue({ ok: true, lewat: "resend" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("pendaftaran siswa mandiri: email konfirmasi", () => {
  it("berhasil: akun dibuat, email konfirmasi (jenis signup, token dari GoTrue) dikirim ke email yang dinormalisasi, layar diberi tahu", async () => {
    const res = await daftarMandiri(post("/api/registrasi/mandiri", SISWA));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, emailTerkirim: true });
    expect(m.generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: "signup", email: "budi@example.com" }));
    expect(m.updateUserById).toHaveBeenCalledWith("auth-1", { app_metadata: { role: "siswa" } });
    expect(m.kirimEmail).toHaveBeenCalledWith({ email: "budi@example.com", nama: "Budi", tokenHash: "hash123", type: "signup", peran: "siswa" });
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  it("email GAGAL terkirim: akun TETAP ada (tidak dihapus), layar mendapat pesan + kode penyebab, status 200", async () => {
    m.kirimEmail.mockResolvedValue({ ok: false, error: "Resend API error 401", kuotaHabis: false, kode: "resend-401 + mailketing-nonaktif" });
    const res = await daftarMandiri(post("/api/registrasi/mandiri", SISWA));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      emailTerkirim: false,
      pesan: `${PESAN_DASAR} (Kode: resend-401 + mailketing-nonaktif)`,
    });
    expect(m.deleteUser).not.toHaveBeenCalled();
    expect(m.userCreate).toHaveBeenCalledTimes(1);
    expect(m.studentCreate).toHaveBeenCalledTimes(1);
  });

  it("kuota email habis: pesan khusus 'sangat ramai' + kode 'resend-kuota'; akun tetap ada", async () => {
    m.kirimEmail.mockResolvedValue({ ok: false, error: "quota", kuotaHabis: true, kode: "resend-kuota" });
    const body = await (await daftarMandiri(post("/api/registrasi/mandiri", SISWA))).json();
    expect(body.emailTerkirim).toBe(false);
    expect(body.pesan).toMatch(/sangat ramai/);
    expect(body.pesan).toMatch(/\(Kode: resend-kuota\)$/);
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  it("log server memuat kode dan galat penyedia, TANPA token konfirmasi, kata sandi, atau alamat email pendaftar", async () => {
    m.kirimEmail.mockResolvedValue({ ok: false, error: "Resend API error 403", kuotaHabis: false, kode: "resend-403" });
    await daftarMandiri(post("/api/registrasi/mandiri", SISWA));
    const log = vi.mocked(console.error).mock.calls.map((c) => c.map(String).join(" ")).join(" | ");
    expect(log).toContain("[resend-403]");
    for (const rahasia of ["hash123", "rahasia123", "budi@example.com"]) expect(log).not.toContain(rahasia);
  });

  it("gagal menyimpan ke database SEBELUM email: akun auth dibersihkan (email bisa dipakai daftar ulang) dan email TIDAK dikirim", async () => {
    m.transaksi.mockRejectedValue(new Error("db down"));
    const res = await daftarMandiri(post("/api/registrasi/mandiri", SISWA));
    expect(res.status).toBe(502);
    expect(m.deleteUser).toHaveBeenCalledWith("auth-1");
    expect(m.kirimEmail).not.toHaveBeenCalled();
  });

  it("email sudah dipakai akun lain: 409 sebelum membuat apa pun", async () => {
    m.userFindFirst.mockResolvedValue({ id: "ada" });
    const res = await daftarMandiri(post("/api/registrasi/mandiri", SISWA));
    expect(res.status).toBe(409);
    expect(m.generateLink).not.toHaveBeenCalled();
    expect(m.kirimEmail).not.toHaveBeenCalled();
  });

  it("generateLink mengembalikan akun LAMA milik pendaftar sebelumnya: 409, akun lama tidak disentuh dan tidak dikirimi email", async () => {
    m.userFindUnique.mockResolvedValue({ id: "auth-1" });
    const res = await daftarMandiri(post("/api/registrasi/mandiri", SISWA));
    expect(res.status).toBe(409);
    expect(m.deleteUser).not.toHaveBeenCalled();
    expect(m.updateUserById).not.toHaveBeenCalled();
    expect(m.kirimEmail).not.toHaveBeenCalled();
  });

  it("GoTrue menolak membuat akun: 502, tidak ada email", async () => {
    m.generateLink.mockResolvedValue({ data: { user: null, properties: null }, error: { message: "boom" } });
    const res = await daftarMandiri(post("/api/registrasi/mandiri", SISWA));
    expect(res.status).toBe(502);
    expect(m.kirimEmail).not.toHaveBeenCalled();
  });
});

describe("pendaftaran mitra: email konfirmasi", () => {
  it("berhasil: email jenis signup untuk peran mitra", async () => {
    const res = await daftarMitra(post("/api/registrasi/mitra", MITRA));
    expect(await res.json()).toEqual({ ok: true, emailTerkirim: true });
    expect(m.updateUserById).toHaveBeenCalledWith("auth-1", { app_metadata: { role: "mitra" } });
    expect(m.kirimEmail).toHaveBeenCalledWith({ email: "mitra@example.com", nama: "Toko Buku", tokenHash: "hash123", type: "signup", peran: "mitra" });
  });

  it("email gagal: akun mitra tetap ada, pesan + kode ke layar", async () => {
    m.kirimEmail.mockResolvedValue({ ok: false, error: "x", kuotaHabis: false, kode: "resend-jaringan + mailketing-nonaktif" });
    const res = await daftarMitra(post("/api/registrasi/mitra", MITRA));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      emailTerkirim: false,
      pesan: `${PESAN_DASAR} (Kode: resend-jaringan + mailketing-nonaktif)`,
    });
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  it("email sudah dipakai: 409 tanpa membuat akun atau mengirim email", async () => {
    m.userFindFirst.mockResolvedValue({ id: "ada" });
    const res = await daftarMitra(post("/api/registrasi/mitra", MITRA));
    expect(res.status).toBe(409);
    expect(m.generateLink).not.toHaveBeenCalled();
    expect(m.kirimEmail).not.toHaveBeenCalled();
  });
});
