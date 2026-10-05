import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  studentFindFirst: vi.fn(),
  schoolUserFindFirst: vi.fn(),
  partnerFindUnique: vi.fn(),
  dinasFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    student: { findFirst: m.studentFindFirst },
    schoolUser: { findFirst: m.schoolUserFindFirst },
    partner: { findUnique: m.partnerFindUnique },
    dinasAdmin: { findUnique: m.dinasFindUnique },
  },
}));

import { getNamaAkun, pilihNamaAkun } from "@/lib/auth/nama-akun";

const user = (role: "siswa" | "admin_sekolah" | "mitra" | "dinas_pendidikan" | "admin_pusat") => ({
  id: "user-1",
  email: "akun@ayotka.id",
  role,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("pilihNamaAkun", () => {
  it("memakai nama pertama yang terisi, dipangkas spasinya", () => {
    expect(pilihNamaAkun("a@b.id", "  Budi  ", "Cadangan")).toBe("Budi");
  });

  it("melewati kandidat kosong/null/undefined/hanya spasi", () => {
    expect(pilihNamaAkun("a@b.id", null, undefined, "   ", "Dinas Pendidikan Kota Malang")).toBe("Dinas Pendidikan Kota Malang");
  });

  it("tanpa nama sama sekali: email jadi cadangan (label tidak pernah kosong)", () => {
    expect(pilihNamaAkun("a@b.id")).toBe("a@b.id");
    expect(pilihNamaAkun("a@b.id", "", null)).toBe("a@b.id");
  });
});

describe("getNamaAkun - label akun di pojok kanan atas dashboard", () => {
  it("siswa: nama siswa", async () => {
    m.studentFindFirst.mockResolvedValue({ nama: "Ayu Lestari" });
    expect(await getNamaAkun(user("siswa"))).toBe("Ayu Lestari");
    expect(m.studentFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
  });

  it("admin sekolah: nama sekolahnya", async () => {
    m.schoolUserFindFirst.mockResolvedValue({ school: { nama: "SMP Negeri 1 Malang" } });
    expect(await getNamaAkun(user("admin_sekolah"))).toBe("SMP Negeri 1 Malang");
    expect(m.schoolUserFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
  });

  it("mitra: nama mitra", async () => {
    m.partnerFindUnique.mockResolvedValue({ nama: "CV Maju Bersama" });
    expect(await getNamaAkun(user("mitra"))).toBe("CV Maju Bersama");
  });

  it("dinas pendidikan: nama instansi (bukan nama penanggung jawab)", async () => {
    m.dinasFindUnique.mockResolvedValue({ instansi: "Dinas Pendidikan Kota Malang", nama: "Pak Budi" });
    expect(await getNamaAkun(user("dinas_pendidikan"))).toBe("Dinas Pendidikan Kota Malang");
  });

  it("dinas pendidikan tanpa instansi: jatuh ke nama penanggung jawab, lalu email", async () => {
    m.dinasFindUnique.mockResolvedValue({ instansi: "  ", nama: "Pak Budi" });
    expect(await getNamaAkun(user("dinas_pendidikan"))).toBe("Pak Budi");
    m.dinasFindUnique.mockResolvedValue(null);
    expect(await getNamaAkun(user("dinas_pendidikan"))).toBe("akun@ayotka.id");
  });

  it("profil tidak ditemukan: email jadi cadangan untuk semua peran", async () => {
    m.studentFindFirst.mockResolvedValue(null);
    m.schoolUserFindFirst.mockResolvedValue(null);
    m.partnerFindUnique.mockResolvedValue(null);
    expect(await getNamaAkun(user("siswa"))).toBe("akun@ayotka.id");
    expect(await getNamaAkun(user("admin_sekolah"))).toBe("akun@ayotka.id");
    expect(await getNamaAkun(user("mitra"))).toBe("akun@ayotka.id");
  });

  it("admin pusat tetap memakai email dan tidak query apa pun", async () => {
    expect(await getNamaAkun(user("admin_pusat"))).toBe("akun@ayotka.id");
    expect(m.studentFindFirst).not.toHaveBeenCalled();
    expect(m.schoolUserFindFirst).not.toHaveBeenCalled();
    expect(m.partnerFindUnique).not.toHaveBeenCalled();
    expect(m.dinasFindUnique).not.toHaveBeenCalled();
  });
});
