import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  logAudit: vi.fn(),
  bebasFindMany: vi.fn(),
  bebasFindUnique: vi.fn(),
  bebasCreate: vi.fn(),
  sekolahFindMany: vi.fn(),
  sekolahFindUnique: vi.fn(),
  urutan: [] as string[],
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    invoiceBebas: { findMany: m.bebasFindMany, findUnique: m.bebasFindUnique, create: m.bebasCreate },
    schoolInvoice: { findMany: m.sekolahFindMany, findUnique: m.sekolahFindUnique },
  },
}));

import { GET as riwayatGET, POST as terbitkanPOST } from "@/app/api/admin-pusat/invoice-bebas/route";
import { POST as pratinjauPOST } from "@/app/api/admin-pusat/invoice-bebas/pratinjau/route";
import { GET as nomorGET } from "@/app/api/admin-pusat/invoice-bebas/nomor/route";
import { GET as dataGET } from "@/app/api/admin-pusat/invoice-bebas/[id]/route";
import { GET as pdfGET } from "@/app/api/admin-pusat/invoice-bebas/[id]/pdf/route";
import { invoiceBebasSchema, isianAwalInvoiceBebas, type InvoiceBebasForm } from "@/lib/invoice/bebas";

const ADMIN = { id: "admin-1", role: "admin_pusat", email: "pusat@ayotka.id" };
const ID = "3f9c2a64-1b7e-4c58-9d0a-5e2b8f7a1c34";

function isian(ubah: (f: InvoiceBebasForm) => void = () => {}): InvoiceBebasForm {
  const f = isianAwalInvoiceBebas(new Date("2026-11-10T03:00:00.000Z")); // November: bebas dari nomor yang terpakai di luar aplikasi
  f.penerima = { nama: "MTsN 1 Kediri", alamat: "Pare, Kediri", up: "" };
  ubah(f);
  return f;
}
const json = (body: unknown) =>
  new Request("http://localhost:3100/api/admin-pusat/invoice-bebas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const adalahPdf = async (res: Response) => Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString() === "%PDF-";

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue(ADMIN);
  m.bebasFindMany.mockResolvedValue([]);
  m.sekolahFindMany.mockResolvedValue([]);
  m.bebasFindUnique.mockResolvedValue(null);
  m.sekolahFindUnique.mockResolvedValue(null);
  m.bebasCreate.mockResolvedValue({ id: ID });
});

describe("hanya admin pusat", () => {
  it.each([
    ["GET riwayat", () => riwayatGET()],
    ["POST terbitkan", () => terbitkanPOST(json(isian()))],
    ["POST pratinjau", () => pratinjauPOST(json(isian()))],
    ["GET nomor", () => nomorGET(new Request("http://localhost/api/admin-pusat/invoice-bebas/nomor?kode=AYOTKA&tanggal=2026-11-10"))],
    ["GET data", () => dataGET(new Request("http://localhost/x"), ctx(ID))],
    ["GET pdf", () => pdfGET(new Request("http://localhost/x"), ctx(ID))],
  ])("%s: 403 bila bukan admin pusat, tanpa menyentuh database", async (_nama, panggil) => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await panggil()).status).toBe(403);
    // peran yang diminta persis admin_pusat (bukan daftar yang lebih longgar)
    expect(m.requireRole).toHaveBeenCalledTimes(1);
    expect(m.requireRole).toHaveBeenCalledWith("admin_pusat");
    expect(m.bebasFindMany).not.toHaveBeenCalled();
    expect(m.bebasCreate).not.toHaveBeenCalled();
    expect(m.bebasFindUnique).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin-pusat/invoice-bebas/pratinjau", () => {
  it("PDF inline tanpa menyimpan apa pun dan tanpa memakai nomor", async () => {
    const res = await pratinjauPOST(json(isian()));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe('inline; filename="Invoice INV-AYOTKA-2026-XI-001 - MTsN 1 Kediri.pdf"');
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await adalahPdf(res)).toBe(true);
    expect(m.bebasCreate).not.toHaveBeenCalled();
    expect(m.logAudit).not.toHaveBeenCalled();
    expect(m.sekolahFindMany).not.toHaveBeenCalled();
  });

  it("isian belum lengkap: 400 dengan pesan yang bisa ditampilkan (baris diberi nomor)", async () => {
    const kosong = await pratinjauPOST(json(isianAwalInvoiceBebas()));
    expect(kosong.status).toBe(400);
    expect((await kosong.json()).error).toBe("Nama penerima (sekolah) wajib diisi.");

    const baris = await pratinjauPOST(json(isian((f) => (f.baris[0]!.harga = -1))));
    expect(baris.status).toBe(400);
    expect((await baris.json()).error).toBe("Baris 1: Harga satuan tidak boleh negatif.");

    expect((await pratinjauPOST(new Request("http://localhost/x", { method: "POST", body: "bukan json" }))).status).toBe(400);
  });
});

