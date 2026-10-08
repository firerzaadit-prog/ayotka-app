import { describe, expect, it } from "vitest";
import {
  MIN_JAWABAN_PEMBANDING,
  MIN_SEKOLAH_PEMBANDING,
  labelCakupanPembanding,
  susunPembanding,
  type AgregatIndikatorWilayah,
  type AgregatSekolahWilayah,
} from "@/lib/indikator/pembanding";
import { FILTER_WILAYAH_KOSONG, type FilterWilayah } from "@/lib/wilayah/cakupan";

const SENDIRI = "sekolah-saya";
const sekolah = (schoolId: string, skor: number, skorMaks = 100, jmlSiswa = 10): AgregatSekolahWilayah => ({ schoolId, skor, skorMaks, jmlSiswa });
const indikator = (indikatorId: string, skor: number, skorMaks: number, jmlSoal: number, jmlSekolah: number): AgregatIndikatorWilayah => ({
  indikatorId,
  skor,
  skorMaks,
  jmlSoal,
  jmlSekolah,
});
const susun = (daftar: AgregatSekolahWilayah[], ind: AgregatIndikatorWilayah[] = [], filter: FilterWilayah = FILTER_WILAYAH_KOSONG) =>
  susunPembanding({ filter, indikator: ind, sekolah: daftar, schoolIdSendiri: SENDIRI });

describe("labelCakupanPembanding", () => {
  it("nasional tanpa filter", () => {
    expect(labelCakupanPembanding(FILTER_WILAYAH_KOSONG)).toBe("Nasional · Negeri + Swasta");
  });
  it("provinsi, kota/kabupaten, dan status", () => {
    expect(labelCakupanPembanding({ provinsi: "Jawa Timur", kabupatenKota: null, statusSekolah: "negeri" })).toBe("Provinsi Jawa Timur · Negeri");
    expect(labelCakupanPembanding({ provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: "swasta" })).toBe("Kota Malang · Swasta");
  });
});

describe("susunPembanding - ambang privasi", () => {
  it("kurang dari 3 sekolah: tidak cukup, semua angka pembanding dikosongkan", () => {
    const p = susun([sekolah(SENDIRI, 60), sekolah("lain", 80)], [indikator("i1", 700, 1000, 500, 2)]);
    expect(MIN_SEKOLAH_PEMBANDING).toBe(3);
    expect(p).toMatchObject({ cukup: false, rerata: null, sebaran: null, posisi: null, jumlahSekolah: 2, jumlahSiswa: 20 });
    expect(p.perIndikator).toEqual({});
  });

  it("tanpa sekolah sama sekali: tidak cukup, jumlah nol", () => {
    expect(susun([])).toMatchObject({ cukup: false, jumlahSekolah: 0, jumlahSiswa: 0, rerata: null });
  });

  it("tepat 3 sekolah: cukup", () => {
    const p = susun([sekolah(SENDIRI, 60), sekolah("a", 70), sekolah("b", 80)]);
    expect(p.cukup).toBe(true);
    expect(p.jumlahSekolah).toBe(3);
  });

  it("sekolah dengan skor maksimum nol tidak dihitung sebagai sekolah pembanding", () => {
    const p = susun([sekolah(SENDIRI, 60), sekolah("a", 70), sekolah("kosong", 0, 0)]);
    expect(p.jumlahSekolah).toBe(2);
    expect(p.cukup).toBe(false);
  });

  it("indikator: butuh minimal 3 sekolah DAN 10 jawaban", () => {
    expect(MIN_JAWABAN_PEMBANDING).toBe(10);
    const sekolahCukup = [sekolah(SENDIRI, 60), sekolah("a", 70), sekolah("b", 80)];
    const p = susun(sekolahCukup, [
      indikator("lolos", 50, 100, 10, 3),
      indikator("sekolah-kurang", 50, 100, 50, 2),
      indikator("jawaban-kurang", 5, 9, 9, 5),
      indikator("tanpa-skor", 0, 0, 40, 5),
    ]);
    expect(Object.keys(p.perIndikator)).toEqual(["lolos"]);
    expect(p.perIndikator.lolos).toEqual({ dayaSerap: 50, jmlJawaban: 10, jmlSekolah: 3 });
  });

  it("identitas sekolah lain tidak ikut dikeluarkan", () => {
    const p = susun([sekolah(SENDIRI, 60), sekolah("rahasia-1", 70), sekolah("rahasia-2", 80)], [indikator("i", 50, 100, 20, 3)]);
    expect(JSON.stringify(p)).not.toContain("rahasia");
    expect(JSON.stringify(p)).not.toContain(SENDIRI);
  });
});

