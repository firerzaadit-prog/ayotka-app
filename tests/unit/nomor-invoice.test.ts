import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  invoiceFindMany: vi.fn(),
  bebasFindMany: vi.fn(),
  invoiceCreate: vi.fn(),
  schoolFindUnique: vi.fn(),
  requireRole: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    schoolInvoice: { findMany: m.invoiceFindMany, create: m.invoiceCreate },
    invoiceBebas: { findMany: m.bebasFindMany },
    school: { findUnique: m.schoolFindUnique },
  },
}));
vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/audit/log", () => ({ logAudit: m.logAudit, getClientIp: () => "1.2.3.4" }));

import {
  awalanNomorInvoice,
  bulanRomawi,
  formatNomorInvoice,
  urutBerikutnya,
  urutDariNomor,
} from "@/lib/billing/nomor-invoice";
import { generateNomorInvoiceSekolah } from "@/lib/billing/school-invoice";
import { POST } from "@/app/api/admin-pusat/schools/[id]/invoices/route";

describe("format nomor invoice (desain pemilik): INV/AYOTKA/{tahun}/{bulan romawi}/{urut}", () => {
  it.each([
    [1, "I"],
    [2, "II"],
    [3, "III"],
    [4, "IV"],
    [5, "V"],
    [6, "VI"],
    [7, "VII"],
    [8, "VIII"],
    [9, "IX"],
    [10, "X"],
    [11, "XI"],
    [12, "XII"],
  ])("bulan %i = %s", (bulan, romawi) => {
    expect(bulanRomawi(bulan)).toBe(romawi);
  });

  it.each([0, 13, -1, 1.5, NaN])("bulan %s di luar rentang: galat pemrograman", (bulan) => {
    expect(() => bulanRomawi(bulan)).toThrow(RangeError);
  });

  it("Oktober 2026 urutan 1 = contoh pemilik INV/AYOTKA/2026/X/001", () => {
    const awalan = awalanNomorInvoice(2026, 10);
    expect(awalan).toBe("INV/AYOTKA/2026/X/");
    expect(formatNomorInvoice(awalan, 1)).toBe("INV/AYOTKA/2026/X/001");
    expect(formatNomorInvoice(awalan, 42)).toBe("INV/AYOTKA/2026/X/042");
    expect(formatNomorInvoice(awalan, 999)).toBe("INV/AYOTKA/2026/X/999");
    expect(formatNomorInvoice(awalan, 1000)).toBe("INV/AYOTKA/2026/X/1000");
  });

  it("awalan bulan berbeda tidak saling tumpang (X vs XI vs I)", () => {
    expect("INV/AYOTKA/2026/XI/001".startsWith(awalanNomorInvoice(2026, 10))).toBe(false);
    expect("INV/AYOTKA/2026/X/001".startsWith(awalanNomorInvoice(2026, 11))).toBe(false);
    expect("INV/AYOTKA/2026/II/001".startsWith(awalanNomorInvoice(2026, 1))).toBe(false);
  });

  it("urutDariNomor: hanya angka murni di ujung nomor yang berawalan sama", () => {
    const a = awalanNomorInvoice(2026, 10);
    expect(urutDariNomor("INV/AYOTKA/2026/X/007", a)).toBe(7);
    expect(urutDariNomor("INV/AYOTKA/2026/X/1000", a)).toBe(1000);
    expect(urutDariNomor("INV/AYOTKA/2026/X/00a", a)).toBeNull();
    expect(urutDariNomor("INV/AYOTKA/2026/X/", a)).toBeNull();
    expect(urutDariNomor("INV/AYOTKA/2026/XI/007", a)).toBeNull();
    expect(urutDariNomor("INV/TKA/202610/0007", a)).toBeNull();
  });

  it("urutBerikutnya: terbesar + 1 secara ANGKA (999 -> 1000), abaikan format lain dan nomor rusak", () => {
    // November 2026: bulan tanpa nomor yang terpakai di luar aplikasi
    const a = awalanNomorInvoice(2026, 11);
    expect(urutBerikutnya([], a)).toBe(1);
    expect(urutBerikutnya(["INV/AYOTKA/2026/XI/001", "INV/AYOTKA/2026/XI/002"], a)).toBe(3);
    expect(urutBerikutnya(["INV/AYOTKA/2026/XI/002", "INV/AYOTKA/2026/XI/001"], a)).toBe(3);
    expect(urutBerikutnya(["INV/AYOTKA/2026/XI/999"], a)).toBe(1000);
    expect(urutBerikutnya(["INV/AYOTKA/2026/XI/999", "INV/AYOTKA/2026/XI/1000"], a)).toBe(1001);
    expect(urutBerikutnya(["INV/TKA/202611/0050", "INV/AYOTKA/2026/X/009", "INV/AYOTKA/2026/XI/abc"], a)).toBe(1);
  });

  it("Oktober 2026: 001 sudah dipakai di luar aplikasi (MTsN 1 Kediri), jadi nomor pertama aplikasi adalah 002", () => {
    const okt = awalanNomorInvoice(2026, 10);
    expect(urutBerikutnya([], okt)).toBe(2);
    expect(formatNomorInvoice(okt, urutBerikutnya([], okt))).toBe("INV/AYOTKA/2026/X/002");
    // nomor yang ada di database tetap menentukan bila lebih besar dari lantai
    expect(urutBerikutnya(["INV/AYOTKA/2026/X/002"], okt)).toBe(3);
    expect(urutBerikutnya(["INV/AYOTKA/2026/X/005", "INV/AYOTKA/2026/X/003"], okt)).toBe(6);
    // baris 001 di database (bila suatu saat dimasukkan) tidak menurunkan lantai
    expect(urutBerikutnya(["INV/AYOTKA/2026/X/001"], okt)).toBe(2);
    // nomor bulan lain dan format lama diabaikan seperti biasa
    expect(urutBerikutnya(["INV/TKA/202610/0050", "INV/AYOTKA/2026/XI/009", "INV/AYOTKA/2026/X/abc"], okt)).toBe(2);
  });

  it("lantai hanya berlaku pada Oktober 2026: bulan dan tahun lain tetap mulai dari 001", () => {
    for (const [tahun, bulan] of [[2026, 9], [2026, 11], [2026, 12], [2027, 10], [2025, 10], [2027, 1]] as const) {
      expect(urutBerikutnya([], awalanNomorInvoice(tahun, bulan)), `${tahun}-${bulan}`).toBe(1);
    }
  });
});

