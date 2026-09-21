import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { student, voucher } = vi.hoisted(() => ({
  student: { findUnique: vi.fn() },
  voucher: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { student, voucher } }));

import { bentukKodeValid, normalizeKodeReferral } from "@/lib/registrasi/referral-format";
import { resolveKodeReferral } from "@/lib/registrasi/referral";
import { activateVoucher, VoucherSudahDipakaiError } from "@/lib/billing/vouchers";

describe("normalizeKodeReferral / bentukKodeValid", () => {
  it("huruf besar, spasi dibuang", () => {
    expect(normalizeKodeReferral(" ab 12\tcd ")).toBe("AB12CD");
  });
  it("hanya huruf/angka 4-12 karakter yang dianggap bentuk kode", () => {
    expect(bentukKodeValid("AB12CD")).toBe(true);
    expect(bentukKodeValid("AB12CD34EF")).toBe(true); // kode voucher 10 karakter
    expect(bentukKodeValid("AB1")).toBe(false);
    expect(bentukKodeValid("ABCDEFGHIJKLM")).toBe(false);
    expect(bentukKodeValid("AB-12")).toBe(false);
    expect(bentukKodeValid("")).toBe(false);
  });
});

const VOUCHER_ROW = {
  id: "v1",
  status: "unused",
  planId: "plan1",
  partnerId: "p1",
  plan: { nama: "Paket Bulanan", durasiHari: 30 },
  partner: { nama: "Bimbel Cerdas" },
};

describe("resolveKodeReferral", () => {
  beforeEach(() => {
    student.findUnique.mockReset();
    voucher.findUnique.mockReset();
    student.findUnique.mockResolvedValue(null);
    voucher.findUnique.mockResolvedValue(null);
  });

  it("kode voucher -> tipe voucher lengkap (status, paket, mitra), dicari dengan kode yang dinormalkan", async () => {
    voucher.findUnique.mockResolvedValue(VOUCHER_ROW);
    expect(await resolveKodeReferral(" ab12cd34ef ")).toEqual({
      tipe: "voucher",
      voucherId: "v1",
      status: "unused",
      planId: "plan1",
      planNama: "Paket Bulanan",
      durasiHari: 30,
      partnerId: "p1",
      mitraNama: "Bimbel Cerdas",
    });
    expect(voucher.findUnique.mock.calls[0]![0].where).toEqual({ code: "AB12CD34EF" });
  });

  it("voucher yang sudah dipakai tetap dikenali (supaya bisa diberi pesan jelas), statusnya ikut terbawa", async () => {
    voucher.findUnique.mockResolvedValue({ ...VOUCHER_ROW, status: "used" });
    expect(await resolveKodeReferral("AB12CD34EF")).toMatchObject({ tipe: "voucher", status: "used" });
  });

  it("kode teman -> tipe siswa (tanpa membocorkan identitas)", async () => {
    student.findUnique.mockResolvedValue({ id: "s1" });
    expect(await resolveKodeReferral("XY99ZZ")).toEqual({ tipe: "siswa", studentId: "s1" });
  });

  it("kalau kembar (data lama), kode teman didahulukan seperti perilaku sebelumnya", async () => {
    student.findUnique.mockResolvedValue({ id: "s1" });
    voucher.findUnique.mockResolvedValue(VOUCHER_ROW);
    expect((await resolveKodeReferral("SAMA11"))?.tipe).toBe("siswa");
  });

  it("kode tak dikenal atau bentuknya salah -> null, dan bentuk salah tidak menyentuh database", async () => {
    expect(await resolveKodeReferral("TIDAK1")).toBeNull();
    student.findUnique.mockClear();
    voucher.findUnique.mockClear();
    expect(await resolveKodeReferral("a-b")).toBeNull();
    expect(student.findUnique).not.toHaveBeenCalled();
    expect(voucher.findUnique).not.toHaveBeenCalled();
  });
});

describe("activateVoucher", () => {
  const params = { voucherId: "v1", planId: "plan1", partnerId: "p1", durasiHari: 30, studentId: "s1" };

  function fakeTx(voucherCount: number) {
    return {
      voucher: { updateMany: vi.fn().mockResolvedValue({ count: voucherCount }) },
      student: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      entitlement: { create: vi.fn().mockImplementation(async ({ data }) => data) },
    };
  }

  it("voucher tersedia: ditandai terpakai, asal mitra dicatat (tanpa menimpa yang ada), entitlement voucher dibuat", async () => {
    const tx = fakeTx(1);
    const hasil = await activateVoucher(tx as never, params);

    expect(tx.voucher.updateMany).toHaveBeenCalledWith({
      where: { id: "v1", status: "unused" },
      data: expect.objectContaining({ status: "used", usedByStudentId: "s1" }),
    });
    expect(tx.student.updateMany).toHaveBeenCalledWith({
      where: { id: "s1", referredByPartnerId: null },
      data: { referredByPartnerId: "p1" },
    });
    expect(hasil).toMatchObject({ studentId: "s1", planId: "plan1", source: "voucher", voucherId: "v1" });
    const selisihHari = ((hasil as { endsAt: Date }).endsAt.getTime() - (hasil as { startsAt: Date }).startsAt.getTime()) / 86_400_000;
    expect(Math.round(selisihHari)).toBe(30);
  });

  it("durasi paket kosong -> default 30 hari", async () => {
    const tx = fakeTx(1);
    const hasil = (await activateVoucher(tx as never, { ...params, durasiHari: null })) as { startsAt: Date; endsAt: Date };
    expect(Math.round((hasil.endsAt.getTime() - hasil.startsAt.getTime()) / 86_400_000)).toBe(30);
  });

  it("voucher keburu dipakai orang lain (balapan): melempar error dan TIDAK membuat entitlement", async () => {
    const tx = fakeTx(0);
    await expect(activateVoucher(tx as never, params)).rejects.toBeInstanceOf(VoucherSudahDipakaiError);
    expect(tx.entitlement.create).not.toHaveBeenCalled();
    expect(tx.student.updateMany).not.toHaveBeenCalled();
  });
});
