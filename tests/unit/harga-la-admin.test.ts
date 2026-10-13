import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getKonfig: vi.fn(),
  simpan: vi.fn(),
  logAudit: vi.fn(),
  kalibrasi: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/billing/saldo", () => ({
  getKonfigHargaLA: m.getKonfig,
  simpanKonfigHargaLA: m.simpan,
  tabelHargaLaBelumAda: (e: unknown) => typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2021",
}));

vi.mock("@/lib/billing/kalibrasi-ai", () => ({ muatKalibrasiAi: m.kalibrasi }));

import { GET, PATCH } from "@/app/api/admin-pusat/wallet-settings/route";
import { HargaLaPengaturan, KartuPemakaianAi, PratinjauHargaLA, keIsian, periksaIsianHargaLA } from "@/components/billing/harga-la-pengaturan";
import { teksHargaLA } from "@/lib/billing/harga-la-tampilan";
import { KONFIG_HARGA_LA_BAWAAN } from "@/lib/billing/harga-la";

const SAH = { hargaMin: 4_500, hargaMaks: 7_500, bebanRingan: 6_500, bebanBerat: 13_500 };
const kirim = (isi: unknown) =>
  PATCH(new Request("https://ayotka.id/api/admin-pusat/wallet-settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(isi) }));
const teks = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "admin-1", role: "admin_pusat" });
  m.getKonfig.mockResolvedValue(SAH);
  m.simpan.mockImplementation(async (k: unknown) => k);
  m.kalibrasi.mockResolvedValue(null);
});

