import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LencanaKeanggotaan } from "@/components/layout/lencana-keanggotaan";
import { LABEL_KEANGGOTAAN, tentukanKeanggotaan, type AksesUntukKeanggotaan } from "@/lib/billing/keanggotaan-label";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  getActiveEntitlement: vi.fn(),
  kursiSekolahTersedia: vi.fn(),
  planFindUnique: vi.fn(),
  ambilPeriodeSekolah: vi.fn(),
  pilihPeriodeBerjalan: vi.fn(),
}));
vi.mock("@/lib/billing/entitlements", () => ({ getActiveEntitlement: m.getActiveEntitlement, kursiSekolahTersedia: m.kursiSekolahTersedia }));
vi.mock("@/lib/billing/periode-sekolah", () => ({ ambilPeriodeSekolah: m.ambilPeriodeSekolah, pilihPeriodeBerjalan: m.pilihPeriodeBerjalan }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { plan: { findUnique: m.planFindUnique } } }));

const SEKARANG = new Date("2026-10-16T05:00:00.000Z");
const jam = 3_600_000;
const akses = (o: Partial<AksesUntukKeanggotaan> = {}): AksesUntukKeanggotaan => ({
  source: "invoice",
  planKode: "monthly",
  startsAt: new Date(SEKARANG.getTime() - 24 * jam),
  endsAt: new Date(SEKARANG.getTime() + 24 * jam),
  ...o,
});

describe("tentukanKeanggotaan", () => {
  it("tanpa akses sama sekali: Member Gratis tanpa tanggal", () => {
    expect(tentukanKeanggotaan(null, SEKARANG)).toEqual({ jenis: "gratis", label: "Member Gratis", berlakuSampai: null });
  });

  it.each([
    ["monthly", "invoice", "bulanan", "Member Bulanan"],
    ["semester", "invoice", "semester", "Member Semester"],
    ["monthly", "voucher", "bulanan", "Member Bulanan"],
    ["semester", "voucher", "semester", "Member Semester"],
    ["school", "school_seat", "sekolah", "Member Sekolah"],
  ] as const)("plan %s lewat %s: %s", (planKode, source, jenis, label) => {
    const hasil = tentukanKeanggotaan(akses({ planKode, source }), SEKARANG);
    expect(hasil.jenis).toBe(jenis);
    expect(hasil.label).toBe(label);
    expect(hasil.berlakuSampai).toBe(new Date(SEKARANG.getTime() + 24 * jam).toISOString());
  });

  it("kursi sekolah menang atas kode plan: source school_seat tetap Member Sekolah", () => {
    expect(tentukanKeanggotaan(akses({ source: "school_seat", planKode: "semester" }), SEKARANG).jenis).toBe("sekolah");
  });

  it("plan 'school' yang bukan lewat kursi juga Member Sekolah", () => {
    expect(tentukanKeanggotaan(akses({ source: "invoice", planKode: "school" }), SEKARANG).jenis).toBe("sekolah");
  });

  it("sudah berakhir: kembali Member Gratis (bukan label paket lama)", () => {
    const hasil = tentukanKeanggotaan(akses({ planKode: "semester", endsAt: new Date(SEKARANG.getTime() - 1) }), SEKARANG);
    expect(hasil).toEqual({ jenis: "gratis", label: "Member Gratis", berlakuSampai: null });
  });

  it("tepat di akhir masa berlaku masih aktif (sama dengan aturan akses ujian: now <= endsAt)", () => {
    const hasil = tentukanKeanggotaan(akses({ planKode: "semester", endsAt: new Date(SEKARANG.getTime()) }), SEKARANG);
    expect(hasil.jenis).toBe("semester");
  });

  it("belum mulai (paket pribadi yang ditunda): belum dihitung sebagai anggota", () => {
    const hasil = tentukanKeanggotaan(akses({ startsAt: new Date(SEKARANG.getTime() + jam) }), SEKARANG);
    expect(hasil.jenis).toBe("gratis");
  });

  it("tepat saat mulai sudah aktif", () => {
    expect(tentukanKeanggotaan(akses({ startsAt: new Date(SEKARANG.getTime()) }), SEKARANG).jenis).toBe("bulanan");
  });

  it("plan 'free' tidak pernah dianggap anggota berbayar", () => {
    expect(tentukanKeanggotaan(akses({ planKode: "free" }), SEKARANG).jenis).toBe("gratis");
  });

  it("empat label baku", () => {
    expect(LABEL_KEANGGOTAAN).toEqual({
      gratis: "Member Gratis",
      bulanan: "Member Bulanan",
      semester: "Member Semester",
      sekolah: "Member Sekolah",
    });
  });
});

