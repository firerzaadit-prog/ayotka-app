import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  findFirst: vi.fn(),
  studentFindFirst: vi.fn(),
  generateLink: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  kirimEmail: vi.fn(),
  rate: vi.fn(),
  nanti: [] as Array<() => unknown>,
}));

// after() hanya boleh dipanggil di dalam permintaan Next; di tes, pekerjaannya ditampung lalu dijalankan manual.
vi.mock("next/server", async (importOriginal) => {
  const asli = await importOriginal<typeof import("next/server")>();
  return {
    ...asli,
    after: (fn: () => unknown) => {
      m.nanti.push(fn);
    },
  };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findFirst: m.findFirst }, student: { findFirst: m.studentFindFirst } } }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { generateLink: m.generateLink }, resetPasswordForEmail: m.resetPasswordForEmail } }),
}));
vi.mock("@/lib/email/kirim", () => ({ kirimEmail: m.kirimEmail }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rate }));
vi.mock("@/lib/audit/log", () => ({ getClientIp: () => "1.2.3.4" }));

import { POST } from "@/app/api/auth/forgot-password/route";

const PUBLIK = "https://ayotka.id";
const HASH = "hash_rahasia_0123456789abcdef";
const PESAN_UMUM =
  "Jika email tersebut terdaftar di AyoTKA, tautan atur ulang password sudah dikirim. Cek kotak masuk atau folder spam dalam beberapa menit.";

const minta = (email: unknown) =>
  POST(
    new NextRequest("https://localhost:3001/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  );
const jalankanTertunda = async () => {
  for (const fn of m.nanti.splice(0)) await fn();
};
const akun = (o: Record<string, unknown> = {}) => ({
  email: "firerza.praditya@students.um.ac.id",
  role: "siswa",
  status: "aktif",
  studentProfile: { nama: "FIRERZA PRADITYA" },
  partnerProfile: null,
  schoolUsers: [],
  ...o,
});

const log = { log: vi.spyOn(console, "log"), warn: vi.spyOn(console, "warn"), error: vi.spyOn(console, "error") };

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", PUBLIK);
  m.nanti.length = 0;
  for (const f of [m.findFirst, m.studentFindFirst, m.generateLink, m.resetPasswordForEmail, m.kirimEmail, m.rate]) f.mockReset();
  m.rate.mockReturnValue(true);
  m.findFirst.mockResolvedValue(akun());
  m.studentFindFirst.mockResolvedValue(null);
  m.generateLink.mockResolvedValue({ data: { properties: { hashed_token: HASH } }, error: null });
  m.resetPasswordForEmail.mockResolvedValue({});
  m.kirimEmail.mockResolvedValue({ ok: true, lewat: "resend" });
  for (const l of Object.values(log)) l.mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  for (const l of Object.values(log)) l.mockClear();
});

