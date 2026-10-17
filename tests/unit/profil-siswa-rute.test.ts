import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  studentFindFirst: vi.fn(),
  studentUpdate: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  logAudit: vi.fn(),
  getKeanggotaanSiswa: vi.fn(),
  checkRateLimit: vi.fn(),
  updateUserById: vi.fn(),
  verifikasi: vi.fn(),
  kirimPemberitahuanAkun: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    student: { findFirst: m.studentFindFirst, update: m.studentUpdate },
    user: { findFirst: m.userFindFirst, update: m.userUpdate },
  },
}));
vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/billing/keanggotaan", () => ({ getKeanggotaanSiswa: m.getKeanggotaanSiswa }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.checkRateLimit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ auth: { admin: { updateUserById: m.updateUserById } } }) }));
vi.mock("@/lib/auth/verifikasi-password", () => ({ verifikasiPasswordSaatIni: m.verifikasi }));
// Hanya pengiriman yang ditiru; pembuat isi email tetap yang asli.
vi.mock("@/lib/email/profil", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/profil")>()),
  kirimPemberitahuanAkun: m.kirimPemberitahuanAkun,
}));

import { GET as profilGET, PATCH as profilPATCH } from "@/app/api/siswa/profil/route";
import { POST as passwordPOST } from "@/app/api/siswa/profil/password/route";
import { POST as emailPOST } from "@/app/api/siswa/profil/email/route";

const USER = { id: "user-1", email: "budi@contoh.id", role: "siswa" };
const SISWA_B = {
  id: "siswa-1",
  userId: "user-1",
  nama: "Budi Santoso",
  nisn: null,
  jenjang: "SMP",
  jalur: "B",
  waKontak: null,
  school: { nama: "SMPN 1 Contoh" },
};
const SISWA_A = { ...SISWA_B, jalur: "A", nisn: "0012345678", school: { nama: "SMPN 2 Sekolah" } };
const KEANGGOTAAN = { jenis: "gratis", label: "Member Gratis", berlakuSampai: null };

const req = (url: string, metode: string, body?: unknown) =>
  new Request(`http://localhost:3100${url}`, {
    method: metode,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const isi = async (res: Response) => (await res.json()) as Record<string, unknown>;

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue(USER);
  m.studentFindFirst.mockResolvedValue(SISWA_B);
  m.studentUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...SISWA_B, ...data }));
  m.getKeanggotaanSiswa.mockResolvedValue(KEANGGOTAAN);
  m.checkRateLimit.mockReturnValue(true);
  m.verifikasi.mockResolvedValue("benar");
  m.updateUserById.mockResolvedValue({ error: null });
  m.userFindFirst.mockResolvedValue(null);
  m.userUpdate.mockResolvedValue({});
  m.kirimPemberitahuanAkun.mockResolvedValue({ ok: true, lewat: "resend" });
});

