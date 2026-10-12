import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  user: { current: null as null | { id: string } },
  signOut: vi.fn(async () => ({})),
  verifyOtp: vi.fn(),
  tutupSesi: vi.fn(async () => {}),
  fulfil: vi.fn(),
  kirimEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: m.user.current } }),
      signOut: m.signOut,
      verifyOtp: m.verifyOtp,
    },
  }),
}));
vi.mock("@/lib/auth/logout", () => ({ closeOpenLoginSession: m.tutupSesi }));
vi.mock("@/lib/schools/scope", () => ({ ACTING_AS_SCHOOL_COOKIE: "ayotka_acting_school" }));
vi.mock("@/lib/billing/affiliate-fulfillment", () => ({ processAffiliateFulfillment: m.fulfil }));
vi.mock("@/lib/email/kirim", () => ({ kirimEmail: m.kirimEmail }));

import { GET as confirmGet, POST as confirmPost } from "@/app/api/auth/confirm/route";
import { GET as forceLogoutGet } from "@/app/api/auth/force-logout/route";
import { GET as affiliateGet } from "@/app/api/webhooks/affiliate/route";
import { kirimEmailKonfirmasi } from "@/lib/email/konfirmasi";
import { rahasiaWebhookAffiliate } from "@/lib/billing/affiliate-auth";

// Produksi: nginx meneruskan permintaan ke aplikasi dengan alamat internal (Host tidak diteruskan). Sebelum perbaikan,
// semua redirect rute API di bawah ini mengarah ke https://localhost:3001 ("This site can't be reached").
const PUBLIK = "https://ayotka.id";
const INTERNAL = "https://localhost:3001";
const lokasi = (res: Response) => res.headers.get("location");
// Webhook affiliate kini wajib membawa rahasia (lib/billing/affiliate-auth.ts)
const KUNCI_SERVER = "kunci-uji-redirect-1234567890";
const TOKEN = rahasiaWebhookAffiliate({ APP_ENCRYPTION_KEY: KUNCI_SERVER })!;

