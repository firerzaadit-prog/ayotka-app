import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  schoolUserFind: vi.fn(),
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { schoolUser: { findFirst: m.schoolUserFind } } }));
vi.mock("next/headers", () => ({ cookies: m.cookies }));

import { ACTING_AS_SCHOOL_COOKIE, resolveSchoolId } from "@/lib/schools/scope";
import type { CurrentUser } from "@/lib/auth/session";

const pengguna = (role: string, id = "u-1") => ({ id, role }) as unknown as CurrentUser;

beforeEach(() => {
  vi.resetAllMocks();
  m.cookies.mockResolvedValue({ get: m.cookieGet });
  m.cookieGet.mockReturnValue(undefined);
  m.schoolUserFind.mockResolvedValue({ schoolId: "sek-sesi" });
});

describe("resolveSchoolId: isolasi antar sekolah", () => {
  it("admin sekolah SELALU memakai sekolah dari keanggotaannya; ?schoolId= apa pun diabaikan total", async () => {
    for (const diminta of [undefined, null, "", "sekolah-lain", "sek-sesi", "' OR 1=1 --"]) {
      expect(await resolveSchoolId(pengguna("admin_sekolah"), diminta), String(diminta)).toBe("sek-sesi");
    }
    // pencarian selalu berdasarkan userId pemanggil, tidak pernah memakai nilai permintaan
    for (const panggilan of m.schoolUserFind.mock.calls) expect(panggilan[0]).toEqual({ where: { userId: "u-1" } });
  });

  it("admin sekolah tidak membaca cookie mode 'Kelola Sekolah' (cookie itu hanya untuk admin pusat)", async () => {
    m.cookieGet.mockReturnValue({ value: "sekolah-lain" });
    expect(await resolveSchoolId(pengguna("admin_sekolah"), null)).toBe("sek-sesi");
    expect(m.cookies).not.toHaveBeenCalled();
  });

  it("admin sekolah tanpa keanggotaan sekolah -> null (bukan sekolah dari permintaan)", async () => {
    m.schoolUserFind.mockResolvedValue(null);
    expect(await resolveSchoolId(pengguna("admin_sekolah"), "sekolah-lain")).toBeNull();
  });

  it("peran lain (siswa, dinas, mitra, tak dikenal) tidak pernah mendapat sekolah, walau meminta", async () => {
    m.cookieGet.mockReturnValue({ value: "sekolah-lain" });
    for (const role of ["siswa", "dinas_pendidikan", "mitra", "tamu", ""]) {
      expect(await resolveSchoolId(pengguna(role), "sekolah-lain"), role).toBeNull();
    }
    expect(m.schoolUserFind).not.toHaveBeenCalled();
  });
});

describe("resolveSchoolId: admin pusat (lintas sekolah)", () => {
  it("parameter permintaan menang atas cookie", async () => {
    m.cookieGet.mockReturnValue({ value: "dari-cookie" });
    expect(await resolveSchoolId(pengguna("admin_pusat"), "dari-parameter")).toBe("dari-parameter");
  });

  it("tanpa parameter (atau parameter kosong) memakai cookie mode Kelola Sekolah", async () => {
    m.cookieGet.mockReturnValue({ value: "dari-cookie" });
    expect(await resolveSchoolId(pengguna("admin_pusat"), null)).toBe("dari-cookie");
    expect(await resolveSchoolId(pengguna("admin_pusat"), "")).toBe("dari-cookie");
    expect(await resolveSchoolId(pengguna("admin_pusat"))).toBe("dari-cookie");
    expect(m.cookieGet).toHaveBeenCalledWith(ACTING_AS_SCHOOL_COOKIE);
  });

  it("tanpa parameter dan tanpa cookie (atau cookie kosong) -> null", async () => {
    expect(await resolveSchoolId(pengguna("admin_pusat"), null)).toBeNull();
    m.cookieGet.mockReturnValue({ value: "" });
    expect(await resolveSchoolId(pengguna("admin_pusat"), null)).toBeNull();
  });

  it("admin pusat tidak memakai tabel keanggotaan sekolah", async () => {
    await resolveSchoolId(pengguna("admin_pusat"), "x");
    expect(m.schoolUserFind).not.toHaveBeenCalled();
  });
});
