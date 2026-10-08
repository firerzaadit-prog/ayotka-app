import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  schoolFindFirst: vi.fn(),
  schoolFindUnique: vi.fn(),
  schoolCreate: vi.fn(),
  schoolUpdate: vi.fn(),
  generateLink: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findFirst: m.userFindFirst },
    school: { findFirst: m.schoolFindFirst, findUnique: m.schoolFindUnique, create: m.schoolCreate, update: m.schoolUpdate },
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { generateLink: m.generateLink } } }),
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn(), getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => true }));
vi.mock("@/lib/utils/generate-code", () => ({ generateReadableCode: () => "KODE1234" }));
vi.mock("@/lib/students/create", () => ({ generateUniqueStudentReferralCode: async () => "REF123" }));
vi.mock("@/lib/registrasi/referral", () => ({ resolveKodeReferral: vi.fn() }));
vi.mock("@/lib/billing/vouchers", () => ({ activateVoucher: vi.fn(), VoucherSudahDipakaiError: class extends Error {} }));
vi.mock("@/lib/email/konfirmasi", () => ({ kirimEmailKonfirmasi: vi.fn(), pesanEmailBelumTerkirim: vi.fn() }));

import { POST } from "@/app/api/registrasi/mandiri/route";

function permintaan(body: Record<string, unknown>) {
  return new Request("http://localhost/api/registrasi/mandiri", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const DASAR = { nama: "Budi", email: "budi@example.com", password: "rahasia123", jenjang: "SMP" as const };

beforeEach(() => {
  vi.clearAllMocks();
  m.userFindFirst.mockResolvedValue(null);
  m.schoolFindFirst.mockResolvedValue(null);
  m.schoolCreate.mockResolvedValue({ id: "sekolah-baru" });
  m.schoolUpdate.mockResolvedValue({});
  // Hentikan alur tepat setelah sekolah ditentukan; yang diuji hanya penentuan sekolahnya.
  m.generateLink.mockResolvedValue({ data: { user: null, properties: null }, error: { message: "dihentikan tes" } });
});

describe("registrasi mandiri: nama sekolah yang diketik siswa", () => {
  it("membuat sekolah baru sebagai pending_verifikasi (masuk antrean, tidak tampil di pilihan siswa lain)", async () => {
    await POST(permintaan({ ...DASAR, asalSekolahManual: "  SMP   Uji   Coba 99 " }));
    expect(m.schoolCreate).toHaveBeenCalledTimes(1);
    const data = (m.schoolCreate.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).toMatchObject({ nama: "SMP Uji Coba 99", jenjang: "SMP", status: "pending_verifikasi" });
  });

  it("memakai sekolah yang sudah ada (nama sama, huruf besar/kecil diabaikan) dan tidak membuat ganda", async () => {
    m.schoolFindFirst.mockResolvedValue({ id: "sekolah-lama" });
    await POST(permintaan({ ...DASAR, asalSekolahManual: "smp uji coba 99" }));
    expect(m.schoolCreate).not.toHaveBeenCalled();
  });
});

describe("registrasi mandiri: wilayah dan status sekolah yang diketik siswa", () => {
  const WILAYAH = {
    asalSekolahProvinsi: "Jawa Timur",
    asalSekolahKabupatenKota: "Kota Malang",
    asalSekolahStatus: "negeri",
  };
  const dataBuat = () => (m.schoolCreate.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
  const dataUbah = () => (m.schoolUpdate.mock.calls[0] as unknown as [{ where: { id: string }; data: Record<string, unknown> }])[0];

  it("sekolah baru dibuat lengkap dengan provinsi, kota/kabupaten, dan status", async () => {
    await POST(permintaan({ ...DASAR, asalSekolahManual: "SMP Uji Coba 99", ...WILAYAH }));
    expect(dataBuat()).toMatchObject({ provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: "negeri", status: "pending_verifikasi" });
  });

  it("formulir lama tanpa wilayah tetap diterima: sekolah dibuat dengan wilayah/status kosong", async () => {
    await POST(permintaan({ ...DASAR, asalSekolahManual: "SMP Uji Coba 99" }));
    expect(dataBuat()).toMatchObject({ provinsi: null, kabupatenKota: null, statusSekolah: null });
  });

  it("hanya kota/kabupaten dikirim: provinsi dilengkapi", async () => {
    await POST(permintaan({ ...DASAR, asalSekolahManual: "SMP Uji Coba 99", asalSekolahKabupatenKota: "Kota Bandung" }));
    expect(dataBuat()).toMatchObject({ provinsi: "Jawa Barat", kabupatenKota: "Kota Bandung" });
  });

  it.each([
    ["kota/kabupaten bukan bagian provinsi", { asalSekolahProvinsi: "Bali", asalSekolahKabupatenKota: "Kota Malang" }],
    ["provinsi tidak dikenal", { asalSekolahProvinsi: "Atlantis" }],
    ["status tidak valid", { asalSekolahStatus: "yayasan" }],
  ])("%s: 400 dan tidak ada akun maupun sekolah yang dibuat", async (_nama, tambahan) => {
    const res = await POST(permintaan({ ...DASAR, asalSekolahManual: "SMP Uji Coba 99", ...WILAYAH, ...tambahan }));
    expect(res.status).toBe(400);
    expect(m.schoolCreate).not.toHaveBeenCalled();
    expect(m.generateLink).not.toHaveBeenCalled();
  });

  it("nama sama di kota/kabupaten yang sama dipakai ulang (pencarian dibatasi kota/kabupaten itu)", async () => {
    m.schoolFindFirst.mockResolvedValueOnce({ id: "sekolah-lama", provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: "negeri" });
    await POST(permintaan({ ...DASAR, asalSekolahManual: "SMP Uji Coba 99", ...WILAYAH }));
    expect(m.schoolCreate).not.toHaveBeenCalled();
    expect(m.schoolFindFirst).toHaveBeenCalledTimes(1);
    expect((m.schoolFindFirst.mock.calls[0]![0] as { where: Record<string, unknown> }).where).toMatchObject({ jenjang: "SMP", kabupatenKota: "Kota Malang" });
  });

  it("nama sama tetapi di kota/kabupaten LAIN tidak dipakai: dibuatkan sekolah baru ('SD Negeri 1' ada di banyak daerah)", async () => {
    m.schoolFindFirst.mockResolvedValue(null); // tidak ada di Kota Malang, dan tidak ada yang wilayahnya kosong
    await POST(permintaan({ ...DASAR, asalSekolahManual: "SMP Negeri 1", ...WILAYAH }));
    expect(m.schoolFindFirst).toHaveBeenCalledTimes(2);
    expect((m.schoolFindFirst.mock.calls[1]![0] as { where: Record<string, unknown> }).where).toMatchObject({ kabupatenKota: null });
    expect(m.schoolCreate).toHaveBeenCalledTimes(1);
  });

  it("sekolah lama yang wilayahnya belum tercatat dipakai, dan wilayah + status dilengkapi dari isian siswa", async () => {
    m.schoolFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "sekolah-lama", provinsi: null, kabupatenKota: null, statusSekolah: null });
    await POST(permintaan({ ...DASAR, asalSekolahManual: "SMP Uji Coba 99", ...WILAYAH }));
    expect(m.schoolCreate).not.toHaveBeenCalled();
    expect(dataUbah().where).toEqual({ id: "sekolah-lama" });
    expect(dataUbah().data).toEqual({ provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: "negeri" });
  });

  it("data sekolah yang sudah tercatat TIDAK ditimpa isian siswa", async () => {
    m.schoolFindFirst.mockResolvedValueOnce({ id: "sekolah-lama", provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: "swasta" });
    await POST(permintaan({ ...DASAR, asalSekolahManual: "SMP Uji Coba 99", ...WILAYAH }));
    expect(m.schoolUpdate).not.toHaveBeenCalled();
  });

  it("hanya status yang kosong pada sekolah lama yang dilengkapi; wilayah tercatat tetap", async () => {
    m.schoolFindFirst.mockResolvedValueOnce({ id: "sekolah-lama", provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: null });
    await POST(permintaan({ ...DASAR, asalSekolahManual: "SMP Uji Coba 99", ...WILAYAH }));
    expect(dataUbah().data).toEqual({ statusSekolah: "negeri" });
  });

  it("formulir lama (tanpa wilayah) memakai pencarian nama + jenjang seperti sebelumnya dan tidak mengubah sekolah", async () => {
    m.schoolFindFirst.mockResolvedValue({ id: "sekolah-lama", provinsi: null, kabupatenKota: null, statusSekolah: null });
    await POST(permintaan({ ...DASAR, asalSekolahManual: "smp uji coba 99" }));
    expect(m.schoolFindFirst).toHaveBeenCalledTimes(1);
    expect((m.schoolFindFirst.mock.calls[0]![0] as { where: Record<string, unknown> }).where).not.toHaveProperty("kabupatenKota");
    expect(m.schoolUpdate).not.toHaveBeenCalled();
  });

  it("memilih sekolah dari daftar: isian wilayah diabaikan (data sekolahnya sudah tercatat)", async () => {
    m.schoolFindUnique.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    await POST(permintaan({ ...DASAR, asalSekolahId: "11111111-1111-4111-8111-111111111111", ...WILAYAH }));
    expect(m.schoolCreate).not.toHaveBeenCalled();
    expect(m.schoolUpdate).not.toHaveBeenCalled();
  });
});
