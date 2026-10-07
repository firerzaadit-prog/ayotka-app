import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  logAudit: vi.fn(),
  checkRateLimit: vi.fn(),
  simpanMaster: vi.fn(),
  ringkasMaster: vi.fn(),
  sinkron: vi.fn(),
  getIndikatorPaket: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { penanda: "prisma-tiruan" } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.checkRateLimit }));
vi.mock("@/lib/indikator/master-simpan", () => ({ simpanMaster: m.simpanMaster, ringkasMaster: m.ringkasMaster }));
vi.mock("@/lib/indikator/sinkron-soal", () => ({ sinkronkanIndikatorSoal: m.sinkron }));
vi.mock("@/lib/soal-import/source-db", () => ({ getIndikatorPaket: m.getIndikatorPaket }));

import { GET as getRingkasan } from "@/app/api/admin-pusat/indikator/route";
import { POST as postMaster } from "@/app/api/admin-pusat/indikator/master/route";
import { POST as postSinkron } from "@/app/api/admin-pusat/indikator/sinkron/route";

const BARIS = {
  jenjang: "SMP",
  kd_mapel: "MATP",
  nama_mapel: "Matematika",
  elemen: "Bilangan",
  subelemen: "Bilangan Real",
  kompetensi: "Kemampuan X",
  subkompetensi: "-",
  indikator: "Menyelesaikan operasi bilangan bentuk pangkat (1)",
  urutan: 1,
  nilai_nasional: 34.09,
};

const reqMaster = (isi: unknown, headers: Record<string, string> = {}) =>
  new Request("https://ayotka.id/api/admin-pusat/indikator/master", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof isi === "string" ? isi : JSON.stringify(isi),
  });
const reqKosong = () => new Request("https://ayotka.id/api/admin-pusat/indikator/sinkron", { method: "POST" });

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "admin-1", role: "admin_pusat" });
  m.checkRateLimit.mockReturnValue(true);
  m.simpanMaster.mockResolvedValue({ total: 1, dibuat: 1, diperbarui: 0, samaPersis: 0, tidakAdaDiBerkas: 0 });
  m.ringkasMaster.mockResolvedValue({ mapel: [], totalIndikator: 0, diperbaruiTerakhir: null, soal: { tertaut: 0, diLuarResmi: 0, tanpaIndikator: 0 } });
  m.sinkron.mockResolvedValue({ masterKosong: false, paket: [], total: { soal: 0, tertaut: 0, baruTertaut: 0, terisiDariSumber: 0, diLuarResmi: 0 } });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("GET /api/admin-pusat/indikator", () => {
  it("hanya admin pusat: selain itu 403 dan tidak membaca data", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await getRingkasan();
    expect(res.status).toBe(403);
    expect(m.ringkasMaster).not.toHaveBeenCalled();
    m.requireRole.mockResolvedValue({ id: "a", role: "admin_pusat" });
    await getRingkasan();
    expect(m.requireRole).toHaveBeenLastCalledWith("admin_pusat");
  });

  it("mengembalikan ringkasan", async () => {
    const res = await getRingkasan();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ringkasan: expect.objectContaining({ totalIndikator: 0 }) });
  });
});