describe("GET /api/siswa/profil", () => {
  it("bukan siswa: 403", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await profilGET()).status).toBe(403);
  });

  it("profil siswa tidak ada: 404", async () => {
    m.studentFindFirst.mockResolvedValue(null);
    expect((await profilGET()).status).toBe(404);
  });

  it("siswa mandiri: nama dan email bisa diubah, email asli ditampilkan, ada keanggotaan", async () => {
    const h = await isi(await profilGET());
    expect(h).toMatchObject({
      nama: "Budi Santoso",
      email: "budi@contoh.id",
      masukDenganNisn: false,
      jalur: "B",
      sekolah: "SMPN 1 Contoh",
      bisaUbahEmail: true,
      keanggotaan: KEANGGOTAAN,
    });
    expect(h).not.toHaveProperty("bisaUbahNama");
  });

  it("siswa sekolah (Jalur A): NISN dan jalur terbaca, nama TIDAK lagi dikunci (tidak ada penanda bisaUbahNama)", async () => {
    m.studentFindFirst.mockResolvedValue(SISWA_A);
    const h = await isi(await profilGET());
    expect(h).toMatchObject({ jalur: "A", nisn: "0012345678", nama: "Budi Santoso" });
    expect(h).not.toHaveProperty("bisaUbahNama");
  });

  it("akun NISN: email sintetis TIDAK dikirim ke layar dan tidak bisa diganti", async () => {
    m.requireRole.mockResolvedValue({ ...USER, email: "0012345678@nisn.ayotka.id" });
    m.studentFindFirst.mockResolvedValue(SISWA_A);
    const res = await profilGET();
    const h = await isi(res);
    expect(h).toMatchObject({ email: null, masukDenganNisn: true, bisaUbahEmail: false });
    expect(JSON.stringify(h)).not.toContain("nisn.ayotka.id");
  });

  it("email kontak: akun NISN melihat statusnya; akun dengan email sungguhan tidak (null walau kolomnya terisi)", async () => {
    m.requireRole.mockResolvedValue({ ...USER, email: "0012345678@nisn.ayotka.id" });
    m.studentFindFirst.mockResolvedValue({ ...SISWA_A, emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: null });
    expect(await isi(await profilGET())).toMatchObject({ emailKontak: { alamat: "ortu@contoh.id", terverifikasi: false } });

    m.studentFindFirst.mockResolvedValue({ ...SISWA_A, emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: new Date() });
    expect(await isi(await profilGET())).toMatchObject({ emailKontak: { alamat: "ortu@contoh.id", terverifikasi: true } });

    m.studentFindFirst.mockResolvedValue({ ...SISWA_A, emailKontak: null, emailKontakVerifiedAt: null });
    expect((await isi(await profilGET())).emailKontak).toBeNull();

    m.requireRole.mockResolvedValue(USER); // email sungguhan
    m.studentFindFirst.mockResolvedValue({ ...SISWA_B, emailKontak: "sisa@contoh.id", emailKontakVerifiedAt: new Date() });
    expect((await isi(await profilGET())).emailKontak).toBeNull();
  });

  it("tidak boleh di-cache", async () => {
    expect((await profilGET()).headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("PATCH /api/siswa/profil", () => {
  const ubah = (body: unknown) => profilPATCH(req("/api/siswa/profil", "PATCH", body));

  it("bukan siswa: 403", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await ubah({ nama: "Budi Baru" })).status).toBe(403);
  });

  it.each([
    ["badan kosong", {}],
    ["nama terlalu pendek", { nama: "B" }],
    ["nama terlalu panjang", { nama: "x".repeat(101) }],
    ["nomor WhatsApp salah", { waKontak: "12345" }],
    ["nomor WhatsApp berisi huruf", { waKontak: "08abc4567890" }],
  ])("data tidak valid (%s): 400 tanpa menyentuh database", async (_nama, body) => {
    const res = await ubah(body);
    expect(res.status).toBe(400);
    expect(m.studentUpdate).not.toHaveBeenCalled();
  });

  it("siswa mandiri mengubah nama: spasi ganda dirapikan, tersimpan, tercatat di audit dengan sebelum/sesudah", async () => {
    const res = await ubah({ nama: "  Budi   Santoso   Putra " });
    expect(res.status).toBe(200);
    expect(m.studentUpdate).toHaveBeenCalledWith({ where: { id: "siswa-1" }, data: { nama: "Budi Santoso Putra" } });
    expect(await isi(res)).toMatchObject({ ok: true, berubah: true, nama: "Budi Santoso Putra" });
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        entitas: "students",
        before: { nama: "Budi Santoso", waKontak: null },
        after: expect.objectContaining({ nama: "Budi Santoso Putra", aksi: "ubah_profil_mandiri" }),
      }),
    );
  });

  it("siswa Jalur A (sekolah) boleh mengganti namanya sendiri: tersimpan dan tercatat di audit dengan nama lama dan baru", async () => {
    m.studentFindFirst.mockResolvedValue(SISWA_A);
    const res = await ubah({ nama: "  Budi   Santoso  Pratama " });
    expect(res.status).toBe(200);
    expect(m.studentUpdate).toHaveBeenCalledWith({ where: { id: "siswa-1" }, data: { nama: "Budi Santoso Pratama" } });
    expect(await isi(res)).toMatchObject({ ok: true, berubah: true, nama: "Budi Santoso Pratama" });
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        before: { nama: "Budi Santoso", waKontak: null },
        after: expect.objectContaining({ nama: "Budi Santoso Pratama", aksi: "ubah_profil_mandiri" }),
      }),
    );
  });

  it("siswa Jalur A: nama kosong atau satu huruf tetap ditolak seperti siswa lain", async () => {
    m.studentFindFirst.mockResolvedValue(SISWA_A);
    expect((await ubah({ nama: "   " })).status).toBe(400);
    expect((await ubah({ nama: "B" })).status).toBe(400);
    expect(m.studentUpdate).not.toHaveBeenCalled();
  });

  it("siswa Jalur A mengirim nama yang SAMA (formulir selalu mengirim) + nomor WA baru: nomor tersimpan, nama tidak disentuh", async () => {
    m.studentFindFirst.mockResolvedValue(SISWA_A);
    const res = await ubah({ nama: "Budi Santoso", waKontak: "081234567890" });
    expect(res.status).toBe(200);
    expect(m.studentUpdate).toHaveBeenCalledWith({ where: { id: "siswa-1" }, data: { waKontak: "081234567890" } });
  });

  it.each([
    ["+62 812-3456-7890", "081234567890"],
    ["6281234567890", "081234567890"],
    ["(0812) 3456 7890", "081234567890"],
    ["0812.3456.7890", "081234567890"],
  ])("nomor WhatsApp '%s' disimpan seragam sebagai %s", async (masuk, tersimpan) => {
    await ubah({ waKontak: masuk });
    expect(m.studentUpdate).toHaveBeenCalledWith({ where: { id: "siswa-1" }, data: { waKontak: tersimpan } });
  });

  it("nomor WhatsApp dikosongkan: disimpan null (nomor dihapus)", async () => {
    m.studentFindFirst.mockResolvedValue({ ...SISWA_B, waKontak: "081234567890" });
    await ubah({ waKontak: "" });
    expect(m.studentUpdate).toHaveBeenCalledWith({ where: { id: "siswa-1" }, data: { waKontak: null } });
  });

  it("tanpa perubahan nyata: tidak menulis database maupun audit", async () => {
    const res = await ubah({ nama: "Budi Santoso", waKontak: "" });
    expect(res.status).toBe(200);
    expect(await isi(res)).toMatchObject({ ok: true, berubah: false });
    expect(m.studentUpdate).not.toHaveBeenCalled();
    expect(m.logAudit).not.toHaveBeenCalled();
  });
});

