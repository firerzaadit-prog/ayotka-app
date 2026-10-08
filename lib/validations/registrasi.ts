import { z } from "zod";
import { wilayahSekolahFields } from "@/lib/validations/school";
import { periksaPasanganWilayah } from "@/lib/wilayah";

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
    /** Wajib: satu-satunya bukti kepemilikan. Tanggal lahir tidak lagi dipakai (mudah diketahui teman sekelas). */
    kodeKlaim: z.string().trim().min(1, "Kode klaim wajib diisi."),
    punyaEmail: z.boolean(),
    email: z.string().trim().toLowerCase().email("Email tidak valid").optional().or(z.literal("")),
    password: z.string().min(8, "Password minimal 8 karakter"),
  })
  .refine((data) => !data.punyaEmail || (data.email && data.email.length > 0), {
    message: "Email wajib diisi.",
    path: ["email"],
  });

export const daftarMandiriSchema = z
  .object({
    nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
    email: z.string().trim().toLowerCase().email("Email tidak valid"),
    password: z.string().min(8, "Password minimal 8 karakter"),
    jenjang: z.enum(["SD", "SMP"]),
    asalSekolahId: z.string().uuid().optional().or(z.literal("")),
    asalSekolahManual: z
      .string()
      .trim()
      .max(120, "Nama sekolah maksimal 120 karakter")
      .optional()
      .or(z.literal("")),
    /**
     * Wilayah + status sekolah yang diketik manual (sekolah belum ada di daftar). Formulir mewajibkannya supaya nilai
     * siswa bisa dipetakan per wilayah dan jenis sekolah; server tetap menerima pendaftaran tanpa ini (formulir lama
     * yang masih terbuka saat deploy) dan hanya memeriksa kebenaran isian yang ada. Dipakai hanya bila sekolah
     * diketik manual - saat memilih dari daftar, data sekolahnya sudah tercatat.
     */
    asalSekolahProvinsi: wilayahSekolahFields.provinsi,
    asalSekolahKabupatenKota: wilayahSekolahFields.kabupatenKota,
    asalSekolahStatus: wilayahSekolahFields.statusSekolah,
    /** Opsional - kode referral siswa lain, mengisi Student.referredByStudentId (Bagian 6.4). */
    kodeReferral: z.string().trim().optional().or(z.literal("")),
  })
  .refine(
    (data) => (data.asalSekolahId && data.asalSekolahId.length > 0) || (data.asalSekolahManual && data.asalSekolahManual.length > 0),
    { message: "Pilih asal sekolah dari daftar atau ketik manual.", path: ["asalSekolahManual"] },
  )
  .superRefine((data, ctx) => {
    const hasil = periksaPasanganWilayah({ provinsi: data.asalSekolahProvinsi, kabupatenKota: data.asalSekolahKabupatenKota });
    if (!hasil.ok) ctx.addIssue({ code: "custom", path: ["asalSekolahKabupatenKota"], message: hasil.pesan });
  });

/** Bagian A (permintaan user): mitra daftar sendiri, langsung aktif tanpa perlu admin approve. */
export const daftarMitraSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  kontak: z.string().trim().optional().or(z.literal("")),
});

export type CekKodeSekolahInput = z.infer<typeof cekKodeSekolahSchema>;
export type CariSiswaInput = z.infer<typeof cariSiswaSchema>;
export type KlaimInput = z.infer<typeof klaimSchema>;
export type DaftarMandiriInput = z.infer<typeof daftarMandiriSchema>;
export type DaftarMitraInput = z.infer<typeof daftarMitraSchema>;