beforeEach(() => {
  vi.stubEnv("APP_ENCRYPTION_KEY", KUNCI_SERVER);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", PUBLIK);
  m.user.current = null;
  m.signOut.mockClear();
  m.tutupSesi.mockClear();
  m.verifyOtp.mockReset();
  m.fulfil.mockReset();
  m.kirimEmail.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("/api/auth/confirm (tautan di email konfirmasi & reset password)", () => {
  it("GET: tautan reset password dialihkan ke halaman /konfirmasi di alamat PUBLIK, bukan alamat internal server", async () => {
    const res = await confirmGet(
      new NextRequest(`${INTERNAL}/api/auth/confirm?token_hash=056a5acf&type=recovery&next=%2Freset-password`),
    );
    expect(res.status).toBe(307);
    expect(lokasi(res)).toBe(`${PUBLIK}/konfirmasi?token_hash=056a5acf&type=recovery&next=%2Freset-password`);
    expect(lokasi(res)).not.toContain("localhost");
  });

  it("GET: tautan konfirmasi pendaftaran (signup) dan kirim ulang (magiclink) juga ke alamat publik", async () => {
    for (const type of ["signup", "magiclink"]) {
      const res = await confirmGet(new NextRequest(`${INTERNAL}/api/auth/confirm?token_hash=abc&type=${type}&next=%2Fsiswa%2Fdashboard`));
      expect(lokasi(res), type).toBe(`${PUBLIK}/konfirmasi?token_hash=abc&type=${type}&next=%2Fsiswa%2Fdashboard`);
    }
  });

  it("GET tanpa token: ke halaman masuk di alamat publik dengan pesan galat", async () => {
    const res = await confirmGet(new NextRequest(`${INTERNAL}/api/auth/confirm`));
    expect(lokasi(res)).toBe(`${PUBLIK}/login?error=Link+sudah+kedaluwarsa+atau+tidak+valid.+Minta+link+baru.`);
  });

  it("GET: tujuan 'next' yang berbahaya tidak diteruskan (hanya path internal)", async () => {
    for (const next of ["//evil.example", "https://evil.example", "/\\evil.example", "javascript:alert(1)"]) {
      const res = await confirmGet(new NextRequest(`${INTERNAL}/api/auth/confirm?token_hash=abc&type=signup&next=${encodeURIComponent(next)}`));
      expect(lokasi(res), next).toBe(`${PUBLIK}/konfirmasi?token_hash=abc&type=signup&next=%2F`);
    }
  });

  it("GET tidak memakai (menghabiskan) token: verifyOtp hanya dipanggil oleh POST", async () => {
    await confirmGet(new NextRequest(`${INTERNAL}/api/auth/confirm?token_hash=abc&type=recovery`));
    expect(m.verifyOtp).not.toHaveBeenCalled();
  });

  it("POST: token sah -> ok; token kedaluwarsa -> 400 dengan pesan yang bisa ditindaklanjuti; tubuh rusak -> 400", async () => {
    m.verifyOtp.mockResolvedValueOnce({ error: null });
    const ok = await confirmPost(
      new NextRequest(`${INTERNAL}/api/auth/confirm`, { method: "POST", body: JSON.stringify({ token_hash: "abc", type: "recovery" }) }),
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });
    expect(m.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc" });

    m.verifyOtp.mockResolvedValueOnce({ error: { message: "Token has expired or is invalid" } });
    const basi = await confirmPost(
      new NextRequest(`${INTERNAL}/api/auth/confirm`, { method: "POST", body: JSON.stringify({ token_hash: "abc", type: "recovery" }) }),
    );
    expect(basi.status).toBe(400);
    expect((await basi.json()).error).toMatch(/kedaluwarsa atau tidak valid/);

    const rusak = await confirmPost(new NextRequest(`${INTERNAL}/api/auth/confirm`, { method: "POST", body: "bukan json" }));
    expect(rusak.status).toBe(400);
  });

  it("ALUR PENUH: tautan yang ditulis di email -> GET -> halaman /konfirmasi di alamat publik yang sama dengan tautan email", async () => {
    m.kirimEmail.mockResolvedValue({ ok: true, lewat: "resend" });
    await kirimEmailKonfirmasi({ email: "siswa@example.com", nama: "Siswa", tokenHash: "tok123", type: "signup", peran: "siswa" });
    const html = String(m.kirimEmail.mock.calls[0]![0].html);
    const tautan = /href="([^"]+\/api\/auth\/confirm[^"]*)"/.exec(html)?.[1];
    expect(tautan).toBe(`${PUBLIK}/api/auth/confirm?token_hash=tok123&type=signup&next=%2Fsiswa%2Fdashboard`);

    // browser membuka tautan itu; nginx meneruskannya ke aplikasi dengan alamat internal
    const res = await confirmGet(new NextRequest(tautan!.replace(PUBLIK, INTERNAL)));
    expect(lokasi(res)).toBe(`${PUBLIK}/konfirmasi?token_hash=tok123&type=signup&next=%2Fsiswa%2Fdashboard`);
  });
});

describe("/api/auth/force-logout", () => {
  it("dialihkan ke halaman masuk di alamat publik, bukan alamat internal; sesi ditutup", async () => {
    m.user.current = { id: "u1" };
    const res = await forceLogoutGet(new NextRequest(`${INTERNAL}/api/auth/force-logout?next=/login`));
    expect(res.status).toBe(307);
    expect(lokasi(res)).toBe(`${PUBLIK}/login`);
    expect(m.tutupSesi).toHaveBeenCalledWith("u1");
    expect(m.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("tujuan portal lain (mitra) dihormati; tujuan berbahaya jatuh ke /login", async () => {
    const mitra = await forceLogoutGet(new NextRequest(`${INTERNAL}/api/auth/force-logout?next=/mitra/login`));
    expect(lokasi(mitra)).toBe(`${PUBLIK}/mitra/login`);
    for (const next of ["//evil.example", "https://evil.example"]) {
      const res = await forceLogoutGet(new NextRequest(`${INTERNAL}/api/auth/force-logout?next=${encodeURIComponent(next)}`));
      expect(lokasi(res), next).toBe(`${PUBLIK}/login`);
    }
  });

  it("tanpa pengguna: tidak menutup sesi di database tetapi tetap logout lokal dan menghapus cookie 'Kelola Sekolah'", async () => {
    const res = await forceLogoutGet(new NextRequest(`${INTERNAL}/api/auth/force-logout`));
    expect(m.tutupSesi).not.toHaveBeenCalled();
    expect(m.signOut).toHaveBeenCalled();
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("ayotka_acting_school=");
    expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});

describe("/api/webhooks/affiliate (pengalihan browser pembeli setelah bayar)", () => {
  const PARAM = `email=siswa%40example.com&order_id=INV-1&amount=50000&token=${TOKEN}`;

  it("dibuka browser (Accept: text/html): top-up -> dompet, langganan -> halaman langganan, di alamat publik", async () => {
    m.fulfil.mockResolvedValueOnce({ ok: true, type: "topup" });
    const topup = await affiliateGet(new Request(`${INTERNAL}/api/webhooks/affiliate?${PARAM}`, { headers: { accept: "text/html" } }));
    expect(lokasi(topup)).toBe(`${PUBLIK}/siswa/wallet?sukses=topup`);

    m.fulfil.mockResolvedValueOnce({ ok: true, type: "langganan" });
    const langganan = await affiliateGet(new Request(`${INTERNAL}/api/webhooks/affiliate?${PARAM}`, { headers: { accept: "text/html" } }));
    expect(lokasi(langganan)).toBe(`${PUBLIK}/siswa/langganan?sukses=langganan`);
  });

  it("dipanggil sebagai webhook (bukan HTML): jawaban JSON, tanpa pengalihan", async () => {
    m.fulfil.mockResolvedValueOnce({ ok: true, type: "topup" });
    const res = await affiliateGet(new Request(`${INTERNAL}/api/webhooks/affiliate?${PARAM}`, { headers: { accept: "application/json" } }));
    expect(res.status).toBe(200);
    expect(lokasi(res)).toBeNull();
    expect(await res.json()).toMatchObject({ ok: true, type: "topup" });
  });
});

describe("penjaga: rute API tidak boleh membangun URL absolut dari alamat permintaan", () => {
  function semuaRute(dir: string): string[] {
    return readdirSync(dir).flatMap((nama) => {
      const jalur = join(dir, nama);
      return statSync(jalur).isDirectory() ? semuaRute(jalur) : nama === "route.ts" ? [jalur] : [];
    });
  }
  const rute = semuaRute(join(process.cwd(), "app", "api"));

  it("pemindai menemukan rute-rute API (bukan daftar kosong)", () => {
    expect(rute.length).toBeGreaterThan(50);
  });

  it("tidak ada `new URL(x, request.url | url.origin)` dan tidak ada `{ origin } = new URL(request.url)`: di belakang nginx itu berisi https://localhost:3001", () => {
    const sebagaiBasis = /new URL\([^()]*,\s*(?:request\.url|req\.url|url\.origin|request\.nextUrl(?:\.origin)?)\s*\)/;
    const diambilDariRequest = /\{[^}]*\borigin\b[^}]*\}\s*=\s*new URL\(/;
    const pelanggar = rute.filter((berkas) => {
      const isi = readFileSync(berkas, "utf8");
      return sebagaiBasis.test(isi) || diambilDariRequest.test(isi);
    });
    expect(pelanggar.map((b) => b.replace(process.cwd(), ""))).toEqual([]);
  });

  it("pola penjaga itu sendiri benar: mengenali kode lama yang rusak dan membiarkan kode yang sudah diperbaiki", () => {
    const sebagaiBasis = /new URL\([^()]*,\s*(?:request\.url|req\.url|url\.origin|request\.nextUrl(?:\.origin)?)\s*\)/;
    const diambilDariRequest = /\{[^}]*\borigin\b[^}]*\}\s*=\s*new URL\(/;
    // bentuk lama (rusak) di rute confirm, force-logout, dan webhook affiliate
    expect(diambilDariRequest.test("const { searchParams, origin } = new URL(request.url);")).toBe(true);
    expect(sebagaiBasis.test("NextResponse.redirect(new URL(next, request.url))")).toBe(true);
    expect(sebagaiBasis.test('new URL("/siswa/wallet?sukses=topup", url.origin)')).toBe(true);
    // bentuk yang benar
    expect(sebagaiBasis.test("NextResponse.redirect(new URL(next, asalPublik(request)))")).toBe(false);
    expect(diambilDariRequest.test("const { searchParams } = new URL(request.url);")).toBe(false);
    expect(sebagaiBasis.test("const q = new URL(request.url).searchParams.get('q')")).toBe(false);
  });

  it("setiap rute yang memakai NextResponse.redirect memakai asalPublik()", () => {
    const tanpaHelper = rute.filter((berkas) => {
      const isi = readFileSync(berkas, "utf8");
      return isi.includes("NextResponse.redirect(") && !isi.includes("asalPublik(");
    });
    expect(tanpaHelper.map((b) => b.replace(process.cwd(), ""))).toEqual([]);
  });
});
