import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  studentFindFirst: vi.fn(),
  studentUpdate: vi.fn(),
  studentUpdateMany: vi.fn(),
  logAudit: vi.fn(),
  checkRateLimit: vi.fn(),
  verifikasi: vi.fn(),
  kirim: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { student: { findFirst: m.studentFindFirst, update: m.studentUpdate, updateMany: m.studentUpdateMany } },
}));
vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.checkRateLimit }));
vi.mock("@/lib/auth/verifikasi-password", () => ({ verifikasiPasswordSaatIni: m.verifikasi }));
// Hanya pengiriman yang ditiru; pembuat isi email tetap yang asli (supaya tautan di dalamnya bisa diperiksa).
vi.mock("@/lib/email/profil", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/profil")>()),
  kirimPemberitahuanAkun: m.kirim,
}));

import { POST as kontakPOST } from "@/app/api/siswa/profil/email-kontak/route";
import { POST as verifikasiPOST } from "@/app/api/auth/verifikasi-email-kontak/route";
import { buatTokenEmailKontak } from "@/lib/siswa/email-kontak";

const ID = "3f9c2a64-1b7e-4c58-9d0a-5e2b8f7a1c34";
const USER_NISN = { id: "user-1", email: "3155213156@nisn.ayotka.id", role: "siswa" };
const SISWA = {
  id: ID,
  userId: "user-1",
  nama: "Budi Santoso",
  nisn: "3155213156",
  emailKontak: null as string | null,
  emailKontakVerifiedAt: null as Date | null,
};

