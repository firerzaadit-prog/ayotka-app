import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ requireRole: vi.fn(), studentFind: vi.fn(), riwayat: vi.fn(), getSaldo: vi.fn(), harga: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { student: { findFirst: m.studentFind }, saldoTransaction: { findMany: m.riwayat } } }));
vi.mock("@/lib/billing/saldo", () => ({ getSaldo: m.getSaldo, getHargaLearningAnalytics: m.harga }));
vi.mock("@/lib/billing/midtrans", () => ({ createSnapTransaction: vi.fn() }));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn(), getClientIp: () => "1.2.3.4" }));

import { GET as saldoGet } from "@/app/api/siswa/saldo/route";
import { PetunjukEmailAffiliate } from "@/components/billing/petunjuk-email-affiliate";
import { AFFILIATE_SLUG_PLAN, AFFILIATE_SLUG_TOPUP, adalahEmailSintetis, buildAffiliateUrl } from "@/lib/billing/pembayaran-affiliate";

const teks = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const render = (props: { email: string | null | undefined; untuk: "saldo" | "langganan" }) => renderToStaticMarkup(createElement(PetunjukEmailAffiliate, props));

describe("PetunjukEmailAffiliate", () => {
  it("menampilkan email akun untuk disalin, memberi tahu kolom Email terisi sendiri dan terkunci, cadangannya, sama persis, jumlah beli 1", () => {
    const h = render({ email: "budi@example.com", untuk: "saldo" });
    const t = teks(h);
    expect(t).toContain("budi@example.com");
    expect(t).toContain("otomatis terisi di formulir checkout dan terkunci");
    expect(t).toContain("Kalau kolom Email ternyata kosong");
    expect(t).toContain("sama persis");
    expect(t).toContain("jumlah beli 1");
    expect(h).toContain(">Salin<");
  });

  it("kata hasilnya mengikuti jenis pembayaran: saldo untuk top-up, langganan untuk paket", () => {
    expect(teks(render({ email: "a@b.co", untuk: "saldo" }))).toContain("cara saldo dicocokkan");
    expect(teks(render({ email: "a@b.co", untuk: "langganan" }))).toContain("cara langganan dicocokkan");
  });

  it("email dari luar di-escape (tidak bisa menyisipkan HTML)", () => {
    const h = render({ email: "<img src=x onerror=alert(1)>@x.co", untuk: "saldo" });
    expect(h).not.toContain("<img src=x");
  });

  it("akun NISN (email sintetis): email tidak ditampilkan, diarahkan ke WhatsApp admin untuk aktivasi manual", () => {
    const h = render({ email: "3155213156@nisn.ayotka.id", untuk: "langganan" });
    const t = teks(h);
    expect(t).not.toContain("3155213156@nisn.ayotka.id");
    expect(t).toContain("NISN");
    expect(t).toContain("WhatsApp");
    expect(t).toContain("manual");
    expect(h).not.toContain(">Salin<");
    expect(teks(render({ email: "3155213156@NISN.AYOTKA.ID", untuk: "saldo" }))).not.toContain("3155213156@");
  });

  it("email belum diketahui (jawaban lama): petunjuk umum tanpa tombol salin", () => {
    for (const email of [null, undefined, ""]) {
      const h = render({ email, untuk: "saldo" });
      expect(teks(h)).toContain("email akun AyoTKA kamu");
      expect(teks(h)).toContain("sama persis");
      expect(h).not.toContain(">Salin<");
    }
  });
});

describe("GET /api/siswa/saldo", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.requireRole.mockResolvedValue({ id: "user-1", email: "budi@example.com" });
    m.studentFind.mockResolvedValue({ id: "siswa-1", nama: "Budi" });
    m.getSaldo.mockResolvedValue(0);
    m.harga.mockResolvedValue(9000);
    m.riwayat.mockResolvedValue([]);
  });

  it("mengirim email akun supaya halaman Wallet bisa menunjukkannya untuk diisi di checkout", async () => {
    const res = await saldoGet();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ email: "budi@example.com", saldo: 0 });
  });

  it("tautan bayar langsung ke halaman CHECKOUT dan membawa email akun (bukan halaman produk), tanpa nama siswa", async () => {
    const { affiliateTopup } = await (await saldoGet()).json();
    const daftar = Object.values(affiliateTopup) as Array<{ url: string }>;
    expect(daftar).toHaveLength(2);
    for (const { url } of daftar) {
      expect(url).toMatch(/^https:\/\/www\.affiliate\.id\/tomili2204-gmail--1789370238619066965\/product\/[^/?]+\/checkout\?aff=tomili2204-gmail--1789370238619066965&email=budi%40example\.com$/);
      expect(url).not.toContain("name=");
      expect(url).not.toContain("Budi");
    }
  });

  it("akun NISN: email sintetis (memuat NISN) TIDAK ikut ke affiliate.id", async () => {
    m.requireRole.mockResolvedValue({ id: "user-2", email: "3155213156@nisn.ayotka.id" });
    const { affiliateTopup } = await (await saldoGet()).json();
    for (const { url } of Object.values(affiliateTopup) as Array<{ url: string }>) {
      expect(url).toContain("/checkout?aff=");
      expect(url).not.toContain("email=");
      expect(url).not.toContain("3155213156");
    }
  });

  it("bukan siswa: 403 dan tidak membocorkan email", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await saldoGet();
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain("@");
  });
});