describe("susunPembanding - angka gabungan", () => {
  it("rerata tertimbang skor maksimum (bukan rerata persentase sekolah)", () => {
    // sekolah besar 90/100 dan dua kecil 0/10 -> gabungan 90/120 = 75, bukan rerata (90+0+0)/3 = 30
    const p = susun([sekolah(SENDIRI, 90, 100), sekolah("a", 0, 10), sekolah("b", 0, 10)]);
    expect(p.rerata).toBeCloseTo(75, 5);
  });

  it("jumlah siswa dijumlahkan dari semua sekolah", () => {
    expect(susun([sekolah(SENDIRI, 1, 2, 4), sekolah("a", 1, 2, 5), sekolah("b", 1, 2, 6)]).jumlahSiswa).toBe(15);
  });

  it("kuartil sebaran daya serap antar sekolah (interpolasi linear)", () => {
    const p = susun([sekolah(SENDIRI, 40), sekolah("a", 50), sekolah("b", 60), sekolah("c", 70), sekolah("d", 80)]);
    expect(p.sebaran).toEqual({ kuartil1: 50, median: 60, kuartil3: 70 });
  });

  it("daya serap per indikator = skor / skor maksimum", () => {
    const p = susun([sekolah(SENDIRI, 1), sekolah("a", 1), sekolah("b", 1)], [indikator("i", 33, 120, 40, 3)]);
    expect(p.perIndikator.i!.dayaSerap).toBeCloseTo(27.5, 5);
  });

  it("cakupan dan labelnya ikut dikembalikan", () => {
    const filter: FilterWilayah = { provinsi: "Bali", kabupatenKota: null, statusSekolah: "negeri" };
    const p = susun([sekolah(SENDIRI, 1), sekolah("a", 1), sekolah("b", 1)], [], filter);
    expect(p.filter).toEqual(filter);
    expect(p.label).toBe("Provinsi Bali · Negeri");
  });
});

describe("susunPembanding - posisi sekolah", () => {
  it("peringkat 1 = tertinggi; persentil = persen sekolah LAIN yang lebih rendah", () => {
    const p = susun([sekolah(SENDIRI, 90), sekolah("a", 70), sekolah("b", 50), sekolah("c", 30)]);
    expect(p.posisi).toEqual({ peringkat: 1, dari: 4, persentil: 100 });
  });

  it("posisi tengah", () => {
    const p = susun([sekolah(SENDIRI, 60), sekolah("a", 90), sekolah("b", 50), sekolah("c", 70), sekolah("d", 30)]);
    expect(p.posisi).toEqual({ peringkat: 3, dari: 5, persentil: 50 });
  });

  it("posisi terendah: persentil 0", () => {
    const p = susun([sekolah(SENDIRI, 10), sekolah("a", 20), sekolah("b", 30)]);
    expect(p.posisi).toEqual({ peringkat: 3, dari: 3, persentil: 0 });
  });

  it("sekolah dengan daya serap sama berbagi peringkat", () => {
    const p = susun([sekolah(SENDIRI, 60), sekolah("a", 60), sekolah("b", 80), sekolah("c", 40)]);
    expect(p.posisi).toEqual({ peringkat: 2, dari: 4, persentil: (1 / 3) * 100 });
  });

  it("sekolah sendiri tidak termasuk cakupan (mis. provinsi lain): tidak ada posisi, pembanding tetap ada", () => {
    const p = susun([sekolah("a", 60), sekolah("b", 70), sekolah("c", 80)]);
    expect(p.cukup).toBe(true);
    expect(p.posisi).toBeNull();
    expect(p.rerata).toBeCloseTo(70, 5);
  });
});
