import { describe, expect, it } from "vitest";
import {
  KETERANGAN_JENIS,
  LABEL_FILTER_JENIS,
  URUTAN_JENIS,
  bacaFilterJenis,
  tentukanJenisTryOut,
  whereJenisPercobaan,
  type FilterJenis,
} from "@/lib/hasil-tryout/jenis";

/** Penafsir kecil untuk bentuk filter Prisma yang dipakai (AND, OR, not, kesamaan, relasi bersarang) pada objek biasa. */
function cocok(objek: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([kunci, syarat]) => {
    if (kunci === "AND") return (syarat as Record<string, unknown>[]).every((w) => cocok(objek, w));
    if (kunci === "OR") return (syarat as Record<string, unknown>[]).some((w) => cocok(objek, w));
    const nilai = objek[kunci];
    if (syarat !== null && typeof syarat === "object") {
      if ("not" in (syarat as object)) return nilai !== (syarat as { not: unknown }).not;
      return cocok((nilai ?? {}) as Record<string, unknown>, syarat as Record<string, unknown>);
    }
    return nilai === syarat;
  });
}

describe("bacaFilterJenis", () => {
  it("kosong atau tidak ada = semua; empat nilai dikenal; selain itu null (ditolak)", () => {
    expect(bacaFilterJenis(null)).toBe("semua");
    expect(bacaFilterJenis(undefined)).toBe("semua");
    expect(bacaFilterJenis("")).toBe("semua");
    for (const j of ["semua", "mandiri", "sekolah", "nasional"] as const) expect(bacaFilterJenis(j)).toBe(j);
    for (const rusak of ["Mandiri", "umum", "nasional ", "1", "semua,mandiri", "__proto__"]) expect(bacaFilterJenis(rusak), rusak).toBeNull();
  });
});

describe("label dan keterangan", () => {
  it("setiap pilihan punya label dan keterangan; urutan tetap Mandiri, Sekolah, Nasional", () => {
    expect(URUTAN_JENIS).toEqual(["mandiri", "sekolah", "nasional"]);
    expect(LABEL_FILTER_JENIS).toEqual({ semua: "Semua", mandiri: "Try Out Mandiri", sekolah: "Try Out Sekolah", nasional: "Try Out Nasional" });
    for (const j of ["semua", "mandiri", "sekolah", "nasional"] as FilterJenis[]) expect(KETERANGAN_JENIS[j].length).toBeGreaterThan(20);
  });
});

describe("whereJenisPercobaan setara tentukanJenisTryOut", () => {
  const kombinasi: Array<{ kategori: "mandiri" | "nasional"; assignmentId: string | null; ownerType: "pusat" | "sekolah" }> = [];
  for (const kategori of ["mandiri", "nasional"] as const) {
    for (const assignmentId of [null, "penugasan-1"]) {
      for (const ownerType of ["pusat", "sekolah"] as const) kombinasi.push({ kategori, assignmentId, ownerType });
    }
  }

  it("untuk SEMUA 8 kombinasi kategori x penugasan x pemilik: tepat satu jenis cocok dan sama dengan tentukanJenisTryOut", () => {
    for (const k of kombinasi) {
      const percobaan = { assignmentId: k.assignmentId, package: { kategori: k.kategori, ownerType: k.ownerType } };
      const harapan = tentukanJenisTryOut(k);
      const cocokJenis = URUTAN_JENIS.filter((j) => cocok(percobaan, whereJenisPercobaan(j) as Record<string, unknown>));
      expect(cocokJenis, JSON.stringify(k)).toEqual([harapan]);
      // "semua" dan nilai kosong tidak menyaring apa pun
      expect(cocok(percobaan, whereJenisPercobaan("semua") as Record<string, unknown>)).toBe(true);
      expect(cocok(percobaan, whereJenisPercobaan(null) as Record<string, unknown>)).toBe(true);
    }
  });

  it("kasus yang paling sering: paket pusat yang dijadwalkan sekolah = Sekolah (bukan Mandiri)", () => {
    expect(tentukanJenisTryOut({ kategori: "mandiri", assignmentId: "p1", ownerType: "pusat" })).toBe("sekolah");
    expect(cocok({ assignmentId: "p1", package: { kategori: "mandiri", ownerType: "pusat" } }, whereJenisPercobaan("sekolah") as Record<string, unknown>)).toBe(true);
    expect(cocok({ assignmentId: "p1", package: { kategori: "mandiri", ownerType: "pusat" } }, whereJenisPercobaan("mandiri") as Record<string, unknown>)).toBe(false);
    // paket pusat yang dipilih siswa sendiri = Mandiri; Try Out Nasional tetap Nasional walau dijadwalkan
    expect(tentukanJenisTryOut({ kategori: "mandiri", assignmentId: null, ownerType: "pusat" })).toBe("mandiri");
    expect(tentukanJenisTryOut({ kategori: "nasional", assignmentId: "p1", ownerType: "pusat" })).toBe("nasional");
  });
});
