import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  schoolFindFirst: vi.fn(),
  schoolFindUnique: vi.fn(),
  schoolCreate: vi.fn(),
  generateLink: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findFirst: m.userFindFirst },
    school: { findFirst: m.schoolFindFirst, findUnique: m.schoolFindUnique, create: m.schoolCreate },
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
