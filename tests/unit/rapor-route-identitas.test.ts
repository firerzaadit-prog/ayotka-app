import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  loadOwnedAttempt: vi.fn(),
  buildHasil: vi.fn(),
  muatIdentitas: vi.fn(),
  aiFindUnique: vi.fn(),
  renderRapor: vi.fn(),
  fetchLogo: vi.fn(),
  logoDisk: vi.fn(),
  fokus: vi.fn(),
  attemptFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/schools/scope", () => ({ resolveSchoolId: vi.fn() }));
vi.mock("@/lib/students/kelolaan", () => ({ bisaDikelolaAdmin: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { aiAnalysis: { findUnique: m.aiFindUnique }, attempt: { findUnique: m.attemptFindUnique } } }));
vi.mock("@/lib/billing/fokus-belajar", () => ({ hitungFokusBelajarDibuka: m.fokus }));
vi.mock("@/lib/exam/attempt-access", () => ({ loadOwnedAttempt: m.loadOwnedAttempt }));
vi.mock("@/lib/exam/hasil", () => ({ buildHasil: m.buildHasil }));
vi.mock("@/lib/exam/identitas-rapor", () => ({ muatIdentitasRapor: m.muatIdentitas }));
vi.mock("@/lib/pdf/logo", () => ({ muatLogoPdf: m.logoDisk }));
vi.mock("@/lib/pdf/rapor-renderer", () => ({ renderRaporPdf: m.renderRapor, fetchImageBuffer: m.fetchLogo }));

import { GET } from "@/app/api/siswa/attempts/[id]/rapor/route";

const ctx = { params: Promise.resolve({ id: "att-1" }) };
const minta = () => GET(new Request("http://localhost/api/siswa/attempts/att-1/rapor"), ctx);
const MULAI = new Date("2026-10-12T08:38:00.000Z");
const IDENTITAS = { asalSekolah: "SDN Sukun 3 Malang", jenisTryOut: "nasional", mataPelajaran: "Matematika", jenjang: "SD", kodeSoal: "MAT-SD-PT1", mulaiAt: MULAI, selesaiAt: null };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  m.requireRole.mockResolvedValue({ id: "user-1", role: "siswa" });
  m.loadOwnedAttempt.mockResolvedValue({ id: "att-1", status: "selesai", mulaiAt: MULAI, selesaiAt: null });
  m.buildHasil.mockResolvedValue({ bisaUnduhRapor: true, isFreeTrial: false, analisisAiDiminta: false, siswa: { nama: "Budi Santoso", idSamar: "008***42" } });
  m.muatIdentitas.mockResolvedValue(IDENTITAS);
  m.aiFindUnique.mockResolvedValue({ detailJson: { ringkasan: "r" }, generatedAt: new Date() });
  m.renderRapor.mockImplementation(async (doc: PDFKit.PDFDocument) => {
    doc.text("isi rapor uji");
  });
  m.fetchLogo.mockResolvedValue(null);
  m.logoDisk.mockResolvedValue(null);
  m.fokus.mockResolvedValue(true);
});