const req = (url: string, body?: unknown) =>
  new Request(`http://localhost:3100${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const isi = async (res: Response) => (await res.json()) as Record<string, unknown>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ENCRYPTION_KEY", "kunci-uji-aplikasi");
  m.requireRole.mockResolvedValue(USER_NISN);
  m.studentFindFirst.mockResolvedValue({ ...SISWA });
  m.studentUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...SISWA, ...data }));
  m.studentUpdateMany.mockResolvedValue({ count: 1 });
  m.checkRateLimit.mockReturnValue(true);
  m.verifikasi.mockResolvedValue("benar");
  m.kirim.mockResolvedValue({ ok: true, lewat: "resend" });
});

describe("POST /api/siswa/profil/email-kontak", () => {
  const kontak = (body: unknown) => kontakPOST(req("/api/siswa/profil/email-kontak", body));
  const SIMPAN = { aksi: "simpan", email: "ortu@contoh.id", password: "PasswordSaya#1" };

  it("bukan siswa: 403", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await kontak(SIMPAN)).status).toBe(403);
  });

  it("akun dengan email sungguhan (bukan NISN): 403, tidak menyentuh database", async () => {
    m.requireRole.mockResolvedValue({ ...USER_NISN, email: "budi@contoh.id" });
    const res = await kontak(SIMPAN);
    expect(res.status).toBe(403);
    expect(m.studentFindFirst).not.toHaveBeenCalled();
    expect(m.studentUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["badan kosong", undefined],
    ["aksi tidak dikenal", { aksi: "ganti" }],
    ["simpan tanpa email", { aksi: "simpan", password: "x" }],
    ["simpan email tidak sah", { aksi: "simpan", email: "bukan-email", password: "x" }],
    ["simpan alamat internal", { aksi: "simpan", email: "3155213156@nisn.ayotka.id", password: "x" }],
    ["simpan tanpa password", { aksi: "simpan", email: "a@b.id" }],
    ["hapus tanpa password", { aksi: "hapus" }],
  ])("data tidak valid (%s): 400 tanpa menyentuh database atau mengirim email", async (_nama, body) => {
    const res = await kontak(body);
    expect(res.status).toBe(400);
    expect(m.studentUpdate).not.toHaveBeenCalled();
    expect(m.kirim).not.toHaveBeenCalled();
  });

  it("terlalu banyak percobaan: 429; simpan/hapus dan kirim ulang dihitung terpisah dengan batas berbeda", async () => {
    m.checkRateLimit.mockReturnValue(false);
    expect((await kontak(SIMPAN)).status).toBe(429);
    expect(m.checkRateLimit).toHaveBeenLastCalledWith("profil-email-kontak:user-1", 5, 15 * 60_000);
    expect((await kontak({ aksi: "kirim_ulang" })).status).toBe(429);
    expect(m.checkRateLimit).toHaveBeenLastCalledWith("profil-email-kontak-ulang:user-1", 3, 15 * 60_000);
    expect(m.verifikasi).not.toHaveBeenCalled();
    expect(m.studentUpdate).not.toHaveBeenCalled();
  });

  it("profil siswa tidak ada: 404", async () => {
    m.studentFindFirst.mockResolvedValue(null);
    expect((await kontak(SIMPAN)).status).toBe(404);
  });

  describe("simpan", () => {
    it.each([
      ["salah", 400, "Password saat ini salah."],
      ["dibatasi", 429, "Sistem sedang ramai"],
      ["layanan", 503, "Layanan masuk sedang gangguan"],
    ])("password %s: %i dan tidak ada yang berubah", async (hasil, status, teks) => {
      m.verifikasi.mockResolvedValue(hasil);
      const res = await kontak(SIMPAN);
      expect(res.status).toBe(status);
      expect(String((await isi(res)).error)).toContain(teks);
      expect(m.studentUpdate).not.toHaveBeenCalled();
      expect(m.kirim).not.toHaveBeenCalled();
      // Password diperiksa terhadap email login sintetis akun itu.
      expect(m.verifikasi).toHaveBeenCalledWith("3155213156@nisn.ayotka.id", "PasswordSaya#1");
    });

    it("pasang baru: tersimpan BELUM terverifikasi, tercatat di audit, email verifikasi dengan tautan bertanda tangan terkirim", async () => {
      const res = await kontak(SIMPAN);
      expect(res.status).toBe(200);
      expect(m.studentUpdate).toHaveBeenCalledWith({ where: { id: ID }, data: { emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: null } });
      expect(await isi(res)).toMatchObject({ ok: true, emailKontak: { alamat: "ortu@contoh.id", terverifikasi: false }, pengiriman: true });
      expect(m.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          entitas: "students",
          before: { emailKontak: null, terverifikasi: false },
          after: { emailKontak: "ortu@contoh.id", terverifikasi: false, aksi: "pasang_email_kontak" },
        }),
      );
      // satu email: verifikasi ke alamat BARU, dengan NISN tersamar dan tautan yang token-nya sah untuk (siswa, alamat) itu
      expect(m.kirim).toHaveBeenCalledTimes(1);
      const [tujuan, isiEmail] = m.kirim.mock.calls[0] as [string, { subject: string; html: string }];
      expect(tujuan).toBe("ortu@contoh.id");
      expect(isiEmail.subject).toBe("Verifikasi email kontak akun AyoTKA kamu");
      expect(isiEmail.html).toContain("NISN ******3156");
      expect(isiEmail.html).not.toContain("3155213156");
      const tautan = /href="(http:\/\/localhost:3100\/verifikasi-email-kontak\?token=[^"]+)"/.exec(isiEmail.html);
      expect(tautan).not.toBeNull();
      const token = decodeURIComponent(new URL(tautan![1]!.replaceAll("&amp;", "&")).searchParams.get("token")!);
      const { periksaTokenEmailKontak } = await import("@/lib/siswa/email-kontak");
      expect(periksaTokenEmailKontak(token)).toEqual({ ok: true, studentId: ID, email: "ortu@contoh.id" });
    });

    it("alamat dirapikan sebelum disimpan (huruf kecil, dipangkas)", async () => {
      await kontak({ ...SIMPAN, email: "  Ortu@Contoh.ID " });
      expect(m.studentUpdate).toHaveBeenCalledWith({ where: { id: ID }, data: { emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: null } });
    });

    it("server tanpa kunci penanda tangan: 503 SEBELUM menyimpan apa pun dan tanpa mengirim email", async () => {
      vi.stubEnv("APP_ENCRYPTION_KEY", "");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
      const res = await kontak(SIMPAN);
      expect(res.status).toBe(503);
      expect(m.studentUpdate).not.toHaveBeenCalled();
      expect(m.kirim).not.toHaveBeenCalled();
    });

    it("email verifikasi gagal terkirim: alamat tetap tersimpan, pengiriman=false supaya siswa bisa kirim ulang", async () => {
      m.kirim.mockResolvedValue({ ok: false, error: "kuota", kuotaHabis: true, kode: "x" });
      const res = await kontak(SIMPAN);
      expect(res.status).toBe(200);
      expect(await isi(res)).toMatchObject({ ok: true, pengiriman: false, emailKontak: { alamat: "ortu@contoh.id", terverifikasi: false } });
      expect(m.studentUpdate).toHaveBeenCalledTimes(1);
    });

    it("mengganti alamat yang SUDAH terverifikasi: yang baru belum terverifikasi, alamat lama diberi tahu, yang baru dikirimi verifikasi", async () => {
      m.studentFindFirst.mockResolvedValue({ ...SISWA, emailKontak: "lama@contoh.id", emailKontakVerifiedAt: new Date("2026-10-01T00:00:00Z") });
      const res = await kontak(SIMPAN);
      expect(res.status).toBe(200);
      expect(m.studentUpdate).toHaveBeenCalledWith({ where: { id: ID }, data: { emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: null } });
      expect(m.kirim).toHaveBeenCalledTimes(2);
      const tujuan = m.kirim.mock.calls.map((c) => c[0]);
      expect(tujuan).toEqual(["ortu@contoh.id", "lama@contoh.id"]);
      const keLama = m.kirim.mock.calls[1]![1] as { subject: string; html: string };
      expect(keLama.subject).toBe("Email kontak akun AyoTKA kamu diganti");
      expect(keLama.html).toContain("lama@contoh.id");
      expect(keLama.html).toContain("ortu@contoh.id");
    });

    it("mengganti alamat yang BELUM terverifikasi: alamat lama (yang belum terbukti miliknya) tidak diberi tahu", async () => {
      m.studentFindFirst.mockResolvedValue({ ...SISWA, emailKontak: "salah-ketik@contoh.id", emailKontakVerifiedAt: null });
      await kontak(SIMPAN);
      expect(m.kirim).toHaveBeenCalledTimes(1);
      expect(m.kirim.mock.calls[0]![0]).toBe("ortu@contoh.id");
    });

    it("alamat yang sama dan sudah terverifikasi: tidak ada perubahan, tidak ada email", async () => {
      m.studentFindFirst.mockResolvedValue({ ...SISWA, emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: new Date() });
      const res = await kontak({ ...SIMPAN, email: "ORTU@contoh.id" });
      expect(res.status).toBe(200);
      expect(String((await isi(res)).pesan)).toContain("sudah terpasang dan terverifikasi");
      expect(m.studentUpdate).not.toHaveBeenCalled();
      expect(m.kirim).not.toHaveBeenCalled();
    });

    it("alamat yang sama tetapi belum terverifikasi: hanya kirim ulang tautan, tidak menulis database", async () => {
      m.studentFindFirst.mockResolvedValue({ ...SISWA, emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: null });
      const res = await kontak(SIMPAN);
      expect(res.status).toBe(200);
      expect(await isi(res)).toMatchObject({ pengiriman: true, emailKontak: { alamat: "ortu@contoh.id", terverifikasi: false } });
      expect(m.studentUpdate).not.toHaveBeenCalled();
      expect(m.kirim).toHaveBeenCalledTimes(1);
    });
  });

  describe("kirim_ulang", () => {
    it("tanpa email kontak: 409", async () => {
      expect((await kontak({ aksi: "kirim_ulang" })).status).toBe(409);
      expect(m.kirim).not.toHaveBeenCalled();
    });

    it("sudah terverifikasi: tidak mengirim apa pun", async () => {
      m.studentFindFirst.mockResolvedValue({ ...SISWA, emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: new Date() });
      const res = await kontak({ aksi: "kirim_ulang" });
      expect(res.status).toBe(200);
      expect(String((await isi(res)).pesan)).toContain("sudah terverifikasi");
      expect(m.kirim).not.toHaveBeenCalled();
    });

    it("belum terverifikasi: mengirim tautan baru ke alamat tersimpan TANPA password dan tanpa mengubah data", async () => {
      m.studentFindFirst.mockResolvedValue({ ...SISWA, emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: null });
      const res = await kontak({ aksi: "kirim_ulang" });
      expect(res.status).toBe(200);
      expect(await isi(res)).toMatchObject({ ok: true, pengiriman: true });
      expect(m.verifikasi).not.toHaveBeenCalled();
      expect(m.studentUpdate).not.toHaveBeenCalled();
      expect(m.kirim).toHaveBeenCalledTimes(1);
      expect(m.kirim.mock.calls[0]![0]).toBe("ortu@contoh.id");
    });

    it("server tanpa kunci: 503", async () => {
      vi.stubEnv("APP_ENCRYPTION_KEY", "");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
      m.studentFindFirst.mockResolvedValue({ ...SISWA, emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: null });
      expect((await kontak({ aksi: "kirim_ulang" })).status).toBe(503);
    });
  });

  describe("hapus", () => {
    const HAPUS = { aksi: "hapus", password: "PasswordSaya#1" };

    it("password salah: 400 dan email kontak tetap", async () => {
      m.verifikasi.mockResolvedValue("salah");
      m.studentFindFirst.mockResolvedValue({ ...SISWA, emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: new Date() });
      expect((await kontak(HAPUS)).status).toBe(400);
      expect(m.studentUpdate).not.toHaveBeenCalled();
    });

    it("tidak ada email kontak: berhasil tanpa menulis apa pun", async () => {
      const res = await kontak(HAPUS);
      expect(res.status).toBe(200);
      expect(await isi(res)).toMatchObject({ ok: true, emailKontak: null });
      expect(m.studentUpdate).not.toHaveBeenCalled();
    });

    it("terverifikasi: dilepas, tercatat di audit, alamat lama diberi tahu", async () => {
      m.studentFindFirst.mockResolvedValue({ ...SISWA, emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: new Date() });
      const res = await kontak(HAPUS);
      expect(res.status).toBe(200);
      expect(m.studentUpdate).toHaveBeenCalledWith({ where: { id: ID }, data: { emailKontak: null, emailKontakVerifiedAt: null } });
      expect(m.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          before: { emailKontak: "ortu@contoh.id", terverifikasi: true },
          after: { emailKontak: null, aksi: "lepas_email_kontak" },
        }),
      );
      expect(m.kirim).toHaveBeenCalledTimes(1);
      expect(m.kirim.mock.calls[0]![0]).toBe("ortu@contoh.id");
      expect((m.kirim.mock.calls[0]![1] as { subject: string }).subject).toBe("Email kontak akun AyoTKA kamu dilepas");
    });

    it("belum terverifikasi: dilepas tanpa memberi tahu siapa pun", async () => {
      m.studentFindFirst.mockResolvedValue({ ...SISWA, emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: null });
      expect((await kontak(HAPUS)).status).toBe(200);
      expect(m.studentUpdate).toHaveBeenCalledTimes(1);
      expect(m.kirim).not.toHaveBeenCalled();
    });
  });

  it("tidak membocorkan email sintetis atau NISN utuh di respons mana pun", async () => {
    const hasil = [await kontak(SIMPAN), await kontak({ aksi: "kirim_ulang" }), await kontak({ aksi: "hapus", password: "x" })];
    for (const r of hasil) {
      const teks = JSON.stringify(await isi(r));
      expect(teks).not.toContain("nisn.ayotka.id");
      expect(teks).not.toContain("3155213156");
      expect(r.headers.get("Cache-Control")).toBe("no-store");
    }
  });
});

describe("POST /api/auth/verifikasi-email-kontak", () => {
  const verifikasi = (body: unknown) => verifikasiPOST(req("/api/auth/verifikasi-email-kontak", body));
  const tokenSah = (email = "ortu@contoh.id", sekarang?: Date) => buatTokenEmailKontak({ studentId: ID, email, sekarang })!;
  const TERSIMPAN = { id: ID, userId: "user-1", emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: null };

  beforeEach(() => {
    m.studentFindFirst.mockResolvedValue({ ...TERSIMPAN });
  });

  it("terlalu banyak percobaan dari satu IP: 429", async () => {
    m.checkRateLimit.mockReturnValue(false);
    expect((await verifikasi({ token: tokenSah() })).status).toBe(429);
    expect(m.checkRateLimit).toHaveBeenCalledWith("verifikasi-email-kontak:1.2.3.4", 20, 10 * 60_000);
    expect(m.studentFindFirst).not.toHaveBeenCalled();
  });

  it.each([
    ["badan kosong", undefined],
    ["tanpa token", {}],
    ["token terlalu pendek", { token: "abc" }],
    ["token bukan teks", { token: 12345 }],
  ])("%s: 400", async (_nama, body) => {
    expect((await verifikasi(body)).status).toBe(400);
    expect(m.studentFindFirst).not.toHaveBeenCalled();
  });

  it("tidak butuh sesi login (tidak memeriksa peran)", async () => {
    await verifikasi({ token: tokenSah() });
    expect(m.requireRole).not.toHaveBeenCalled();
  });

  it("tanda tangan salah: 400 dengan kode tidak_sah", async () => {
    const t = tokenSah();
    const rusak = `${t.slice(0, -4)}AAAA`;
    const res = await verifikasi({ token: rusak });
    expect(res.status).toBe(400);
    expect(await isi(res)).toMatchObject({ kode: "tidak_sah" });
    expect(m.studentUpdateMany).not.toHaveBeenCalled();
  });

  it("kedaluwarsa: 410 dengan petunjuk meminta tautan baru", async () => {
    const lama = new Date(Date.now() - 49 * 3_600_000);
    const res = await verifikasi({ token: tokenSah("ortu@contoh.id", lama) });
    expect(res.status).toBe(410);
    expect(await isi(res)).toMatchObject({ kode: "kedaluwarsa" });
    expect(String((await isi(await verifikasi({ token: tokenSah("ortu@contoh.id", lama) }))).error)).toContain("halaman Profil");
  });

  it("server tanpa kunci: 503", async () => {
    const t = tokenSah();
    vi.stubEnv("APP_ENCRYPTION_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect((await verifikasi({ token: t })).status).toBe(503);
  });

  it.each([
    ["siswa sudah tidak ada/arsip", null],
    ["email kontak sudah dilepas", { ...TERSIMPAN, emailKontak: null }],
    ["email kontak sudah diganti ke alamat lain", { ...TERSIMPAN, emailKontak: "lain@contoh.id" }],
  ])("tautan usang (%s): 409 kode usang, tidak ada yang ditulis", async (_nama, baris) => {
    m.studentFindFirst.mockResolvedValue(baris);
    const res = await verifikasi({ token: tokenSah() });
    expect(res.status).toBe(409);
    expect(await isi(res)).toMatchObject({ kode: "usang" });
    expect(m.studentUpdateMany).not.toHaveBeenCalled();
  });

  it("sudah terverifikasi sebelumnya: 200 sudahTerverifikasi, tidak menulis ulang", async () => {
    m.studentFindFirst.mockResolvedValue({ ...TERSIMPAN, emailKontakVerifiedAt: new Date() });
    const res = await verifikasi({ token: tokenSah() });
    expect(res.status).toBe(200);
    expect(await isi(res)).toMatchObject({ ok: true, sudahTerverifikasi: true });
    expect(m.studentUpdateMany).not.toHaveBeenCalled();
  });

  it("berhasil: ditandai terverifikasi hanya bila alamat masih sama, tercatat di audit", async () => {
    const res = await verifikasi({ token: tokenSah() });
    expect(res.status).toBe(200);
    expect(await isi(res)).toMatchObject({ ok: true, sudahTerverifikasi: false });
    expect(m.studentUpdateMany).toHaveBeenCalledWith({
      where: { id: ID, emailKontak: "ortu@contoh.id", emailKontakVerifiedAt: null },
      data: { emailKontakVerifiedAt: expect.any(Date) },
    });
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        entitas: "students",
        entitasId: ID,
        after: { emailKontak: "ortu@contoh.id", terverifikasi: true, aksi: "verifikasi_email_kontak" },
      }),
    );
  });

  it("alamat tersimpan berhuruf besar-kecil campur tetap cocok dengan token (dibandingkan tanpa peduli huruf)", async () => {
    m.studentFindFirst.mockResolvedValue({ ...TERSIMPAN, emailKontak: "Ortu@Contoh.ID" });
    expect((await verifikasi({ token: tokenSah("ortu@contoh.id") })).status).toBe(200);
    expect(m.studentUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("alamat berganti tepat di antara pembacaan dan penulisan (updateMany tidak mengenai baris): 409, tanpa audit", async () => {
    m.studentUpdateMany.mockResolvedValue({ count: 0 });
    const res = await verifikasi({ token: tokenSah() });
    expect(res.status).toBe(409);
    expect(await isi(res)).toMatchObject({ kode: "usang" });
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("token untuk siswa lain tidak bisa memverifikasi alamat siswa ini (token mengikat ID siswa)", async () => {
    const tokenLain = buatTokenEmailKontak({ studentId: "00000000-0000-4000-8000-000000000001", email: "ortu@contoh.id" })!;
    m.studentFindFirst.mockResolvedValue(null); // siswa milik token itu tidak punya email kontak/ tidak ada
    const res = await verifikasi({ token: tokenLain });
    expect(res.status).toBe(409);
    expect(m.studentFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "00000000-0000-4000-8000-000000000001", deletedAt: null } }));
    expect(m.studentUpdateMany).not.toHaveBeenCalled();
  });
});