describe("POST /api/admin-pusat/indikator/master", () => {
  it("403 tanpa hak admin pusat, tanpa membaca isi atau menyimpan apa pun", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await postMaster(reqMaster([BARIS]));
    expect(res.status).toBe(403);
    expect(m.simpanMaster).not.toHaveBeenCalled();
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("429 bila melewati batas permintaan", async () => {
    m.checkRateLimit.mockReturnValue(false);
    const res = await postMaster(reqMaster([BARIS]));
    expect(res.status).toBe(429);
    expect(m.simpanMaster).not.toHaveBeenCalled();
  });

  it("413 bila content-length melebihi 2 MB (tanpa membaca isi)", async () => {
    const res = await postMaster(reqMaster([BARIS], { "content-length": String(3_000_000) }));
    expect(res.status).toBe(413);
    expect(m.simpanMaster).not.toHaveBeenCalled();
  });

  it("413 bila isi sebenarnya melebihi 2 MB walau header tidak jujur", async () => {
    const besar = JSON.stringify([{ ...BARIS, indikator: "x".repeat(2_100_000) }]);
    const res = await postMaster(reqMaster(besar));
    expect(res.status).toBe(413);
    expect(m.simpanMaster).not.toHaveBeenCalled();
  });

  it("400 bila bukan JSON", async () => {
    const res = await postMaster(reqMaster("ini bukan json {"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/bukan JSON/);
    expect(m.simpanMaster).not.toHaveBeenCalled();
  });

  it("400 bila JSON bukan larik", async () => {
    const res = await postMaster(reqMaster({ data: [BARIS] }));
    expect(res.status).toBe(400);
    expect((await res.json()).galat[0]).toMatch(/larik/);
    expect(m.simpanMaster).not.toHaveBeenCalled();
  });

  it("400 dengan daftar galat per baris bila ada baris cacat; SATU baris cacat menolak seluruh berkas", async () => {
    const res = await postMaster(reqMaster([BARIS, { ...BARIS, jenjang: "XX", indikator: "Lain (2)" }]));
    expect(res.status).toBe(400);
    const isi = await res.json();
    expect(isi.error).toMatch(/tidak ada yang disimpan/);
    expect(isi.galat.join("\n")).toMatch(/Baris 2: jenjang/);
    expect(m.simpanMaster).not.toHaveBeenCalled();
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("berkas sah: disimpan dalam bentuk yang sudah divalidasi, dicatat di audit, hasil dikembalikan", async () => {
    const res = await postMaster(reqMaster([BARIS]));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hasil: { total: 1, dibuat: 1, diperbarui: 0, samaPersis: 0, tidakAdaDiBerkas: 0 } });
    expect(m.simpanMaster).toHaveBeenCalledTimes(1);
    const [db, baris] = m.simpanMaster.mock.calls[0]!;
    expect(db).toEqual({ penanda: "prisma-tiruan" });
    expect(baris).toEqual([
      expect.objectContaining({ jenjang: "SMP", namaMapel: "Matematika", subkompetensi: null, nilaiNasional: 34.09, teksKunci: "menyelesaikan operasi bilangan bentuk pangkat (1)" }),
    ]);
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1", aksi: "update", entitas: "indikator_resmi", entitasId: "master", ip: "1.2.3.4" }),
    );
  });

  it("galat database: 500 dengan pesan aman, tanpa audit, tanpa membocorkan detail", async () => {
    m.simpanMaster.mockRejectedValue(new Error("password authentication failed for user postgres"));
    const res = await postMaster(reqMaster([BARIS]));
    expect(res.status).toBe(500);
    const isi = await res.json();
    expect(JSON.stringify(isi)).not.toMatch(/password|postgres/);
    expect(m.logAudit).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin-pusat/indikator/sinkron", () => {
  it("403 tanpa hak admin pusat", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await postSinkron(reqKosong());
    expect(res.status).toBe(403);
    expect(m.sinkron).not.toHaveBeenCalled();
  });

  it("429 bila melewati batas permintaan", async () => {
    m.checkRateLimit.mockReturnValue(false);
    const res = await postSinkron(reqKosong());
    expect(res.status).toBe(429);
    expect(m.sinkron).not.toHaveBeenCalled();
  });

  it("menjalankan sinkronisasi dengan database dan pembaca sumber yang benar, lalu mencatat audit", async () => {
    const res = await postSinkron(reqKosong());
    expect(res.status).toBe(200);
    expect((await res.json()).laporan.masterKosong).toBe(false);
    expect(m.sinkron).toHaveBeenCalledWith({ penanda: "prisma-tiruan" }, m.getIndikatorPaket);
    expect(m.logAudit).toHaveBeenCalledWith(expect.objectContaining({ entitas: "questions", entitasId: "sinkron-indikator", aksi: "update" }));
  });

  it("master belum diunggah: laporan apa adanya dan TIDAK ada catatan audit (tidak ada yang berubah)", async () => {
    m.sinkron.mockResolvedValue({ masterKosong: true, paket: [], total: { soal: 0, tertaut: 0, baruTertaut: 0, terisiDariSumber: 0, diLuarResmi: 0 } });
    const res = await postSinkron(reqKosong());
    expect(res.status).toBe(200);
    expect((await res.json()).laporan.masterKosong).toBe(true);
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("galat tak terduga: 500 dengan pesan aman", async () => {
    m.sinkron.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));
    const res = await postSinkron(reqKosong());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);
  });
});
