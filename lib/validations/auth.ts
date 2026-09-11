import { z } from "zod";

/**
 * Tiket 3.4 (keputusan #22 brief): field ini menerima email ASLI atau NISN
 * (10 digit angka) - siswa SD tanpa email login pakai NISN, backend yang
 * menerjemahkannya jadi email sintetis (lihat app/api/auth/login/route.ts).
 */
/**
 * `portal` menunjukkan halaman login mana yang dipakai user. Divalidasi di
 * server untuk memastikan role akun yang login sesuai dengan portal-nya -
 * mencegah admin pusat/sekolah login lewat halaman siswa (atau sebaliknya).
 */
export const loginSchema = z.object({
  emailOrNisn: z.string().trim().min(1, "Email atau NISN wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
  portal: z.enum(["siswa", "admin_sekolah", "admin_pusat", "dinas_pendidikan"]).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Email tidak valid"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password minimal 8 karakter"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