describe("generateNomorInvoiceSekolah", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.invoiceFindMany.mockResolvedValue([]);
    m.bebasFindMany.mockResolvedValue([]);
  });

  it("nomor yang sudah dipakai invoice dari Pembuat Invoice (buku nomor) ikut dihitung: tidak pernah bertabrakan", async () => {
    m.bebasFindMany.mockResolvedValue([{ nomorInvoice: "INV/AYOTKA/2026/XI/001" }, { nomorInvoice: "INV/AYOTKA/2026/XI/004" }]);
    m.invoiceFindMany.mockResolvedValue([{ nomorInvoice: "INV/AYOTKA/2026/XI/002" }]);
    expect(await generateNomorInvoiceSekolah(new Date("2026-11-10T03:00:00.000Z"))).toBe("INV/AYOTKA/2026/XI/005");
    expect(m.bebasFindMany).toHaveBeenCalledWith({
      where: { nomorInvoice: { startsWith: "INV/AYOTKA/2026/XI/" } },
      select: { nomorInvoice: true },
    });
  });

  it("hanya nomor di buku nomor (invoice sekolah kosong): tetap lanjut dari yang terbesar", async () => {
    m.bebasFindMany.mockResolvedValue([{ nomorInvoice: "INV/AYOTKA/2026/XI/007" }]);
    expect(await generateNomorInvoiceSekolah(new Date("2026-11-10T03:00:00.000Z"))).toBe("INV/AYOTKA/2026/XI/008");
  });

  it("bulan baru tanpa invoice: mulai dari 001, mencari hanya nomor bulan itu", async () => {
    // 10 Nov 2026 10.00 WIB
    const nomor = await generateNomorInvoiceSekolah(new Date("2026-11-10T03:00:00.000Z"));
    expect(nomor).toBe("INV/AYOTKA/2026/XI/001");
    expect(m.invoiceFindMany).toHaveBeenCalledWith({
      where: { nomorInvoice: { startsWith: "INV/AYOTKA/2026/XI/" } },
      select: { nomorInvoice: true },
    });
  });

  it("Oktober 2026 tanpa invoice di database: mulai dari 002 (001 sudah dipakai di luar aplikasi)", async () => {
    // 10 Okt 2026 10.00 WIB
    const nomor = await generateNomorInvoiceSekolah(new Date("2026-10-10T03:00:00.000Z"));
    expect(nomor).toBe("INV/AYOTKA/2026/X/002");
    expect(m.invoiceFindMany).toHaveBeenCalledWith({
      where: { nomorInvoice: { startsWith: "INV/AYOTKA/2026/X/" } },
      select: { nomorInvoice: true },
    });
  });

  it("melanjutkan dari nomor terbesar bulan itu (bukan jumlah baris): 002, 004 -> 005", async () => {
    m.invoiceFindMany.mockResolvedValue([{ nomorInvoice: "INV/AYOTKA/2026/X/002" }, { nomorInvoice: "INV/AYOTKA/2026/X/004" }]);
    expect(await generateNomorInvoiceSekolah(new Date("2026-10-10T03:00:00.000Z"))).toBe("INV/AYOTKA/2026/X/005");
  });

  it("memakai bulan dan tahun WIB: 31 Okt 2026 17.30 UTC sudah 1 Nov 2026 WIB -> XI/001 (lantai Oktober tidak ikut)", async () => {
    expect(await generateNomorInvoiceSekolah(new Date("2026-10-31T17:30:00.000Z"))).toBe("INV/AYOTKA/2026/XI/001");
  });

  it("tepat sebelum pergantian bulan WIB: 31 Okt 2026 16.59 UTC masih Oktober -> X/002", async () => {
    expect(await generateNomorInvoiceSekolah(new Date("2026-10-31T16:59:00.000Z"))).toBe("INV/AYOTKA/2026/X/002");
  });

  it("pergantian tahun WIB: 31 Des 2026 18.00 UTC = 1 Jan 2027 WIB -> 2027/I/001", async () => {
    expect(await generateNomorInvoiceSekolah(new Date("2026-12-31T18:00:00.000Z"))).toBe("INV/AYOTKA/2027/I/001");
  });

  it("nomor format lama (INV/TKA/202611/0001) tidak mengganggu urutan format baru", async () => {
    m.invoiceFindMany.mockResolvedValue([{ nomorInvoice: "INV/TKA/202611/0004" }]);
    expect(await generateNomorInvoiceSekolah(new Date("2026-11-10T03:00:00.000Z"))).toBe("INV/AYOTKA/2026/XI/001");
  });
});