describe("GET /api/siswa/attempts/[id]/rapor - identitas dan nama berkas", () => {
  it("identitas dimuat dan diteruskan ke pembuat PDF; berkasnya PDF dengan nama aman memuat jenis Try Out dan tanggal ujian", async () => {
    const res = await minta();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="Rapor-Budi-Santoso-Try-Out-Nasional-2026-10-12.pdf"');
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
    expect(m.muatIdentitas).toHaveBeenCalledWith(expect.objectContaining({ id: "att-1" }));
    const [, hasil, analisis, logo, identitas] = m.renderRapor.mock.calls[0]!;
    expect(hasil).toMatchObject({ siswa: { nama: "Budi Santoso" } });
    expect(analisis).toMatchObject({ detailJson: { ringkasan: "r" } });
    expect(logo).toBeNull();
    expect(identitas).toEqual(IDENTITAS);
  });

  it("logo dibaca dari disk dulu; alamat publik hanya cadangan bila berkas tidak ada", async () => {
    const dariDisk = Buffer.from("logo-disk");
    m.logoDisk.mockResolvedValue(dariDisk);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://contoh.test");
    await minta();
    expect(m.renderRapor.mock.calls[0]![3]).toBe(dariDisk);
    expect(m.fetchLogo).not.toHaveBeenCalled();

    m.renderRapor.mockClear();
    m.logoDisk.mockResolvedValue(null);
    const dariAlamat = Buffer.from("logo-alamat");
    m.fetchLogo.mockResolvedValue(dariAlamat);
    await minta();
    expect(m.fetchLogo).toHaveBeenCalledWith("https://contoh.test/logo.png");
    expect(m.renderRapor.mock.calls[0]![3]).toBe(dariAlamat);
  });

  it("identitas gagal dimuat: rapor tetap jadi (bagian itu '-'), galat dicatat di log", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.muatIdentitas.mockRejectedValue(new Error("DB putus"));
    const res = await minta();
    expect(res.status).toBe(200);
    expect(m.renderRapor.mock.calls[0]![4]).toBeNull();
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="Rapor-Budi-Santoso-2026-10-12.pdf"');
    expect(vi.mocked(console.error).mock.calls.some((c) => String(c[0]).includes("identitas rapor"))).toBe(true);
  });

  it("nama siswa dengan tanda kutip atau baris baru tidak merusak header unduhan", async () => {
    m.buildHasil.mockResolvedValue({ bisaUnduhRapor: true, isFreeTrial: false, analisisAiDiminta: false, siswa: { nama: 'A"B\r\nX-Injeksi: 1', idSamar: "x" } });
    const res = await minta();
    const header = res.headers.get("content-disposition")!;
    expect(header).toMatch(/^attachment; filename="[A-Za-z0-9.-]+\.pdf"$/);
    expect(header).not.toMatch(/[\r\n]/);
  });

  it("gerbang lama tetap berlaku: bukan siswa pemilik 403/404, belum selesai 400, percobaan ke-2 mandiri 409, tanpa memuat identitas", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await minta()).status).toBe(403);
    m.requireRole.mockResolvedValue({ id: "user-1", role: "siswa" });
    m.loadOwnedAttempt.mockResolvedValue(null);
    expect((await minta()).status).toBe(404);
    m.loadOwnedAttempt.mockResolvedValue({ id: "att-1", status: "berjalan", mulaiAt: MULAI });
    expect((await minta()).status).toBe(400);
    m.loadOwnedAttempt.mockResolvedValue({ id: "att-1", status: "selesai", mulaiAt: MULAI });
    m.buildHasil.mockResolvedValue({ bisaUnduhRapor: false });
    expect((await minta()).status).toBe(409);
    expect(m.muatIdentitas).not.toHaveBeenCalled();
    expect(m.renderRapor).not.toHaveBeenCalled();
  });

  it("siswa gratis tanpa Learning Analytics tidak mendapat analisis di PDF (sama ketatnya dengan web)", async () => {
    m.buildHasil.mockResolvedValue({ bisaUnduhRapor: true, isFreeTrial: true, analisisAiDiminta: false, siswa: { nama: "Budi", idSamar: "x" } });
    await minta();
    expect(m.aiFindUnique).not.toHaveBeenCalled();
    expect(m.renderRapor.mock.calls[0]![2]).toBeNull();
  });
});

describe("GET /api/siswa/attempts/[id]/rapor - Prioritas belajar & Kekuatan (fitur berbayar)", () => {
  it("siswa tanpa jatah/saldo Learning Analytics: PDF dirender tanpa bagian itu, putusan dihitung dari percobaan siswa itu", async () => {
    m.fokus.mockResolvedValue(false);
    const res = await minta();
    expect(res.status).toBe(200);
    expect(m.fokus).toHaveBeenCalledTimes(1);
    expect(m.fokus).toHaveBeenCalledWith(expect.objectContaining({ id: "att-1" }));
    expect(m.renderRapor.mock.calls[0]![5]).toEqual({ tampilkanFokus: false });
  });

  it("siswa yang berhak (jatah/saldo/analisis ada): bagian itu ikut dicetak", async () => {
    m.fokus.mockResolvedValue(true);
    await minta();
    expect(m.renderRapor.mock.calls[0]![5]).toEqual({ tampilkanFokus: true });
  });

  it("admin pusat mengunduh rapor siswa: tidak digerbang dan saldo siswa tidak dibaca", async () => {
    m.requireRole.mockResolvedValue({ id: "admin-1", role: "admin_pusat" });
    m.attemptFindUnique.mockResolvedValue({ id: "att-1", status: "selesai", mulaiAt: MULAI, selesaiAt: null, student: { id: "s-1" } });
    m.fokus.mockResolvedValue(false); // andaikan siswanya tak berhak: tetap tidak dipakai untuk admin
    const res = await minta();
    expect(res.status).toBe(200);
    expect(m.fokus).not.toHaveBeenCalled();
    expect(m.renderRapor.mock.calls[0]![5]).toEqual({ tampilkanFokus: true });
  });
});
