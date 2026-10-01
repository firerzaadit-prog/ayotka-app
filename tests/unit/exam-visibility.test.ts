import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { packageModel, assignment } = vi.hoisted(() => ({
  packageModel: { findMany: vi.fn() },
  assignment: { findMany: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { package: packageModel, assignment } }));

import { getSelfSelectPackagesFor, getActiveAssignmentsFor } from "@/lib/exam/visibility";
import type { Student } from "@prisma/client";

const STUDENT_B = {
  id: "siswa-1",
  jenjang: "SMP",
  jalur: "B",
  schoolId: null,
} as unknown as Student;

const STUDENT_A = {
  id: "siswa-2",
  jenjang: "SD",
  jalur: "A",
  schoolId: "sekolah-1",
} as unknown as Student;

describe("getSelfSelectPackagesFor - tingkat dihapus, cuma jenjang (1 Okt 2026)", () => {
  beforeEach(() => {
    packageModel.findMany.mockReset();
    packageModel.findMany.mockResolvedValue([]);
  });

  it("Jalur B: where-clause tidak lagi berisi tingkatList sama sekali", async () => {
    await getSelfSelectPackagesFor(STUDENT_B);
    const where = packageModel.findMany.mock.calls[0]![0].where;
    expect(where).not.toHaveProperty("tingkatList");
    expect(where.jenjang).toBe("SMP");
  });

  it("Jalur A: where-clause juga cuma difilter jenjang, tanpa tingkatList", async () => {
    await getSelfSelectPackagesFor(STUDENT_A);
    const where = packageModel.findMany.mock.calls[0]![0].where;
    expect(where).not.toHaveProperty("tingkatList");
    expect(where.jenjang).toBe("SD");
  });

  it("includeUpcoming: true menyertakan paket bukaMulai di masa depan tanpa membatasi ke nasional (Mandiri ikut muncul)", async () => {
    await getSelfSelectPackagesFor(STUDENT_B, { includeUpcoming: true });
    const call = packageModel.findMany.mock.calls[0]![0];
    const andFilter = call.where.AND;
    // Harusnya [{ OR: [open, { bukaMulai: { gt: now } }] }]
    const orBranch = andFilter[0].OR[1];
    expect(orBranch).toHaveProperty("bukaMulai");
    expect(orBranch).not.toHaveProperty("kategori"); // Tidak lagi dibatasi kategori nasional
  });

  it("paket milik sekolah wajib bolehDipilihSiswa; hanya paket pusat yang selalu lolos", async () => {
    // Regresi: dulu syaratnya `kategori in [mandiri, nasional]` yang SELALU benar
    // (enum cuma punya dua nilai itu), jadi paket sekolah yang khusus untuk Ujian
    // Terjadwal ikut muncul di daftar Try Out dan bisa dimulai kapan saja.
    for (const student of [STUDENT_A, STUDENT_B]) {
      packageModel.findMany.mockClear();
      await getSelfSelectPackagesFor(student);
      const and = packageModel.findMany.mock.calls[0]![0].where.AND;
      const aksesFilter = and.find(
        (f: { OR?: Array<Record<string, unknown>> }) => f.OR?.some((c) => "bolehDipilihSiswa" in c),
      );
      expect(aksesFilter.OR).toEqual([{ bolehDipilihSiswa: true }, { ownerType: "pusat" }]);
    }
  });

  it("orderBy mengurutkan berdasarkan urutanSeri (nulls last) lalu nama", async () => {
    await getSelfSelectPackagesFor(STUDENT_B);
    const call = packageModel.findMany.mock.calls[0]![0];
    expect(call.orderBy).toEqual([
      { urutanSeri: { sort: "asc", nulls: "last" } },
      { nama: "asc" },
    ]);
  });
});

describe("getActiveAssignmentsFor - target sekolah penuh, tanpa Kelas/AcademicYear (1 Okt 2026)", () => {
  beforeEach(() => {
    assignment.findMany.mockReset();
    assignment.findMany.mockResolvedValue([]);
  });

  it("siswa Jalur B tidak pernah query assignment", async () => {
    await getActiveAssignmentsFor(STUDENT_B);
    expect(assignment.findMany).not.toHaveBeenCalled();
  });

  it("siswa Jalur A: query langsung by schoolId, tanpa classId/academicYear/enrollment apa pun", async () => {
    await getActiveAssignmentsFor(STUDENT_A);
    expect(assignment.findMany).toHaveBeenCalledTimes(1);
    const where = assignment.findMany.mock.calls[0]![0].where;
    expect(where.schoolId).toBe("sekolah-1");
    expect(where.isActive).toBe(true);
    expect(where).not.toHaveProperty("classId");
    expect(where).not.toHaveProperty("OR");
  });
});
