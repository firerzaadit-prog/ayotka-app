import { describe, expect, it } from "vitest";
import { daftarMandiriSchema, daftarMitraSchema, klaimSchema } from "@/lib/validations/registrasi";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { partnerCreateSchema } from "@/lib/validations/partner";
import { dinasAdminCreateSchema } from "@/lib/validations/dinas-pendidikan";
import { schoolAdminCreateSchema } from "@/lib/validations/school-admin";
import { schoolCreateSchema } from "@/lib/validations/school";

// Email yang disimpan beda huruf besar/kecil dari yang dicari membuat akun
// tidak bisa reset password, dan daftar ulang dengan huruf kapital pernah
// menghapus akun pendaftar pertama. Semua pintu pembuatan akun wajib
// menyimpan email dalam huruf kecil.
const KETIK = "  Budi.Santoso@Gmail.COM ";
const SIMPAN = "budi.santoso@gmail.com";

describe("normalisasi email di skema pembuatan akun", () => {
  it("siswa mandiri & mitra", () => {
    const mandiri = daftarMandiriSchema.parse({
      nama: "Budi",
      email: KETIK,
      password: "rahasia123",
      jenjang: "SMP",
      tingkat: 7,
      asalSekolahManual: "SMP Negeri 1 Kediri",
    });
    expect(mandiri.email).toBe(SIMPAN);
    expect(daftarMitraSchema.parse({ nama: "Budi", email: KETIK, password: "rahasia123" }).email).toBe(SIMPAN);
  });

  it("klaim akun siswa sekolah dengan email", () => {
    const klaim = klaimSchema.parse({
      kodeSekolah: "ABC",
      studentId: "7d9f1c2e-5b3a-4c8d-9e1f-2a3b4c5d6e7f",
      kodeKlaim: "KODE1",
      punyaEmail: true,
      email: KETIK,
      password: "rahasia123",
    });
    expect(klaim.email).toBe(SIMPAN);
  });

  it("akun yang dibuat admin pusat", () => {
    expect(partnerCreateSchema.parse({ email: KETIK, nama: "Budi" }).email).toBe(SIMPAN);
    expect(dinasAdminCreateSchema.parse({ email: KETIK, nama: "Budi", instansi: "Dinas Kediri" }).email).toBe(SIMPAN);
    expect(
      schoolAdminCreateSchema.parse({ schoolId: "7d9f1c2e-5b3a-4c8d-9e1f-2a3b4c5d6e7f", email: KETIK, nama: "Budi" }).email,
    ).toBe(SIMPAN);
    expect(schoolCreateSchema.parse({ nama: "SMP Uji", jenjang: "SMP", adminEmail: KETIK }).adminEmail).toBe(SIMPAN);
  });

  it("lupa password", () => {
    expect(forgotPasswordSchema.parse({ email: KETIK }).email).toBe(SIMPAN);
  });

  it("tetap menolak email tidak valid", () => {
    expect(daftarMitraSchema.safeParse({ nama: "Budi", email: "BUKAN-EMAIL", password: "rahasia123" }).success).toBe(false);
  });
});
