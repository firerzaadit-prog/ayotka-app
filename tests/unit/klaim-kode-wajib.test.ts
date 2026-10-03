import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  studentFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  transaction: vi.fn(),
  userCreate: vi.fn(),
  studentUpdate: vi.fn(),
  createUser: vi.fn(),
  signIn: vi.fn(),
  findActiveSchoolByCode: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    student: { findUnique: m.studentFindUnique, update: m.studentUpdate },
    user: { findUnique: m.userFindUnique, create: m.userCreate },
    $transaction: m.transaction,
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { createUser: m.createUser } } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword: m.signIn } }),
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn(), getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => true }));
vi.mock("@/lib/schools/lookup", () => ({ findActiveSchoolByCode: m.findActiveSchoolByCode }));

import { POST } from "@/app/api/registrasi/klaim/route";

const SISWA_ID = "7d9f1c2e-5b3a-4c8d-9e1f-2a3b4c5d6e7f";

function permintaan(body: Record<string, unknown>) {
  return new Request("http://localhost/api/registrasi/klaim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const DASAR = {
  kodeSekolah: "SEKOLAH1",
  studentId: SISWA_ID,
  punyaEmail: true,
  email: "budi@example.com",
  password: "rahasia123",
};

const SISWA = {
  id: SISWA_ID,
  schoolId: "sekolah-1",
  claimStatus: "belum_klaim",
  deletedAt: null,
  lulusAt: null,
  claimToken: "K7M2XQ9P",
  tanggalLahir: new Date("2010-05-15"),
  nisn: "0081234567",
};

beforeEach(() => {
  vi.clearAllMocks();
  m.findActiveSchoolByCode.mockResolvedValue({ id: "sekolah-1", nama: "MTsN 1 Kediri" });
  m.studentFindUnique.mockResolvedValue(SISWA);
  m.userFindUnique.mockResolvedValue(null);
  m.createUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
  m.transaction.mockResolvedValue([]);
  m.signIn.mockResolvedValue({ error: null });
});

describe("klaim akun siswa: Kode Klaim wajib", () => {
  it("menolak klaim yang hanya memakai tanggal lahir (tanpa Kode Klaim)", async () => {
    const res = await POST(permintaan({ ...DASAR, tanggalLahir: "2010-05-15" }));
    expect(res.status).toBe(400);
    expect(m.createUser).not.toHaveBeenCalled();
  });

  it("menolak Kode Klaim yang salah walaupun tanggal lahir benar", async () => {
    const res = await POST(permintaan({ ...DASAR, kodeKlaim: "SALAH123", tanggalLahir: "2010-05-15" }));
    expect(res.status).toBe(400);
    const badan = await res.json();
    expect(badan.error).toMatch(/kode klaim/i);
    expect(m.createUser).not.toHaveBeenCalled();
  });

  it("menolak bila siswa tidak punya Kode Klaim tersimpan, dan tidak menerima kode kosong sebagai cocok", async () => {
    m.studentFindUnique.mockResolvedValue({ ...SISWA, claimToken: null });
    const res = await POST(permintaan({ ...DASAR, kodeKlaim: "K7M2XQ9P" }));
    expect(res.status).toBe(400);
    expect(m.createUser).not.toHaveBeenCalled();
  });

  it("menerima Kode Klaim yang benar, termasuk saat diketik huruf kecil atau berspasi", async () => {
    const res = await POST(permintaan({ ...DASAR, kodeKlaim: " k7m2 xq9p " }));
    expect(res.status).toBe(200);
    expect(m.createUser).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ redirectTo: "/siswa/dashboard" });
  });

  it("menolak siswa yang sudah klaim atau sudah dihapus, walau kodenya benar", async () => {
    m.studentFindUnique.mockResolvedValue({ ...SISWA, claimStatus: "sudah_klaim" });
    const res = await POST(permintaan({ ...DASAR, kodeKlaim: "K7M2XQ9P" }));
    expect(res.status).toBe(400);
    expect(m.createUser).not.toHaveBeenCalled();
  });
});