describe("LencanaKeanggotaan", () => {
  const render = (jenis: "gratis" | "bulanan" | "semester" | "sekolah", keterangan = "Lihat paket langganan") =>
    renderToStaticMarkup(
      createElement(LencanaKeanggotaan, { lencana: { jenis, label: LABEL_KEANGGOTAAN[jenis], keterangan, href: "/siswa/langganan" } }),
    );

  it("tautan ke halaman Langganan dengan label lengkap, singkatan untuk layar sempit, dan nama aksesibel", () => {
    const h = render("gratis");
    expect(h).toContain('href="/siswa/langganan"');
    expect(h).toContain('data-lencana-keanggotaan="gratis"');
    expect(h).toContain("Member Gratis");
    expect(h).toMatch(/min-\[420px\]:hidden[^>]*>Gratis</);
    expect(h).toContain('aria-label="Member Gratis. Lihat paket langganan"');
  });

  it("anggota berbayar membawa tanggal berlaku di keterangan", () => {
    const h = render("semester", "Berlaku sampai 20 November 2026");
    expect(h).toContain('data-lencana-keanggotaan="semester"');
    expect(h).toContain("Berlaku sampai 20 November 2026");
    expect(h).toContain("Member Semester");
  });

  it("Member Gratis polos tanpa ikon; anggota berbayar punya ikon", () => {
    expect(render("gratis")).not.toContain("<svg");
    for (const jenis of ["bulanan", "semester", "sekolah"] as const) expect(render(jenis)).toContain("<svg");
  });

  it("tiap jenis punya warna sendiri (bukan satu gaya untuk semua)", () => {
    const kelas = new Set(["gratis", "bulanan", "semester", "sekolah"].map((j) => render(j as "gratis").match(/class="([^"]*)"/)![1]));
    expect(kelas.size).toBe(4);
  });
});

describe("getKeanggotaanSiswa", () => {
  type SiswaUji = { id: string; schoolId: string | null; jalur: "A" | "B"; deletedAt: Date | null; lulusAt: Date | null };
  const SISWA_B: SiswaUji = { id: "siswa-1", schoolId: "sekolah-asal", jalur: "B", deletedAt: null, lulusAt: null };
  const SISWA_A: SiswaUji = { id: "siswa-2", schoolId: "sekolah-1", jalur: "A", deletedAt: null, lulusAt: null };
  const akhirPeriode = new Date(SEKARANG.getTime() + 60 * 24 * jam);
  const entitlement = (o: Record<string, unknown> = {}) => ({
    entitlement: { planId: "plan-1", source: "invoice", startsAt: new Date(SEKARANG.getTime() - jam), endsAt: new Date(SEKARANG.getTime() + jam), ...o },
  });

  beforeEach(() => {
    vi.resetAllMocks();
    m.kursiSekolahTersedia.mockResolvedValue(false);
    m.ambilPeriodeSekolah.mockResolvedValue([]);
    m.pilihPeriodeBerjalan.mockReturnValue({ berakhir: akhirPeriode });
  });

  const ambil = async (siswa: SiswaUji) => (await import("@/lib/billing/keanggotaan")).getKeanggotaanSiswa(siswa, SEKARANG);

  it("akses pribadi yang sedang berlaku: membaca kode plan-nya dan TIDAK memeriksa kursi sekolah", async () => {
    m.getActiveEntitlement.mockResolvedValue(entitlement());
    m.planFindUnique.mockResolvedValue({ kode: "semester" });
    expect((await ambil(SISWA_B)).jenis).toBe("semester");
    expect(m.planFindUnique).toHaveBeenCalledWith({ where: { id: "plan-1" }, select: { kode: true } });
    expect(m.kursiSekolahTersedia).not.toHaveBeenCalled();
  });

  it("paket pribadi menang atas kursi sekolah yang tersedia (sama dengan tipe akses ujian)", async () => {
    m.getActiveEntitlement.mockResolvedValue(entitlement());
    m.planFindUnique.mockResolvedValue({ kode: "monthly" });
    m.kursiSekolahTersedia.mockResolvedValue(true);
    expect((await ambil(SISWA_A)).jenis).toBe("bulanan");
  });

  it("siswa mandiri tanpa akses: Member Gratis", async () => {
    m.getActiveEntitlement.mockResolvedValue(null);
    expect(await ambil(SISWA_B)).toEqual({ jenis: "gratis", label: "Member Gratis", berlakuSampai: null });
    expect(m.planFindUnique).not.toHaveBeenCalled();
  });

  it("siswa sekolah ditanggung sekolahnya tetapi kursinya belum dibuat: Member Sekolah (bukan Gratis), dengan akhir periode", async () => {
    m.getActiveEntitlement.mockResolvedValue(null);
    m.kursiSekolahTersedia.mockResolvedValue(true);
    expect(await ambil(SISWA_A)).toEqual({ jenis: "sekolah", label: "Member Sekolah", berlakuSampai: akhirPeriode.toISOString() });
    expect(m.kursiSekolahTersedia).toHaveBeenCalledWith(SISWA_A, SEKARANG);
    expect(m.ambilPeriodeSekolah).toHaveBeenCalledWith(expect.anything(), "sekolah-1");
  });

  it("akses sekolah yang sudah berakhir tetapi periode sekolah masih berjalan: tetap Member Sekolah", async () => {
    m.getActiveEntitlement.mockResolvedValue(entitlement({ source: "school_seat", endsAt: new Date(SEKARANG.getTime() - jam) }));
    m.planFindUnique.mockResolvedValue({ kode: "school" });
    m.kursiSekolahTersedia.mockResolvedValue(true);
    expect((await ambil(SISWA_A)).jenis).toBe("sekolah");
  });

  it("masa tenggang sekolah (akhir periode sudah lewat): Member Sekolah tanpa tanggal berlaku", async () => {
    m.getActiveEntitlement.mockResolvedValue(null);
    m.kursiSekolahTersedia.mockResolvedValue(true);
    m.pilihPeriodeBerjalan.mockReturnValue({ berakhir: new Date(SEKARANG.getTime() - 2 * 24 * jam) });
    expect(await ambil(SISWA_A)).toEqual({ jenis: "sekolah", label: "Member Sekolah", berlakuSampai: null });
  });

  it("alumni / kuota sekolah penuh / sekolah berhenti (kursi tidak tersedia): Member Gratis", async () => {
    m.getActiveEntitlement.mockResolvedValue(null);
    m.kursiSekolahTersedia.mockResolvedValue(false);
    expect((await ambil(SISWA_A)).jenis).toBe("gratis");
  });

  it("paket pribadi sudah berakhir dan sekolah tidak menanggung: Member Gratis", async () => {
    m.getActiveEntitlement.mockResolvedValue(entitlement({ endsAt: new Date(SEKARANG.getTime() - jam) }));
    m.planFindUnique.mockResolvedValue({ kode: "semester" });
    expect((await ambil(SISWA_B)).jenis).toBe("gratis");
  });

  it("siswa tanpa sekolah: kursi sekolah tidak diperiksa", async () => {
    m.getActiveEntitlement.mockResolvedValue(null);
    expect((await ambil({ ...SISWA_B, schoolId: null })).jenis).toBe("gratis");
    expect(m.kursiSekolahTersedia).not.toHaveBeenCalled();
  });

  it("plan tidak ditemukan dan tidak ditanggung sekolah: jatuh ke Member Gratis", async () => {
    m.getActiveEntitlement.mockResolvedValue(entitlement({ planId: "hilang" }));
    m.planFindUnique.mockResolvedValue(null);
    expect((await ambil(SISWA_B)).jenis).toBe("gratis");
  });

  it("galat database tidak merusak halaman: jatuh ke Member Gratis dan dicatat", async () => {
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    m.getActiveEntitlement.mockRejectedValue(new Error("db mati"));
    expect((await ambil(SISWA_A)).jenis).toBe("gratis");
    expect(galat).toHaveBeenCalled();
    galat.mockRestore();
  });

  it("galat saat memeriksa kursi sekolah juga tidak merusak halaman", async () => {
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    m.getActiveEntitlement.mockResolvedValue(null);
    m.kursiSekolahTersedia.mockRejectedValue(new Error("db mati"));
    expect((await ambil(SISWA_A)).jenis).toBe("gratis");
    galat.mockRestore();
  });
});