describe("POST /api/auth/forgot-password", () => {
  it("email terdaftar: jawaban umum, lalu email reset dikirim ke alamat akun dengan tautan di alamat PUBLIK", async () => {
    const res = await minta("Firerza.Praditya@Students.UM.ac.id ");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, message: PESAN_UMUM });

    // pengiriman terjadi SETELAH respons (after), bukan sebelum
    expect(m.kirimEmail).not.toHaveBeenCalled();
    await jalankanTertunda();

    expect(m.generateLink).toHaveBeenCalledWith({ type: "recovery", email: "firerza.praditya@students.um.ac.id" });
    expect(m.kirimEmail).toHaveBeenCalledTimes(1);
    const kirim = m.kirimEmail.mock.calls[0]![0] as { to: string; subject: string; html: string };
    expect(kirim.to).toBe("firerza.praditya@students.um.ac.id");
    expect(kirim.subject).toBe("Konfirmasi Atur Ulang Password Akun Siswa AyoTKA");
    const tautan = `${PUBLIK}/api/auth/confirm?token_hash=${HASH}&type=recovery&next=%2Freset-password`;
    expect(kirim.html.split(`href="${tautan}"`)).toHaveLength(3); // tombol + teks salinan
    expect(kirim.html).toContain("<strong>FIRERZA PRADITYA</strong>");
    expect(kirim.html).not.toContain("localhost");
  });

  it("pencarian akun tidak peka huruf besar/kecil dan memakai email yang sudah dinormalisasi", async () => {
    await minta("  Siswa@Example.COM ");
    expect(m.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { email: { equals: "siswa@example.com", mode: "insensitive" } } }));
  });

  it("nama di email di-escape (tidak menyisipkan HTML)", async () => {
    m.findFirst.mockResolvedValue(akun({ studentProfile: { nama: "<img src=x onerror=alert(1)>" } }));
    await minta("a@b.co");
    await jalankanTertunda();
    const html = String((m.kirimEmail.mock.calls[0]![0] as { html: string }).html);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("label peran di subjek mengikuti peran akun (mitra, admin sekolah)", async () => {
    for (const [role, label] of [["mitra", "Mitra"], ["admin_sekolah", "Admin Sekolah"], ["dinas_pendidikan", "Dinas Pendidikan"]] as const) {
      m.kirimEmail.mockClear();
      m.findFirst.mockResolvedValue(akun({ role, studentProfile: null }));
      await minta("a@b.co");
      await jalankanTertunda();
      expect((m.kirimEmail.mock.calls[0]![0] as { subject: string }).subject, role).toBe(`Konfirmasi Atur Ulang Password Akun ${label} AyoTKA`);
    }
  });

  it("jawaban SAMA untuk email yang tidak terdaftar, akun nonaktif, dan akun NISN (tidak membocorkan apa pun), tanpa mengirim email", async () => {
    const kasus = [null, akun({ status: "nonaktif" }), akun({ email: "1234567890@nisn.ayotka.id" }), akun({ email: "1234567890@NISN.ayotka.id" })];
    for (const [i, user] of kasus.entries()) {
      m.findFirst.mockResolvedValue(user);
      const res = await minta("a@b.co");
      expect(res.status, `kasus ${i}`).toBe(200);
      expect(await res.json(), `kasus ${i}`).toEqual({ ok: true, message: PESAN_UMUM });
    }
    await jalankanTertunda();
    expect(m.generateLink).not.toHaveBeenCalled();
    expect(m.kirimEmail).not.toHaveBeenCalled();
  });

  it("format email salah -> 400 tanpa menyentuh database", async () => {
    for (const email of ["", "bukan-email", "a@", 123, null]) {
      const res = await minta(email);
      expect(res.status, String(email)).toBe(400);
    }
    expect(m.findFirst).not.toHaveBeenCalled();
  });

  it("dibatasi: terlalu banyak permintaan -> 429, tanpa mencari akun atau mengirim email", async () => {
    m.rate.mockReturnValue(false);
    const res = await minta("a@b.co");
    expect(res.status).toBe(429);
    expect(m.findFirst).not.toHaveBeenCalled();
    await jalankanTertunda();
    expect(m.kirimEmail).not.toHaveBeenCalled();
  });

  it("batas dihitung per IP DAN per email", async () => {
    await minta("Orang@Example.com");
    const kunci = m.rate.mock.calls.map((c) => c[0]);
    expect(kunci).toContain("lupa-password:ip:1.2.3.4");
    expect(kunci).toContain("lupa-password:email:orang@example.com");
  });

  it("tautan gagal dibuat (GoTrue galat): tidak ada email dan tidak ada galat ke pengguna", async () => {
    m.generateLink.mockResolvedValue({ data: { properties: null }, error: { message: "boom" } });
    const res = await minta("a@b.co");
    expect(res.status).toBe(200);
    await jalankanTertunda();
    expect(m.kirimEmail).not.toHaveBeenCalled();
  });

  it("semua penyedia email gagal: kode penyebab dicatat (tanpa token) dan cadangan bawaan Supabase dicoba; pengguna tetap dapat jawaban umum", async () => {
    m.kirimEmail.mockResolvedValue({ ok: false, error: "Resend API error 401", kuotaHabis: false, kode: "resend-401 + mailketing-nonaktif" });
    const res = await minta("a@b.co");
    expect(await res.json()).toEqual({ ok: true, message: PESAN_UMUM });
    await jalankanTertunda();
    const dicatat = log.warn.mock.calls.map((c) => c.map(String).join(" ")).join(" | ");
    expect(dicatat).toContain("[resend-401 + mailketing-nonaktif]");
    expect(m.resetPasswordForEmail).toHaveBeenCalledWith("firerza.praditya@students.um.ac.id", {
      redirectTo: `${PUBLIK}/api/auth/confirm?next=/reset-password`,
    });
  });

  it("di produksi tautan reset (rahasia) tidak pernah ditulis ke log", async () => {
    await minta("a@b.co");
    await jalankanTertunda();
    const semuaLog = [...log.log.mock.calls, ...log.warn.mock.calls, ...log.error.mock.calls].map((c) => c.map(String).join(" ")).join(" | ");
    expect(semuaLog).not.toContain(HASH);
  });
});

