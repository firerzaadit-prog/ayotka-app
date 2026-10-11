import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  findFirst: vi.fn(),
  getUserById: vi.fn(),
  generateLink: vi.fn(),
  kirim: vi.fn(),
  rate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findFirst: m.findFirst } } }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { getUserById: m.getUserById, generateLink: m.generateLink } } }),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rate }));
vi.mock("@/lib/audit/log", () => ({ getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/email/konfirmasi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/konfirmasi")>()),
  kirimEmailKonfirmasi: m.kirim,
}));

import { POST } from "@/app/api/auth/kirim-ulang-konfirmasi/route";

const PESAN_UMUM =
  "Kalau emailmu terdaftar dan belum dikonfirmasi, email konfirmasi baru sudah dikirim. Cek kotak masuk dan folder spam.";

const minta = (email: unknown) =>
  POST(
    new NextRequest("https://localhost:3001/api/auth/kirim-ulang-konfirmasi", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  );
const pengguna = (o: Record<string, unknown> = {}) => ({
  id: "u1",
  email: "budi@example.com",
  role: "siswa",
  status: "aktif",
  studentProfile: { nama: "Budi" },
  partnerProfile: null,
  ...o,
});

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.rate.mockReturnValue(true);
  m.findFirst.mockResolvedValue(pengguna());
  m.getUserById.mockResolvedValue({ data: { user: { email_confirmed_at: null } }, error: null });
  m.generateLink.mockResolvedValue({ data: { properties: { hashed_token: "hash123" } }, error: null });
  m.kirim.mockResolvedValue({ ok: true, lewat: "resend" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/auth/kirim-ulang-konfirmasi", () => {
  it("akun siswa belum terkonfirmasi: tautan 'magiclink' dibuat dan email konfirmasi dikirim ulang; jawaban umum", async () => {
    const res = await minta(" Budi@Example.com ");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, message: PESAN_UMUM });
    expect(m.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "budi@example.com" });
    expect(m.kirim).toHaveBeenCalledWith({ email: "budi@example.com", nama: "Budi", tokenHash: "hash123", type: "magiclink", peran: "siswa" });
  });

  it("akun mitra: peran 'mitra' dan nama dari profil mitra", async () => {
    m.findFirst.mockResolvedValue(pengguna({ role: "mitra", studentProfile: null, partnerProfile: { nama: "Toko Buku" } }));
    await minta("budi@example.com");
    expect(m.kirim).toHaveBeenCalledWith(expect.objectContaining({ peran: "mitra", nama: "Toko Buku" }));
  });

  it("jawaban SAMA dan TANPA email untuk: tidak terdaftar, nonaktif, peran lain (admin), sudah terkonfirmasi, dan galat baca akun", async () => {
    const kasus: Array<() => void> = [
      () => m.findFirst.mockResolvedValue(null),
      () => m.findFirst.mockResolvedValue(pengguna({ status: "nonaktif" })),
      () => m.findFirst.mockResolvedValue(pengguna({ role: "admin_pusat" })),
      () => m.getUserById.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-10-01T00:00:00Z" } }, error: null }),
      () => m.getUserById.mockResolvedValue({ data: { user: null }, error: { message: "boom" } }),
    ];
    for (const [i, atur] of kasus.entries()) {
      m.findFirst.mockResolvedValue(pengguna());
      m.getUserById.mockResolvedValue({ data: { user: { email_confirmed_at: null } }, error: null });
      atur();
      const res = await minta("budi@example.com");
      expect(res.status, `kasus ${i}`).toBe(200);
      expect(await res.json(), `kasus ${i}`).toEqual({ ok: true, message: PESAN_UMUM });
    }
    expect(m.generateLink).not.toHaveBeenCalled();
    expect(m.kirim).not.toHaveBeenCalled();
  });

  it("format email salah -> 400 tanpa menyentuh database", async () => {
    for (const email of ["", "bukan-email", 5, null]) expect((await minta(email)).status, String(email)).toBe(400);
    expect(m.findFirst).not.toHaveBeenCalled();
  });

  it("dibatasi per IP dan per email -> 429, tanpa mencari akun atau mengirim email", async () => {
    await minta("Budi@Example.com");
    const kunci = m.rate.mock.calls.map((c) => c[0]);
    expect(kunci).toEqual(expect.arrayContaining(["kirim-ulang:ip:1.2.3.4", "kirim-ulang:email:budi@example.com"]));

    m.findFirst.mockClear();
    m.kirim.mockClear();
    m.rate.mockReturnValue(false);
    const res = await minta("budi@example.com");
    expect(res.status).toBe(429);
    expect(m.findFirst).not.toHaveBeenCalled();
    expect(m.kirim).not.toHaveBeenCalled();
  });

  it("tautan gagal dibuat: 503 dengan pesan yang jelas, tanpa email", async () => {
    m.generateLink.mockResolvedValue({ data: { properties: null }, error: { message: "boom" } });
    const res = await minta("budi@example.com");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/Belum bisa membuat tautan konfirmasi/);
    expect(m.kirim).not.toHaveBeenCalled();
  });

  it("email gagal terkirim: 503 dengan pesan 'belum berhasil terkirim' + kode penyebab (supaya bisa dilaporkan)", async () => {
    m.kirim.mockResolvedValue({ ok: false, error: "Resend API error 403", kuotaHabis: false, kode: "resend-403 + mailketing-nonaktif" });
    const res = await minta("budi@example.com");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe(
      'Akunmu sudah dibuat, tapi email konfirmasi belum berhasil terkirim. Klik "Kirim ulang email konfirmasi" di bawah untuk mencoba lagi. (Kode: resend-403 + mailketing-nonaktif)',
    );
    const log = vi.mocked(console.error).mock.calls.map((c) => c.map(String).join(" ")).join(" | ");
    expect(log).toContain("[resend-403 + mailketing-nonaktif]");
    expect(log).not.toContain("hash123");
    expect(log).not.toContain("budi@example.com");
  });

  it("kuota email habis: pesan 'sangat ramai' + kode", async () => {
    m.kirim.mockResolvedValue({ ok: false, error: "quota", kuotaHabis: true, kode: "resend-kuota" });
    const res = await minta("budi@example.com");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/sangat ramai.*\(Kode: resend-kuota\)$/);
  });
});