describe("POST /api/admin-pusat/invoice-bebas (terbitkan)", () => {
  it("menerbitkan: nomor dicatat dengan isiannya, audit ditulis, PDF diunduh dengan nomor di header", async () => {
    const res = await terbitkanPOST(json(isian((f) => (f.nomorUrut = 5))));
    expect(res.status).toBe(200);
    expect(await adalahPdf(res)).toBe(true);
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="Invoice INV-AYOTKA-2026-XI-005 - MTsN 1 Kediri.pdf"');
    expect(decodeURIComponent(res.headers.get("X-Nomor-Invoice")!)).toBe("INV/AYOTKA/2026/XI/005");
    expect(res.headers.get("X-Invoice-Id")).toBe(ID);

    expect(m.bebasCreate).toHaveBeenCalledTimes(1);
    const arg = m.bebasCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(arg.data).toMatchObject({
      nomorInvoice: "INV/AYOTKA/2026/XI/005",
      penerima: "MTsN 1 Kediri",
      totalAmount: 4_000_000,
      status: "menunggu_pembayaran",
      dibuatOlehId: "admin-1",
    });
    expect((arg.data.tanggalInvoice as Date).toISOString()).toBe("2026-11-10T05:00:00.000Z");
    // isian lengkap tersimpan (sudah divalidasi) supaya PDF bisa diunduh ulang persis sama
    expect(invoiceBebasSchema.safeParse(arg.data.data).success).toBe(true);
    expect(m.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        aksi: "create",
        entitas: "invoice_bebas",
        entitasId: ID,
        after: { nomorInvoice: "INV/AYOTKA/2026/XI/005", penerima: "MTsN 1 Kediri", totalAmount: 4_000_000, status: "menunggu_pembayaran" },
      }),
    );
  });

  it("total memperhitungkan PPN dan banyak baris", async () => {
    await terbitkanPOST(
      json(
        isian((f) => {
          f.baris = [
            { deskripsi: "A", detail: "", jumlah: 369, satuan: "siswa", harga: 20_000 },
            { deskripsi: "B", detail: "", jumlah: 1, satuan: "paket", harga: 500_000 },
          ];
          f.pajak = { aktif: true, persen: 11 };
          f.status = "lunas";
        }),
      ),
    );
    const arg = m.bebasCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(arg.data).toMatchObject({ totalAmount: 8_746_800, status: "lunas" }); // (7.380.000 + 500.000) x 1,11
  });

  it("nomor mengikuti kode penerbit dan bulan tanggal terbit", async () => {
    await terbitkanPOST(json(isian((f) => ((f.penerbit = { ...f.penerbit, kode: "icn" }), (f.tanggalTerbit = "2027-01-05"), (f.jatuhTempo = "2027-01-19")))));
    expect((m.bebasCreate.mock.calls[0]![0] as { data: { nomorInvoice: string } }).data.nomorInvoice).toBe("INV/ICN/2027/I/001");
  });

  it.each([
    ["invoice sekolah", () => m.sekolahFindUnique.mockResolvedValue({ id: "s1" }), "sudah dipakai invoice sekolah"],
    ["invoice lain dari pembuat ini", () => m.bebasFindUnique.mockResolvedValue({ id: "b1" }), "sudah dipakai invoice lain dari Pembuat Invoice"],
  ])("nomor sudah dipakai %s: 409 dengan saran nomor berikutnya, tanpa mencatat atau audit", async (_nama, siapkan, kalimat) => {
    siapkan();
    m.bebasFindMany.mockResolvedValue([{ nomorInvoice: "INV/AYOTKA/2026/XI/001" }]);
    m.sekolahFindMany.mockResolvedValue([{ nomorInvoice: "INV/AYOTKA/2026/XI/002" }]);
    const res = await terbitkanPOST(json(isian((f) => (f.nomorUrut = 2))));
    expect(res.status).toBe(409);
    const badan = await res.json();
    expect(badan.error).toContain("Nomor INV/AYOTKA/2026/XI/002");
    expect(badan.error).toContain(kalimat);
    expect(badan).toMatchObject({ kode: "nomor_dipakai", saran: { urut: 3, nomor: "INV/AYOTKA/2026/XI/003" } });
    expect(m.bebasCreate).not.toHaveBeenCalled();
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("Oktober 2026: nomor 001 sudah dipakai di luar aplikasi (MTsN 1 Kediri) ditolak; 002 boleh", async () => {
    const oktober = (urut: number) => isian((f) => ((f.tanggalTerbit = "2026-10-16"), (f.jatuhTempo = "2026-10-30"), (f.nomorUrut = urut)));
    const ditolak = await terbitkanPOST(json(oktober(1)));
    expect(ditolak.status).toBe(409);
    expect((await ditolak.json()).error).toContain("diterbitkan di luar aplikasi");
    expect(m.bebasCreate).not.toHaveBeenCalled();

    const diterima = await terbitkanPOST(json(oktober(2)));
    expect(diterima.status).toBe(200);
    expect((m.bebasCreate.mock.calls[0]![0] as { data: { nomorInvoice: string } }).data.nomorInvoice).toBe("INV/AYOTKA/2026/X/002");
  });

  it("dua penerbitan bersamaan dengan nomor sama (benturan unik di database): 409, bukan 500", async () => {
    m.bebasCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unik", { code: "P2002", clientVersion: "test" }));
    const res = await terbitkanPOST(json(isian()));
    expect(res.status).toBe(409);
    expect((await res.json()).kode).toBe("nomor_dipakai");
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("galat database lain tidak ditelan", async () => {
    m.bebasCreate.mockRejectedValue(new Error("db mati"));
    await expect(terbitkanPOST(json(isian()))).rejects.toThrow("db mati");
  });

  it("isian tidak valid: 400 tanpa memeriksa nomor atau menulis", async () => {
    const res = await terbitkanPOST(json(isian((f) => (f.penerima.nama = ""))));
    expect(res.status).toBe(400);
    expect(m.bebasFindUnique).not.toHaveBeenCalled();
    expect(m.bebasCreate).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin-pusat/invoice-bebas (riwayat)", () => {
  it("terbaru dulu, paling banyak 50, hanya kolom ringkasan (tanpa isian lengkap)", async () => {
    m.bebasFindMany.mockResolvedValue([{ id: ID, nomorInvoice: "INV/AYOTKA/2026/XI/001", penerima: "MTsN", totalAmount: 1, status: "lunas", tanggalInvoice: new Date(), createdAt: new Date() }]);
    const res = await riwayatGET();
    expect(res.status).toBe(200);
    expect((await res.json()).riwayat).toHaveLength(1);
    expect(m.bebasFindMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, nomorInvoice: true, penerima: true, totalAmount: true, status: true, tanggalInvoice: true, createdAt: true },
    });
  });
});

describe("GET /api/admin-pusat/invoice-bebas/nomor", () => {
  const minta = (q: string) => nomorGET(new Request(`http://localhost/api/admin-pusat/invoice-bebas/nomor?${q}`));

  it("saran nomor berikutnya bulan itu dari semua sumber (invoice sekolah + buku nomor)", async () => {
    m.sekolahFindMany.mockResolvedValue([{ nomorInvoice: "INV/AYOTKA/2026/XI/003" }]);
    m.bebasFindMany.mockResolvedValue([{ nomorInvoice: "INV/AYOTKA/2026/XI/004" }]);
    const res = await minta("kode=ayotka&tanggal=2026-11-10");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ awalan: "INV/AYOTKA/2026/XI/", urutBerikutnya: 5, nomorBerikutnya: "INV/AYOTKA/2026/XI/005", dipakai: null });
  });

  it("Oktober 2026 tanpa invoice di database: saran mulai dari 2", async () => {
    expect((await (await minta("kode=AYOTKA&tanggal=2026-10-16")).json()).urutBerikutnya).toBe(2);
  });

  it("kode lain punya urutan sendiri", async () => {
    expect((await (await minta("kode=ICN&tanggal=2026-10-16")).json()).urutBerikutnya).toBe(1);
  });

  it("dengan urut: melaporkan siapa yang memakainya", async () => {
    m.sekolahFindUnique.mockResolvedValue({ id: "s1" });
    expect((await (await minta("kode=AYOTKA&tanggal=2026-11-10&urut=3")).json()).dipakai).toBe("invoice_sekolah");
    m.sekolahFindUnique.mockResolvedValue(null);
    m.bebasFindUnique.mockResolvedValue({ id: "b1" });
    expect((await (await minta("kode=AYOTKA&tanggal=2026-11-10&urut=3")).json()).dipakai).toBe("invoice_bebas");
    m.bebasFindUnique.mockResolvedValue(null);
    expect((await (await minta("kode=AYOTKA&tanggal=2026-10-16&urut=1")).json()).dipakai).toBe("luar_aplikasi");
    expect((await (await minta("kode=AYOTKA&tanggal=2026-10-16&urut=2")).json()).dipakai).toBeNull();
  });

  it("urut yang bukan angka sah diabaikan (tidak ada pencarian)", async () => {
    await minta("kode=AYOTKA&tanggal=2026-11-10&urut=abc");
    await minta("kode=AYOTKA&tanggal=2026-11-10&urut=0");
    await minta("kode=AYOTKA&tanggal=2026-11-10&urut=1234567");
    expect(m.sekolahFindUnique).not.toHaveBeenCalled();
  });

  it.each(["", "kode=AYOTKA", "tanggal=2026-11-10", "kode=A%2FB&tanggal=2026-11-10", "kode=AYOTKA&tanggal=2026-02-31"])("parameter tidak sah (%s): 400", async (q) => {
    expect((await minta(q)).status).toBe(400);
  });
});

