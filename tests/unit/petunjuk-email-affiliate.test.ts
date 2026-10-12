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

const teks = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const render = (props: { email: string | null | undefined; untuk: "saldo" | "langganan" }) => renderToStaticMarkup(createElement(PetunjukEmailAffiliate, props));

describe("PetunjukEmailAffiliate", () => {
  it("menampilkan email akun untuk disalin, menyebut kedua kolom, harus sama persis, dan jumlah beli 1", () => {
    const h = render({ email: "budi@example.com", untuk: "saldo" });
    const t = teks(h);
    expect(t).toContain("budi@example.com");
    expect(t).toContain("Email dan Konfirmasi Email");
    expect(t).toContain("sama persis");
    expect(t).toContain("jumlah beli 1");
    expect(h).toContain(">Salin<");
    expect(t).not.toContain("terisi otomatis");
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

  it("bukan siswa: 403 dan tidak membocorkan email", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await saldoGet();
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain("@");
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

  it("jawaban API checkout (langganan) memuat email akun", () => {
    expect(apiCheckout).toMatch(/return NextResponse\.json\(\{\s*(\/\*\*[^]*?\*\/\s*)?email: user\.email,\s*jalur: student\.jalur/);
  });
});