describe("POST /api/auth/forgot-password - lewat NISN (email kontak)", () => {
  const PESAN_NISN =
    "Jika NISN itu punya email kontak yang sudah diverifikasi, tautan atur ulang password sudah dikirim ke email kontak tersebut. Cek kotak masuk atau folder spam dalam beberapa menit. Belum punya email kontak? Minta admin sekolahmu untuk mereset password.";
  const NISN = "3155213156";
  const siswaNisn = (o: Record<string, unknown> = {}) => ({
    nama: "SITI AMINAH",
    nisn: NISN,
    emailKontak: "ortu.siti@gmail.com",
    emailKontakVerifiedAt: new Date("2026-10-10T00:00:00Z"),
    user: { email: `${NISN}@nisn.ayotka.id`, status: "aktif" },
    ...o,
  });

  it("NISN dengan email kontak terverifikasi: tautan reset akun NISN dikirim ke EMAIL KONTAK, bukan ke email sintetis", async () => {
    m.studentFindFirst.mockResolvedValue(siswaNisn());
    const res = await minta(NISN);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, message: PESAN_NISN });
    expect(m.kirimEmail).not.toHaveBeenCalled(); // setelah respons (after)
    await jalankanTertunda();

    // pencarian lewat NISN pada siswa yang belum dihapus; tidak memakai pencarian akun lewat email
    expect(m.studentFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { nisn: NISN, deletedAt: null } }));
    expect(m.findFirst).not.toHaveBeenCalled();
    // tautan pemulihan dibuat untuk email LOGIN akun (sintetis), tetapi dikirim ke email kontak
    expect(m.generateLink).toHaveBeenCalledWith({ type: "recovery", email: `${NISN}@nisn.ayotka.id` });
    expect(m.kirimEmail).toHaveBeenCalledTimes(1);
    const kirim = m.kirimEmail.mock.calls[0]![0] as { to: string; subject: string; html: string };
    expect(kirim.to).toBe("ortu.siti@gmail.com");
    expect(kirim.subject).toBe("Konfirmasi Atur Ulang Password Akun Siswa AyoTKA");
    const tautan = `${PUBLIK}/api/auth/confirm?token_hash=${HASH}&type=recovery&next=%2Freset-password`;
    expect(kirim.html.split(`href="${tautan}"`)).toHaveLength(3);
    expect(kirim.html).toContain("<strong>SITI AMINAH</strong>");
    // NISN hanya tampil tersamar; email sintetis tidak pernah tampil
    expect(kirim.html).toContain("NISN ******3156");
    expect(kirim.html).not.toContain(NISN);
    expect(kirim.html).not.toContain("nisn.ayotka.id");
  });

  it("jawaban SAMA untuk semua NISN: tidak dikenal, tanpa email kontak, kontak belum terverifikasi, akun nonaktif, akun beremail sungguhan, tanpa akun", async () => {
    const kasus = [
      null,
      siswaNisn({ emailKontak: null, emailKontakVerifiedAt: null }),
      siswaNisn({ emailKontakVerifiedAt: null }),
      siswaNisn({ user: { email: `${NISN}@nisn.ayotka.id`, status: "nonaktif" } }),
      siswaNisn({ user: { email: "siti@gmail.com", status: "aktif" } }),
      siswaNisn({ user: null }),
    ];
    for (const [i, siswa] of kasus.entries()) {
      m.studentFindFirst.mockResolvedValue(siswa);
      const res = await minta(NISN);
      expect(res.status, `kasus ${i}`).toBe(200);
      expect(await res.json(), `kasus ${i}`).toEqual({ ok: true, message: PESAN_NISN });
    }
    await jalankanTertunda();
    expect(m.generateLink).not.toHaveBeenCalled();
    expect(m.kirimEmail).not.toHaveBeenCalled();
  });

  it("gagal kirim ke email kontak: tidak mencoba cadangan bawaan Supabase (email sintetis tidak punya kotak surat)", async () => {
    m.studentFindFirst.mockResolvedValue(siswaNisn());
    m.kirimEmail.mockResolvedValue({ ok: false, error: "kuota habis", kuotaHabis: true, kode: "resend-429" });
    const res = await minta(NISN);
    expect(res.status).toBe(200);
    await jalankanTertunda();
    expect(m.kirimEmail).toHaveBeenCalledTimes(1);
    expect(m.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("tautan gagal dibuat: tidak ada email dan tidak ada galat ke pengguna", async () => {
    m.studentFindFirst.mockResolvedValue(siswaNisn());
    m.generateLink.mockResolvedValue({ data: { properties: null }, error: { message: "boom" } });
    expect((await minta(NISN)).status).toBe(200);
    await jalankanTertunda();
    expect(m.kirimEmail).not.toHaveBeenCalled();
  });

  it("dibatasi per IP dan per NISN (bukan per email); terlalu banyak -> 429 tanpa mencari siswa", async () => {
    await minta(NISN);
    const kunci = m.rate.mock.calls.map((c) => c[0]);
    expect(kunci).toContain("lupa-password:ip:1.2.3.4");
    expect(kunci).toContain(`lupa-password:nisn:${NISN}`);

    m.rate.mockReturnValue(false);
    m.studentFindFirst.mockClear();
    expect((await minta(NISN)).status).toBe(429);
    expect(m.studentFindFirst).not.toHaveBeenCalled();
  });

  it.each(["123456789", "12345678901", "12345 67890", "31552131a6"])("'%s' bukan NISN dan bukan email: 400, tidak mencari siswa maupun akun", async (masukan) => {
    const res = await minta(masukan);
    expect(res.status).toBe(400);
    expect(m.studentFindFirst).not.toHaveBeenCalled();
    expect(m.findFirst).not.toHaveBeenCalled();
  });

  it("jalur email biasa tidak berubah: tidak menyentuh pencarian siswa", async () => {
    await minta("firerza.praditya@students.um.ac.id");
    expect(m.studentFindFirst).not.toHaveBeenCalled();
    expect(m.findFirst).toHaveBeenCalledTimes(1);
  });

  it("di produksi tautan reset akun NISN tidak ditulis ke log", async () => {
    m.studentFindFirst.mockResolvedValue(siswaNisn());
    await minta(NISN);
    await jalankanTertunda();
    const semuaLog = [...log.log.mock.calls, ...log.warn.mock.calls, ...log.error.mock.calls].map((c) => c.map(String).join(" ")).join(" | ");
    expect(semuaLog).not.toContain(HASH);
  });
});