describe("GET /api/admin-pusat/wallet-settings", () => {
  it("hanya admin pusat; selain itu 403 tanpa membaca apa pun", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await GET();
    expect(res.status).toBe(403);
    expect(m.requireRole).toHaveBeenCalledWith("admin_pusat");
    expect(m.getKonfig).not.toHaveBeenCalled();
  });

  it("mengirim pengaturan sekarang, nilai bawaan, dan ringkasan pemakaian AI nyata; tidak boleh di-cache", async () => {
    m.getKonfig.mockResolvedValue({ hargaMin: 5_000, hargaMaks: 8_000, bebanRingan: 5_000, bebanBerat: 20_000 });
    const kalibrasi = { hari: 30, jumlah: 12, rataTokenMasuk: 9_000, rataTokenKeluar: 800, rataTaksiran: 8_000, rasio: 1.13, totalTokenMasuk: 108_000, totalTokenKeluar: 9_600 };
    m.kalibrasi.mockResolvedValue(kalibrasi);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      konfig: { hargaMin: 5_000, hargaMaks: 8_000, bebanRingan: 5_000, bebanBerat: 20_000 },
      bawaan: KONFIG_HARGA_LA_BAWAAN,
      kalibrasi,
    });
  });

  it("belum ada token tercatat (atau migrasi belum diterapkan): kalibrasi null, pengaturan tetap terkirim", async () => {
    m.kalibrasi.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ konfig: SAH, kalibrasi: null });
  });

  it("hanya admin pusat yang boleh melihat ringkasan pemakaian AI: selain itu 403 tanpa membaca kalibrasi", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await GET()).status).toBe(403);
    expect(m.kalibrasi).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin-pusat/wallet-settings", () => {
  it("hanya admin pusat: 403 dan tidak ada yang tersimpan", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await kirim(SAH)).status).toBe(403);
    expect(m.simpan).not.toHaveBeenCalled();
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("pengaturan sah disimpan, dicatat di audit log (sebelum dan sesudah), dan dikembalikan", async () => {
    const baru = { hargaMin: 5_000, hargaMaks: 9_000, bebanRingan: 5_000, bebanBerat: 15_000 };
    const res = await kirim(baru);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ konfig: baru });
    expect(m.simpan).toHaveBeenCalledWith(baru);
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1", aksi: "update", entitas: "harga_la_pengaturan", entitasId: "global", before: SAH, after: baru }),
    );
  });

  it("pengaturan tidak sah ditolak 400 dengan pesan yang jelas, tanpa menyimpan", async () => {
    const kasus: Array<[unknown, string]> = [
      [{ ...SAH, hargaMin: 100 }, "Harga minimum minimal Rp500."],
      [{ ...SAH, hargaMaks: 4_000 }, "Harga maksimum tidak boleh lebih kecil dari harga minimum."],
      [{ ...SAH, bebanBerat: 6_500 }, "Batas beban berat harus lebih besar dari batas beban ringan."],
      [{ ...SAH, bebanRingan: 0 }, "Batas beban ringan minimal 100 token."],
      [{ soalRingan: 20, soalBerat: 50, hargaMin: 4_500, hargaMaks: 7_500 }, "Semua isian harus berupa angka bulat."], // bentuk lama berdasarkan jumlah soal
      [{ ...SAH, hargaMin: "4500" }, "Semua isian harus berupa angka bulat."],
      [{ hargaMin: 4_500 }, "Semua isian harus berupa angka bulat."],
      [{ hargaLearningAnalytics: 5_000 }, "Semua isian harus berupa angka bulat."], // bentuk lama (halaman admin lama yang masih terbuka)
      [null, "Semua isian harus berupa angka bulat."],
    ];
    for (const [isi, pesan] of kasus) {
      const res = await kirim(isi);
      expect(res.status, JSON.stringify(isi)).toBe(400);
      expect((await res.json()).error).toBe(pesan);
    }
    expect(m.simpan).not.toHaveBeenCalled();
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("isi bukan JSON ditolak 400", async () => {
    const res = await PATCH(new Request("https://ayotka.id/x", { method: "PATCH", body: "bukan json" }));
    expect(res.status).toBe(400);
    expect(m.simpan).not.toHaveBeenCalled();
  });

  it("migrasi belum diterapkan (tabel tidak ada): 503 dengan pesan jelas, bukan galat 500", async () => {
    m.simpan.mockRejectedValue(Object.assign(new Error("tabel tidak ada"), { code: "P2021" }));
    const res = await kirim(SAH);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("migrasi database");
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("galat lain dilempar (tidak ditelan)", async () => {
    m.simpan.mockRejectedValue(new Error("koneksi putus"));
    await expect(kirim(SAH)).rejects.toThrow("koneksi putus");
  });
});

describe("form pengaturan harga di Admin Pusat", () => {
  it("isian teks diperiksa: kosong, bukan angka, atau desimal dianggap tidak sah", () => {
    const sah = keIsian(SAH);
    expect(periksaIsianHargaLA(sah)).toEqual({ ok: true, konfig: SAH });
    for (const rusak of [{ ...sah, hargaMin: "" }, { ...sah, hargaMaks: "abc" }, { ...sah, bebanRingan: "20,5" }, { ...sah, bebanBerat: "  " }]) {
      expect(periksaIsianHargaLA(rusak), JSON.stringify(rusak)).toEqual({ ok: false, error: "Semua isian harus berupa angka bulat." });
    }
    expect(periksaIsianHargaLA({ ...sah, hargaMin: " 5000 " })).toMatchObject({ ok: true });
    expect(periksaIsianHargaLA({ ...sah, bebanBerat: "10" })).toMatchObject({ ok: false });
  });

  it("pratinjau menampilkan contoh harga menurut beban AI paket, sama dengan perhitungan server", () => {
    const t = teks(renderToStaticMarkup(createElement(PratinjauHargaLA, { isian: keIsian(SAH) })));
    expect(t).toContain("Contoh harga ke siswa menurut beban AI paket");
    const baris: Array<[string, string, string]> = [
      ["6.500", "19", "4.500"],
      ["8.250", "27", "5.500"],
      ["10.000", "35", "6.000"],
      ["11.750", "43", "7.000"],
      ["13.500", "50", "7.500"],
    ];
    for (const [beban, soal, harga] of baris) {
      expect(t).toMatch(new RegExp(`${beban.replace(".", "\\.")} token ${soal} soal biasa Rp\\s?${harga.replace(".", "\\.")}`));
    }
    expect(t).not.toContain("Pemakaian nyata kira-kira"); // tanpa data kalibrasi, kolom itu tidak ada
  });

  it("pratinjau dengan rasio pemakaian nyata: kolom 'Pemakaian nyata kira-kira' = beban x rasio", () => {
    const t = teks(renderToStaticMarkup(createElement(PratinjauHargaLA, { isian: keIsian(SAH), rasio: 1.2 })));
    expect(t).toContain("Pemakaian nyata kira-kira");
    expect(t).toMatch(/6\.500 token 19 soal biasa 7\.800 token Rp\s?4\.500/);
    expect(t).toMatch(/13\.500 token 50 soal biasa 16\.200 token Rp\s?7\.500/);
  });

  it("isian belum sah: pesan, bukan tabel", () => {
    const h = renderToStaticMarkup(createElement(PratinjauHargaLA, { isian: { ...keIsian(SAH), hargaMaks: "1000" } }));
    expect(teks(h)).toContain("Pratinjau belum bisa ditampilkan: Harga maksimum tidak boleh lebih kecil dari harga minimum.");
    expect(h).not.toContain("<table");
  });

  it("sebelum data dimuat: keterangan 'Memuat', belum ada isian; petunjuk kelipatan Rp500 untuk harga ada di form", () => {
    const awal = renderToStaticMarkup(createElement(HargaLaPengaturan));
    expect(teks(awal)).toContain("Harga Learning Analytics Tambahan");
    expect(teks(awal)).toContain("Memuat pengaturan harga...");
    expect(awal).not.toContain("<form");
    // isi form hanya muncul sesudah data dimuat (efek tidak jalan di render server), jadi petunjuknya diperiksa pada sumber
    const sumber = readFileSync("components/billing/harga-la-pengaturan.tsx", "utf8");
    expect(sumber).toContain("diisi dalam kelipatan Rp{LANGKAH_HARGA_LA}");
  });

  it("kartu pemakaian AI: angka nyata, taksiran, dan kesimpulan; tanpa data = penjelasan, bukan angka kosong", () => {
    const k = { hari: 30, jumlah: 25, rataTokenMasuk: 9_600, rataTokenKeluar: 810, rataTaksiran: 8_000, rasio: 1.2, totalTokenMasuk: 240_000, totalTokenKeluar: 20_250 };
    const t = teks(renderToStaticMarkup(createElement(KartuPemakaianAi, { kalibrasi: k })));
    expect(t).toContain("Pemakaian AI sebenarnya (30 hari terakhir)");
    for (const x of ["25", "9.600", "8.000", "810", "20% LEBIH BESAR dari taksiran"]) expect(t).toContain(x);
    expect(t).not.toContain("idealnya minimal"); // 25 analisis cukup

    const sedikit = teks(renderToStaticMarkup(createElement(KartuPemakaianAi, { kalibrasi: { ...k, jumlah: 3 } })));
    expect(sedikit).toContain("Baru 3 analisis tercatat");

    const kosong = teks(renderToStaticMarkup(createElement(KartuPemakaianAi, { kalibrasi: null })));
    expect(kosong).toContain("Belum ada analisis yang tercatat tokennya");
    expect(kosong).not.toContain("NaN");
  });

  it("halaman Paket & Rekening memakai komponen baru dan tidak lagi menyimpan 'harga dasar' atau 'margin'", () => {
    const halaman = readFileSync("app/admin-pusat/langganan/page.tsx", "utf8");
    expect(halaman).toContain("<HargaLaPengaturan />");
    expect(halaman).not.toMatch(/Margin Keuntungan|marginLearningAnalyticsPersen|hargaLearningAnalytics|handleSaveHargaLa/);
  });
});

describe("teks harga di halaman Wallet siswa", () => {
  it("rentang menurut beban AI paket, dengan penjelasan dan janji harga pasti tampil sebelum dipakai", () => {
    const t = teksHargaLA({ hargaLaMin: 4_500, hargaLaMaks: 7_500, hargaLearningAnalytics: 4_500 });
    expect(t).toMatch(/Rp\s?4\.500 - Rp\s?7\.500/);
    expect(t).toContain("tergantung besarnya paket soal");
    expect(t).toContain("Harga pastinya tampil sebelum kamu memakainya");
  });

  it("minimum = maksimum: satu harga saja", () => {
    expect(teksHargaLA({ hargaLaMin: 5_000, hargaLaMaks: 5_000, hargaLearningAnalytics: 5_000 })).toMatch(/^Satu Learning Analytics tambahan = Rp\s?5\.000$/);
  });

  it("server lama yang belum mengirim rentang: jatuh ke satu harga lama, tidak 'NaN'", () => {
    const t = teksHargaLA({ hargaLearningAnalytics: 9_000 });
    expect(t).toMatch(/Rp\s?9\.000/);
    expect(t).not.toContain("NaN");
  });
});