describe("POST /api/admin-pusat/schools/[id]/invoices: nomor bentrok diulang", () => {
  const ctx = { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) };
  const req = () =>
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jumlahSiswa: 369, hargaPerSiswa: 20000, jatuhTempo: "2026-10-24" }),
    });
  const bentrok = () => new Prisma.PrismaClientKnownRequestError("unik", { code: "P2002", clientVersion: "test" });

  // Tanggal dikunci (10 Nov 2026 WIB): nomor yang diharapkan tidak boleh bergantung pada tanggal hari tes dijalankan,
  // dan November bebas dari lantai nomor Oktober 2026.
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T03:00:00.000Z"));
    m.requireRole.mockResolvedValue({ id: "pusat-1", role: "admin_pusat" });
    m.schoolFindUnique.mockResolvedValue({ id: "sch-1", nama: "MTsN 1 Kediri" });
    m.invoiceFindMany.mockResolvedValue([]);
    m.bebasFindMany.mockResolvedValue([]);
    m.invoiceCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "inv-1", ...data }));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("berhasil: nomor format baru tersimpan dengan subtotal = total (tanpa pajak)", async () => {
    const res = await POST(req(), ctx);
    expect(res.status).toBe(201);
    const { invoice } = await res.json();
    expect(invoice.nomorInvoice).toBe("INV/AYOTKA/2026/XI/001");
    expect(invoice.subtotal).toBe(7_380_000);
    expect(invoice.totalAmount).toBe(7_380_000);
  });

  it("Oktober 2026: invoice pertama yang diterbitkan aplikasi bernomor 002, bukan 001 yang sudah terpakai di luar aplikasi", async () => {
    vi.setSystemTime(new Date("2026-10-16T09:00:00.000Z"));
    const res = await POST(req(), ctx);
    expect(res.status).toBe(201);
    expect((await res.json()).invoice.nomorInvoice).toBe("INV/AYOTKA/2026/X/002");
  });

  it("nomor yang sama dipakai admin lain tepat sebelum disimpan: nomor dihitung ulang dan penyimpanan diulang", async () => {
    m.invoiceCreate.mockRejectedValueOnce(bentrok());
    m.invoiceFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ nomorInvoice: awalanDenganUrut(1) }]);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(201);
    expect(m.invoiceCreate).toHaveBeenCalledTimes(2);
    const nomor1 = m.invoiceCreate.mock.calls[0]![0].data.nomorInvoice as string;
    const nomor2 = m.invoiceCreate.mock.calls[1]![0].data.nomorInvoice as string;
    expect(nomor1.endsWith("/001")).toBe(true);
    expect(nomor2.endsWith("/002")).toBe(true);
  });

  it("bentrok terus-menerus: berhenti dengan 503 yang jelas (bukan putaran tak berujung atau 500)", async () => {
    m.invoiceCreate.mockRejectedValue(bentrok());
    const res = await POST(req(), ctx);
    expect(res.status).toBe(503);
    expect(m.invoiceCreate).toHaveBeenCalledTimes(4);
    expect(m.logAudit).not.toHaveBeenCalled();
  });

  it("galat database lain tidak diulang dan tidak ditelan", async () => {
    m.invoiceCreate.mockRejectedValue(new Error("db mati"));
    await expect(POST(req(), ctx)).rejects.toThrow("db mati");
    expect(m.invoiceCreate).toHaveBeenCalledTimes(1);
  });
});

/** Nomor urut tertentu pada bulan berjalan (mengikuti tanggal sistem saat tes dijalankan). */
function awalanDenganUrut(urut: number): string {
  const sekarang = new Date();
  const wib = new Date(sekarang.getTime() + 7 * 3_600_000);
  return formatNomorInvoice(awalanNomorInvoice(wib.getUTCFullYear(), wib.getUTCMonth() + 1), urut);
}
