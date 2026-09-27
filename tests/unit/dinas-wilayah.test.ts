import { describe, expect, it } from "vitest";
import { KABUPATEN_KOTA_JATIM } from "@/lib/constants/wilayah";
import { dinasAdminCreateSchema, dinasAdminUpdateSchema } from "@/lib/validations/dinas-pendidikan";
import { schoolCreateSchema } from "@/lib/validations/school";

describe("KABUPATEN_KOTA_JATIM", () => {
  it("38 wilayah (29 kabupaten + 9 kota), tanpa duplikat", () => {
    expect(KABUPATEN_KOTA_JATIM.length).toBe(38);
    expect(new Set(KABUPATEN_KOTA_JATIM).size).toBe(38);
    expect(KABUPATEN_KOTA_JATIM.filter((k) => k.startsWith("Kabupaten ")).length).toBe(29);
    expect(KABUPATEN_KOTA_JATIM.filter((k) => k.startsWith("Kota ")).length).toBe(9);
  });
});

describe("dinasAdminCreateSchema - wilayah wajib & tervalidasi", () => {
  const base = { email: "dinas@contoh.go.id", nama: "Budi", instansi: "Dinas Pendidikan Kota Malang" };

  it("menerima kota/kabupaten yang ada di daftar", () => {
    const result = dinasAdminCreateSchema.parse({ ...base, kabupatenKota: "Kota Malang" });
    expect(result.kabupatenKota).toBe("Kota Malang");
  });

  it("menolak wilayah yang tidak ada di daftar (mis. luar Jawa Timur atau salah ketik)", () => {
    expect(dinasAdminCreateSchema.safeParse({ ...base, kabupatenKota: "Jakarta Selatan" }).success).toBe(false);
    expect(dinasAdminCreateSchema.safeParse({ ...base, kabupatenKota: "kota malang" }).success).toBe(false);
  });

  it("menolak tanpa wilayah sama sekali", () => {
    expect(dinasAdminCreateSchema.safeParse(base).success).toBe(false);
  });
});

describe("dinasAdminUpdateSchema - field opsional untuk edit sebagian", () => {
  it("boleh hanya mengubah wilayah saja", () => {
    const result = dinasAdminUpdateSchema.parse({ kabupatenKota: "Kabupaten Jember" });
    expect(result).toEqual({ kabupatenKota: "Kabupaten Jember" });
  });

  it("boleh hanya mengubah status saja", () => {
    expect(dinasAdminUpdateSchema.parse({ status: "nonaktif" })).toEqual({ status: "nonaktif" });
  });

  it("tetap menolak wilayah tidak valid saat diedit", () => {
    expect(dinasAdminUpdateSchema.safeParse({ kabupatenKota: "Wilayah Ngasal" }).success).toBe(false);
  });
});

describe("schoolCreateSchema - kabupatenKota opsional tapi tervalidasi kalau diisi", () => {
  const base = { nama: "SMP Uji Coba", jenjang: "SMP" as const };

  it("boleh dikosongkan (sekolah lama/jalur lain belum terisi)", () => {
    expect(schoolCreateSchema.parse(base).kabupatenKota).toBeUndefined();
    expect(schoolCreateSchema.parse({ ...base, kabupatenKota: "" }).kabupatenKota).toBe("");
  });

  it("menerima wilayah yang valid", () => {
    expect(schoolCreateSchema.parse({ ...base, kabupatenKota: "Kabupaten Sidoarjo" }).kabupatenKota).toBe(
      "Kabupaten Sidoarjo",
    );
  });

  it("menolak wilayah yang tidak ada di daftar", () => {
    expect(schoolCreateSchema.safeParse({ ...base, kabupatenKota: "Kota Antah Berantah" }).success).toBe(false);
  });
});