describe("GET /api/admin-pusat/invoice-bebas/[id] dan /pdf", () => {
  const TERSIMPAN = (ubah: (f: InvoiceBebasForm) => void = () => {}) => ({ id: ID, nomorInvoice: "INV/AYOTKA/2026/XI/001", data: invoiceBebasSchema.parse(isian(ubah)) });

  it("id bukan UUID atau tidak ada: 404 (tanpa menanyai database untuk id yang rusak)", async () => {
    expect((await dataGET(new Request("http://localhost/x"), ctx("bukan-uuid"))).status).toBe(404);
    expect((await pdfGET(new Request("http://localhost/x"), ctx("bukan-uuid"))).status).toBe(404);
    expect(m.bebasFindUnique).not.toHaveBeenCalled();
    expect((await dataGET(new Request("http://localhost/x"), ctx(ID))).status).toBe(404);
    expect((await pdfGET(new Request("http://localhost/x"), ctx(ID))).status).toBe(404);
  });

  it("data: mengembalikan isian tersimpan untuk dipakai sebagai dasar", async () => {
    m.bebasFindUnique.mockResolvedValue(TERSIMPAN());
    const res = await dataGET(new Request("http://localhost/x"), ctx(ID));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: ID, nomorInvoice: "INV/AYOTKA/2026/XI/001", data: { penerima: { nama: "MTsN 1 Kediri" } } });
  });

  it("pdf: dirender ulang dari isian tersimpan dengan nomor dan nama berkas yang sama", async () => {
    m.bebasFindUnique.mockResolvedValue({ data: TERSIMPAN().data });
    const res = await pdfGET(new Request("http://localhost/x"), ctx(ID));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="Invoice INV-AYOTKA-2026-XI-001 - MTsN 1 Kediri.pdf"');
    expect(await adalahPdf(res)).toBe(true);
  });

  it("pdf: isian tersimpan rusak (tidak lolos validasi) menghasilkan 500 yang jelas dan dicatat di log", async () => {
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    m.bebasFindUnique.mockResolvedValue({ data: { bukan: "invoice" } });
    const res = await pdfGET(new Request("http://localhost/x"), ctx(ID));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("tidak bisa dibaca");
    expect(galat).toHaveBeenCalled();
    galat.mockRestore();
  });
});
