import { describe, expect, it } from "vitest";
import { daftarMandiriSchema } from "@/lib/validations/registrasi";

const base = {
  nama: "Budi",
  email: "budi@contoh.com",
  password: "rahasia123",
  asalSekolahManual: "SMP Negeri 1 Kediri",
};

describe("daftarMandiriSchema - kelas harus cocok dengan jenjang", () => {
  it("SD kelas 4-6 valid, SMP kelas 7-9 valid", () => {
    expect(daftarMandiriSchema.safeParse({ ...base, jenjang: "SD", tingkat: 4 }).success).toBe(true);
    expect(daftarMandiriSchema.safeParse({ ...base, jenjang: "SD", tingkat: "6" }).success).toBe(true);
    expect(daftarMandiriSchema.safeParse({ ...base, jenjang: "SMP", tingkat: 7 }).success).toBe(true);
    expect(daftarMandiriSchema.safeParse({ ...base, jenjang: "SMP", tingkat: 9 }).success).toBe(true);
  });

  it("menolak kombinasi yang tidak masuk akal (bisa dikirim langsung ke API)", () => {
    expect(daftarMandiriSchema.safeParse({ ...base, jenjang: "SD", tingkat: 9 }).success).toBe(false);
    expect(daftarMandiriSchema.safeParse({ ...base, jenjang: "SMP", tingkat: 4 }).success).toBe(false);
    expect(daftarMandiriSchema.safeParse({ ...base, jenjang: "SMP", tingkat: 12 }).success).toBe(false);
  });

  it("membatasi panjang nama sekolah manual", () => {
    const panjang = "A".repeat(121);
    expect(daftarMandiriSchema.safeParse({ ...base, jenjang: "SMP", tingkat: 7, asalSekolahManual: panjang }).success).toBe(false);
  });
});