describe("POST /api/siswa/profil/password", () => {
  const ganti = (body: unknown) => passwordPOST(req("/api/siswa/profil/password", "POST", body));
  const SAH = { passwordLama: "PasswordLama#1", passwordBaru: "PasswordBaru#2", konfirmasi: "PasswordBaru#2" };

  it("bukan siswa: 403", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await ganti(SAH)).status).toBe(403);
  });

  it("terlalu banyak percobaan: 429 dan password tidak diperiksa", async () => {
    m.checkRateLimit.mockReturnValue(false);
    const res = await ganti(SAH);
    expect(res.status).toBe(429);
    expect(m.verifikasi).not.toHaveBeenCalled();
    expect(m.checkRateLimit).toHaveBeenCalledWith("profil-password:user-1", expect.any(Number), expect.any(Number));
  });

  it.each([
    ["konfirmasi tidak cocok", { ...SAH, konfirmasi: "Lain#123456" }, "Konfirmasi password tidak cocok"],
    ["password baru terlalu pendek", { ...SAH, passwordBaru: "pendek", konfirmasi: "pendek" }, "minimal 8"],
    ["password baru terlalu panjang", { ...SAH, passwordBaru: "x".repeat(73), konfirmasi: "x".repeat(73) }, "maksimal 72"],
    ["sama dengan yang lama", { passwordLama: "SamaSaja#12", passwordBaru: "SamaSaja#12", konfirmasi: "SamaSaja#12" }, "berbeda"],
    ["password saat ini kosong", { ...SAH, passwordLama: "" }, "wajib"],
  ])("%s: 400 dengan pesan jelas, tanpa memeriksa ke layanan login", async (_nama, body, pesan) => {
    const res = await ganti(body);
    expect(res.status).toBe(400);
    expect(String((await isi(res)).error)).toContain(pesan);
    expect(m.verifikasi).not.toHaveBeenCalled();
    expect(m.updateUserById).not.toHaveBeenCalled();
  });

  it("password saat ini salah: 400 dan password TIDAK diubah", async () => {
    m.verifikasi.mockResolvedValue("salah");
    const res = await ganti(SAH);
    expect(res.status).toBe(400);
    expect((await isi(res)).error).toBe("Password saat ini salah.");
    expect(m.updateUserById).not.toHaveBeenCalled();
    expect(m.kirimPemberitahuanAkun).not.toHaveBeenCalled();
  });

  it("layanan login membatasi laju: 429 (bukan 'salah password')", async () => {
    m.verifikasi.mockResolvedValue("dibatasi");
    const res = await ganti(SAH);
    expect(res.status).toBe(429);
    expect(m.updateUserById).not.toHaveBeenCalled();
  });

  it("layanan login bermasalah: 503 yang menegaskan password belum berubah", async () => {
    m.verifikasi.mockResolvedValue("layanan");
    const res = await ganti(SAH);
    expect(res.status).toBe(503);
    expect(String((await isi(res)).error)).toContain("belum bisa diubah");
    expect(m.updateUserById).not.toHaveBeenCalled();
  });

  it("memeriksa password lama terhadap email akun yang SEDANG login (bukan email dari permintaan)", async () => {
    await ganti({ ...SAH, email: "orang-lain@contoh.id" });
    expect(m.verifikasi).toHaveBeenCalledWith("budi@contoh.id", "PasswordLama#1");
  });

  it("berhasil: hanya password yang dikirim ke layanan login (data akun lain tidak ditimpa), audit tanpa password, email pemberitahuan terkirim", async () => {
    const res = await ganti(SAH);
    expect(res.status).toBe(200);
    expect(await isi(res)).toEqual({ ok: true, pemberitahuan: true });
    expect(m.updateUserById).toHaveBeenCalledTimes(1);
    expect(m.updateUserById).toHaveBeenCalledWith("user-1", { password: "PasswordBaru#2" });

    expect(m.logAudit).toHaveBeenCalledTimes(1);
    const audit = JSON.stringify(m.logAudit.mock.calls[0]);
    expect(audit).toContain("ganti_password_mandiri");
    expect(audit).not.toContain("PasswordBaru#2");
    expect(audit).not.toContain("PasswordLama#1");

    expect(m.kirimPemberitahuanAkun).toHaveBeenCalledTimes(1);
    const [tujuan, isiEmail] = m.kirimPemberitahuanAkun.mock.calls[0]!;
    expect(tujuan).toBe("budi@contoh.id");
    expect(isiEmail.subject).toBe("Password akun AyoTKA kamu diubah");
    expect(isiEmail.html).not.toContain("PasswordBaru#2");
    expect(isiEmail.html).not.toContain("PasswordLama#1");
  });

  it("gagal kirim email pemberitahuan: password tetap berubah, hasil melaporkan pemberitahuan=false", async () => {
    m.kirimPemberitahuanAkun.mockResolvedValue({ ok: false, error: "x", kuotaHabis: false, kode: "x" });
    const res = await ganti(SAH);
    expect(res.status).toBe(200);
    expect(await isi(res)).toEqual({ ok: true, pemberitahuan: false });
  });

  it("akun NISN (email sintetis): password berubah tetapi tidak ada email ke alamat sintetis", async () => {
    m.requireRole.mockResolvedValue({ ...USER, email: "0012345678@nisn.ayotka.id" });
    const res = await ganti(SAH);
    expect(res.status).toBe(200);
    expect(await isi(res)).toEqual({ ok: true, pemberitahuan: null });
    expect(m.kirimPemberitahuanAkun).not.toHaveBeenCalled();
    expect(m.verifikasi).toHaveBeenCalledWith("0012345678@nisn.ayotka.id", "PasswordLama#1");
  });

  it("akun NISN dengan email kontak TERVERIFIKASI: pemberitahuan dikirim ke email kontak, dengan NISN tersamar (bukan NISN utuh atau email sintetis)", async () => {
    m.requireRole.mockResolvedValue({ ...USER, email: "0012345678@nisn.ayotka.id" });
    m.studentFindFirst.mockResolvedValue({ ...SISWA_A, emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: new Date("2026-10-10T00:00:00Z") });
    const res = await ganti(SAH);
    expect(res.status).toBe(200);
    expect(await isi(res)).toEqual({ ok: true, pemberitahuan: true });
    expect(m.kirimPemberitahuanAkun).toHaveBeenCalledTimes(1);
    const [tujuan, isiEmail] = m.kirimPemberitahuanAkun.mock.calls[0]!;
    expect(tujuan).toBe("ortu@contoh.id");
    expect(isiEmail.subject).toBe("Password akun AyoTKA kamu diubah");
    expect(isiEmail.html).toContain("NISN ******5678");
    expect(isiEmail.html).not.toContain("0012345678");
    expect(isiEmail.html).not.toContain("nisn.ayotka.id");
    expect(isiEmail.html).not.toContain("PasswordBaru#2");
  });

  it("akun NISN dengan email kontak yang BELUM terverifikasi: tidak ada pemberitahuan (alamat belum terbukti milik siswa)", async () => {
    m.requireRole.mockResolvedValue({ ...USER, email: "0012345678@nisn.ayotka.id" });
    m.studentFindFirst.mockResolvedValue({ ...SISWA_A, emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: null });
    const res = await ganti(SAH);
    expect(res.status).toBe(200);
    expect(await isi(res)).toEqual({ ok: true, pemberitahuan: null });
    expect(m.kirimPemberitahuanAkun).not.toHaveBeenCalled();
  });

  it("layanan login menolak menyimpan: 502, tanpa audit dan tanpa email", async () => {
    m.updateUserById.mockResolvedValue({ error: { message: "boom" } });
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await ganti(SAH);
    expect(res.status).toBe(502);
    expect(m.logAudit).not.toHaveBeenCalled();
    expect(m.kirimPemberitahuanAkun).not.toHaveBeenCalled();
    galat.mockRestore();
  });
});