describe("buildAffiliateUrl", () => {
  const SEMUA = [...Object.values(AFFILIATE_SLUG_TOPUP), ...Object.values(AFFILIATE_SLUG_PLAN)];

  it("setiap produk menuju /checkout (halaman produk membuang parameter email) dengan kode afiliasi", () => {
    for (const slug of SEMUA) {
      const url = buildAffiliateUrl(slug);
      expect(url).toBe(`https://www.affiliate.id/tomili2204-gmail--1789370238619066965/product/${slug}/checkout?aff=tomili2204-gmail--1789370238619066965`);
    }
  });

  it("email dikodekan untuk alamat (karakter khusus aman) dan tidak ada parameter nama", () => {
    const url = buildAffiliateUrl(SEMUA[0]!, { email: "a+b@x.co" });
    expect(url.endsWith("&email=a%2Bb%40x.co")).toBe(true);
    expect(url).not.toContain("name=");
    expect(new URL(url).searchParams.get("email")).toBe("a+b@x.co");
  });

  it("tanpa email atau email kosong: tidak ada parameter email", () => {
    expect(buildAffiliateUrl(SEMUA[0]!, {})).not.toContain("email=");
    expect(buildAffiliateUrl(SEMUA[0]!, { email: "" })).not.toContain("email=");
  });

  it("email sintetis NISN (huruf besar/kecil) tidak dikirim; email biasa yang mirip tetap dikirim", () => {
    expect(buildAffiliateUrl(SEMUA[0]!, { email: "3155213156@nisn.ayotka.id" })).not.toContain("email=");
    expect(buildAffiliateUrl(SEMUA[0]!, { email: "3155213156@NISN.AYOTKA.ID" })).not.toContain("email=");
    expect(buildAffiliateUrl(SEMUA[0]!, { email: "budi@nisn.ayotka.id.contoh.com" })).toContain("email=");
    expect(buildAffiliateUrl(SEMUA[0]!, { email: "budi@ayotka.id" })).toContain("email=");
    expect([adalahEmailSintetis(null), adalahEmailSintetis(undefined), adalahEmailSintetis("")]).toEqual([false, false, false]);
  });
});

describe("halaman siswa: janji 'email terisi otomatis' sudah tidak ada", () => {
  const baca = (p: string) => readFileSync(p, "utf8");
  const wallet = baca("app/siswa/(shell)/wallet/page.tsx");
  const langganan = baca("app/siswa/(shell)/langganan/page.tsx");
  const apiCheckout = baca("app/api/siswa/checkout/route.ts");

  it("Wallet dan Langganan memakai petunjuk email dan tidak lagi menjanjikan pengisian otomatis atau 'beberapa detik'", () => {
    for (const [nama, sumber] of [["wallet", wallet], ["langganan", langganan]] as const) {
      expect(sumber, nama).toContain("<PetunjukEmailAffiliate");
      expect(sumber, nama).not.toContain("terisi otomatis saat checkout");
      expect(sumber, nama).not.toContain("beberapa detik");
      expect(sumber, nama).not.toContain("langsung terisi");
      expect(sumber, nama).toContain("5-10 menit");
    }
    expect(wallet).toContain('untuk="saldo"');
    expect(langganan).toContain('untuk="langganan"');
  });

  it("kedua API tidak lagi mengirim nama siswa ke tautan affiliate.id", () => {
    expect(baca("app/api/siswa/saldo/route.ts")).not.toMatch(/nama:\s*student\.nama/);
    expect(apiCheckout).not.toMatch(/nama:\s*student\.nama/);
  });

  it("jawaban API checkout (langganan) memuat email akun", () => {
    expect(apiCheckout).toMatch(/return NextResponse\.json\(\{\s*(\/\*\*[^]*?\*\/\s*)?email: user\.email,\s*jalur: student\.jalur/);
  });
});
