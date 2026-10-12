import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ requireRole: vi.fn(), cari: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { auditLog: { findMany: m.cari } } }));

import { GET } from "@/app/api/admin-pusat/affiliate/alamat/route";
import { periksaAksesAffiliate } from "@/lib/billing/affiliate-auth";
import { AffiliatePengaturanCard, DaftarCallbackBermasalah, type CallbackBermasalah } from "@/components/billing/affiliate-pengaturan-card";

const KUNCI = "kunci-enkripsi-server-uji-1234567890";
const minta = () => GET(new Request("https://localhost:3001/api/admin-pusat/affiliate/alamat"));
const teks = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ayotka.id");
  vi.stubEnv("APP_ENCRYPTION_KEY", KUNCI);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("AFFILIATE_WEBHOOK_SECRET", "");
  m.requireRole.mockResolvedValue({ id: "admin-1", role: "admin_pusat" });
  m.cari.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/admin-pusat/affiliate/alamat", () => {
  it("hanya admin pusat: selain itu 403, tanpa membaca apa pun dan tanpa rahasia dalam jawaban", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await minta();
    expect(res.status).toBe(403);
    expect(m.requireRole).toHaveBeenCalledWith("admin_pusat");
    expect(m.cari).not.toHaveBeenCalled();
    expect(JSON.stringify(await res.json())).not.toContain("token=");
  });

  it("empat alamat di asal PUBLIK (bukan localhost), semuanya lolos pemeriksaan server; jawaban tidak boleh di-cache", async () => {
    const res = await minta();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { alamat } = await res.json();
    expect(Object.keys(alamat).sort()).toEqual(["checkAccount", "checkEmail", "purchase", "success"]);
    for (const url of Object.values(alamat) as string[]) {
      expect(url).toMatch(/^https:\/\/ayotka\.id\/api\/webhooks\/affiliate[a-z-\/]*\?token=[0-9a-f]{48}$/);
      expect(periksaAksesAffiliate(new Request(url))).toEqual({ ok: true });
    }
  });

  it("server tanpa kunci: alamat null (kartu menampilkan peringatan), daftar masalah tetap dikirim", async () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", "");
    const badan = await (await minta()).json();
    expect(badan.alamat).toBeNull();
    expect(badan.gagal).toEqual([]);
  });

  it("daftar panggilan bermasalah: hanya dua jenis entitas, 20 terbaru; dipetakan ke bentuk tampilan", async () => {
    const waktu = new Date("2026-10-12T05:00:00Z");
    m.cari.mockResolvedValue([
      { id: "1", entitas: "affiliate_callback_gagal", entitasId: "ORD-1", createdAt: waktu, afterJson: { kode: "siswa_tidak_ditemukan", pesan: "Siswa tidak ditemukan", email: "x@y.co", productTitle: "Top Up 50000", productId: "p1", amount: 50_000 } },
      { id: "2", entitas: "affiliate_callback_ganda", entitasId: "-", createdAt: waktu, afterJson: { kode: "diduga_ganda", pesan: "Diduga ganda", productId: "p1" } },
      { id: "3", entitas: "affiliate_callback_gagal", entitasId: null, createdAt: waktu, afterJson: null },
    ]);
    const { gagal } = await (await minta()).json();
    expect(m.cari).toHaveBeenCalledWith(expect.objectContaining({ where: { entitas: { in: ["affiliate_callback_gagal", "affiliate_callback_ganda"] } }, take: 20, orderBy: { createdAt: "desc" } }));
    expect(gagal).toEqual([
      { id: "1", waktu: waktu.toISOString(), jenis: "gagal", kode: "siswa_tidak_ditemukan", pesan: "Siswa tidak ditemukan", email: "x@y.co", produk: "Top Up 50000", nominal: 50_000, nomorOrder: "ORD-1" },
      { id: "2", waktu: waktu.toISOString(), jenis: "ganda", kode: "diduga_ganda", pesan: "Diduga ganda", email: null, produk: "p1", nominal: null, nomorOrder: null },
      { id: "3", waktu: waktu.toISOString(), jenis: "gagal", kode: null, pesan: null, email: null, produk: null, nominal: null, nomorOrder: null },
    ]);
  });
});

describe("tampilan kartu pengaturan affiliate.id", () => {
  const baris = (o: Partial<CallbackBermasalah> = {}): CallbackBermasalah => ({
    id: "1", waktu: "2026-10-12T05:00:00Z", jenis: "gagal", kode: "siswa_tidak_ditemukan", pesan: "Siswa tidak ditemukan untuk data email: x@y.co",
    email: "x@y.co", produk: "AyoTKAID Top Up Kredit 50000", nominal: 50_000, nomorOrder: "ORD-1", ...o,
  });

  it("daftar kosong: pesan tenang, tanpa tabel", () => {
    const h = renderToStaticMarkup(createElement(DaftarCallbackBermasalah, { daftar: [] }));
    expect(teks(h)).toContain("Belum ada panggilan yang gagal atau diduga ganda");
    expect(h).not.toContain("<table");
  });

  it("baris gagal dan diduga ganda dibedakan lencananya, dengan email, produk, nominal rupiah, dan nomor order", () => {
    const t = teks(renderToStaticMarkup(createElement(DaftarCallbackBermasalah, { daftar: [baris(), baris({ id: "2", jenis: "ganda", pesan: "Diduga panggilan ganda", nomorOrder: null, nominal: null })] })));
    expect(t).toContain("Gagal");
    expect(t).toContain("Diduga ganda");
    expect(t).toContain("x@y.co");
    expect(t).toContain("AyoTKAID Top Up Kredit 50000");
    expect(t).toMatch(/Rp\s?50\.000/);
    expect(t).toContain("ORD-1");
  });

  it("teks dari luar di-escape (email/produk dari affiliate.id tidak boleh menyisipkan HTML)", () => {
    const h = renderToStaticMarkup(createElement(DaftarCallbackBermasalah, { daftar: [baris({ email: "<img src=x onerror=alert(1)>", pesan: "<script>x</script>" })] }));
    expect(h).not.toContain("<img src=x");
    expect(h).not.toContain("<script>x");
  });

  it("keadaan awal kartu: penjelasan kode rahasia dan peringatan jangan dibagikan; belum ada alamat sebelum data datang", () => {
    const h = renderToStaticMarkup(createElement(AffiliatePengaturanCard));
    const t = teks(h);
    expect(t).toContain("Pembayaran otomatis affiliate.id");
    expect(t).toContain("kode rahasia");
    expect(t).toContain("SETIAP produk");
    expect(t).toContain("Jangan bagikan alamat ini");
    expect(h).not.toContain("token=");
  });
});