describe("POST /api/siswa/profil/email", () => {
  const ganti = (body: unknown) => emailPOST(req("/api/siswa/profil/email", "POST", body));
  const SAH = { emailBaru: "Budi.Baru@Contoh.id", password: "PasswordLama#1" };

  it("bukan siswa: 403", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await ganti(SAH)).status).toBe(403);
  });

  it("akun NISN: 403 dengan penjelasan, tanpa pemeriksaan apa pun", async () => {
    m.requireRole.mockResolvedValue({ ...USER, email: "0012345678@nisn.ayotka.id" });
    const res = await ganti(SAH);
    expect(res.status).toBe(403);
    expect(String((await isi(res)).error)).toContain("NISN");
    expect(m.verifikasi).not.toHaveBeenCalled();
    expect(m.updateUserById).not.toHaveBeenCalled();
  });

  it("terlalu banyak percobaan: 429", async () => {
    m.checkRateLimit.mockReturnValue(false);
    expect((await ganti(SAH)).status).toBe(429);
    expect(m.checkRateLimit).toHaveBeenCalledWith("profil-email:user-1", expect.any(Number), expect.any(Number));
  });

  it.each([
    ["email tidak valid", { ...SAH, emailBaru: "bukan-email" }, "Email tidak valid"],
    ["password kosong", { ...SAH, password: "" }, "wajib"],
    ["email sama (beda huruf besar/kecil)", { ...SAH, emailBaru: "BUDI@contoh.id" }, "sama dengan email saat ini"],
  ])("%s: 400 tanpa memeriksa password atau menyentuh akun", async (_nama, body, pesan) => {
    const res = await ganti(body);
    expect(res.status).toBe(400);
    expect(String((await isi(res)).error)).toContain(pesan);
    expect(m.verifikasi).not.toHaveBeenCalled();
    expect(m.updateUserById).not.toHaveBeenCalled();
  });

  it("password salah: 400, dan keberadaan email baru TIDAK diungkapkan (belum ada pencarian email)", async () => {
    m.verifikasi.mockResolvedValue("salah");
    const res = await ganti(SAH);
    expect(res.status).toBe(400);
    expect((await isi(res)).error).toBe("Password saat ini salah.");
    expect(m.userFindFirst).not.toHaveBeenCalled();
    expect(m.updateUserById).not.toHaveBeenCalled();
  });

  it("layanan login membatasi / bermasalah: 429 / 503 tanpa perubahan", async () => {
    m.verifikasi.mockResolvedValue("dibatasi");
    expect((await ganti(SAH)).status).toBe(429);
    m.verifikasi.mockResolvedValue("layanan");
    expect((await ganti(SAH)).status).toBe(503);
    expect(m.updateUserById).not.toHaveBeenCalled();
  });

  it("email sudah dipakai akun lain: 409 (pencarian tanpa peduli huruf besar/kecil dan mengecualikan akun sendiri)", async () => {
    m.userFindFirst.mockResolvedValue({ id: "user-lain" });
    const res = await ganti(SAH);
    expect(res.status).toBe(409);
    expect(m.userFindFirst).toHaveBeenCalledWith({
      where: { email: { equals: "budi.baru@contoh.id", mode: "insensitive" }, NOT: { id: "user-1" } },
      select: { id: true },
    });
    expect(m.updateUserById).not.toHaveBeenCalled();
  });

  it("layanan login menjawab email sudah terdaftar: 409, tabel kita tidak diubah", async () => {
    m.updateUserById.mockResolvedValue({ error: { code: "email_exists", message: "A user with this email address has already been registered" } });
    const res = await ganti(SAH);
    expect(res.status).toBe(409);
    expect(m.userUpdate).not.toHaveBeenCalled();
  });

  it("galat lain dari layanan login: 502 tanpa mengubah tabel kita", async () => {
    m.updateUserById.mockResolvedValue({ error: { message: "boom" } });
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await ganti(SAH)).status).toBe(502);
    expect(m.userUpdate).not.toHaveBeenCalled();
    galat.mockRestore();
  });

  it("berhasil: email huruf kecil disimpan di layanan login lalu di tabel kita, audit sebelum/sesudah, dua email pemberitahuan", async () => {
    const res = await ganti(SAH);
    expect(res.status).toBe(200);
    expect(await isi(res)).toEqual({ ok: true, email: "budi.baru@contoh.id", pemberitahuan: { lama: true, baru: true } });

    expect(m.verifikasi).toHaveBeenCalledWith("budi@contoh.id", "PasswordLama#1");
    expect(m.updateUserById).toHaveBeenCalledWith("user-1", { email: "budi.baru@contoh.id", email_confirm: true });
    expect(m.userUpdate).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { email: "budi.baru@contoh.id" } });
    // urutan: layanan login dulu, baru tabel kita
    expect(m.updateUserById.mock.invocationCallOrder[0]).toBeLessThan(m.userUpdate.mock.invocationCallOrder[0]!);

    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entitas: "users",
        before: { email: "budi@contoh.id" },
        after: { email: "budi.baru@contoh.id", aksi: "ganti_email_mandiri" },
      }),
    );
    expect(JSON.stringify(m.logAudit.mock.calls)).not.toContain("PasswordLama#1");

    const tujuan = m.kirimPemberitahuanAkun.mock.calls.map((c) => c[0]).sort();
    expect(tujuan).toEqual(["budi.baru@contoh.id", "budi@contoh.id"]);
    const keLama = m.kirimPemberitahuanAkun.mock.calls.find((c) => c[0] === "budi@contoh.id")![1];
    expect(keLama.subject).toBe("Email akun AyoTKA kamu diganti");
    expect(keLama.html).toContain("budi@contoh.id");
    expect(keLama.html).toContain("budi.baru@contoh.id");
    const keBaru = m.kirimPemberitahuanAkun.mock.calls.find((c) => c[0] === "budi.baru@contoh.id")![1];
    expect(keBaru.subject).toBe("Email baru akun AyoTKA kamu sudah aktif");
  });

  it("satu email pemberitahuan gagal: perubahan tetap berlaku dan hasil menunjukkan yang mana", async () => {
    m.kirimPemberitahuanAkun.mockImplementation(async (tujuan: string) =>
      tujuan === "budi.baru@contoh.id" ? { ok: false, error: "x", kuotaHabis: false, kode: "x" } : { ok: true, lewat: "resend" },
    );
    const res = await ganti(SAH);
    expect(res.status).toBe(200);
    expect(await isi(res)).toMatchObject({ pemberitahuan: { lama: true, baru: false } });
  });

  it("tabel kita menolak karena email sama sudah dipakai (balapan): email di layanan login DIKEMBALIKAN, 409", async () => {
    m.userUpdate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unik", { code: "P2002", clientVersion: "test" }));
    const res = await ganti(SAH);
    expect(res.status).toBe(409);
    expect(m.updateUserById).toHaveBeenCalledTimes(2);
    expect(m.updateUserById).toHaveBeenNthCalledWith(2, "user-1", { email: "budi@contoh.id", email_confirm: true });
    expect(m.kirimPemberitahuanAkun).not.toHaveBeenCalled();
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("galat database lain: email di layanan login dikembalikan, 502", async () => {
    m.userUpdate.mockRejectedValue(new Error("koneksi putus"));
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await ganti(SAH);
    expect(res.status).toBe(502);
    expect(m.updateUserById).toHaveBeenNthCalledWith(2, "user-1", { email: "budi@contoh.id", email_confirm: true });
    galat.mockRestore();
  });

  it("gagal mengembalikan email pun tidak melempar (tercatat di log)", async () => {
    m.userUpdate.mockRejectedValue(new Error("koneksi putus"));
    m.updateUserById.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "tak bisa kembali" } });
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await ganti(SAH);
    expect(res.status).toBe(502);
    expect(galat.mock.calls.some((c) => String(c[0]).includes("GAGAL mengembalikan"))).toBe(true);
    galat.mockRestore();
  });
});
