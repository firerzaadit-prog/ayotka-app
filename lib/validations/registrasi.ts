import { z } from "zod";

export const cekKodeSekolahSchema = z.object({
  kodeSekolah: z.string().trim().min(1, "Kode sekolah wajib diisi"),
});

export const cariSiswaSchema = z.object({
  kodeSekolah: z.string().trim().min(1, "Kode sekolah wajib diisi"),
  nama: z.string().trim().min(3, "Ketik minimal 3 karakter"),
});

export const klaimSchema = z
  .object({
    kodeSekolah: z.string().trim().min(1, "Kode sekolah wajib diisi"),
    studentId: z.string().uuid(),
    kodeKlaim: z.string().trim().optional().or(z.literal("")),
    tanggalLahir: z.coerce.date().optional(),
    punyaEmail: z.boolean(),
    email: z.string().trim().email("Email tidak valid").optional().or(z.literal("")),
    password: z.string().min(8, "Password minimal 8 karakter"),
  })
  .refine((data) => (data.kodeKlaim && data.kodeKlaim.length > 0) || data.tanggalLahir, {
    message: "Isi kode klaim atau tanggal lahir untuk verifikasi.",
    path: ["kodeKlaim"],
  })
  .refine((data) => !data.punyaEmail || (data.email && data.email.length > 0), {
    message: "Email wajib diisi.",
    path: ["email"],
  });

export const daftarMandiriSchema = z
  .object({
    nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
    email: z.string().trim().email("Email tidak valid"),
    password: z.string().min(8, "Password minimal 8 karakter"),
    jenjang: z.enum(["SD", "SMP"]),
    tingkat: z.coerce.number().int().min(1).max(12),
    asalSekolahId: z.string().uuid().optional().or(z.literal("")),
    asalSekolahManual: z.string().trim().optional().or(z.literal("")),
  })
  .refine(
    (data) => (data.asalSekolahId && data.asalSekolahId.length > 0) || (data.asalSekolahManual && data.asalSekolahManual.length > 0),
    { message: "Pilih asal sekolah dari daftar atau ketik manual.", path: ["asalSekolahManual"] },
  );

export type CekKodeSekolahInput = z.infer<typeof cekKodeSekolahSchema>;
export type CariSiswaInput = z.infer<typeof cariSiswaSchema>;
export type KlaimInput = z.infer<typeof klaimSchema>;
export type DaftarMandiriInput = z.infer<typeof daftarMandiriSchema>;
