import { z } from "zod";

/**
 * Nomor WhatsApp/HP Indonesia. Spasi, titik, tanda hubung, dan kurung dibuang; awalan +62 / 62 diubah jadi 0 supaya
 * tersimpan seragam ("08xxxxxxxxxx"). Kosong = menghapus nomor (null). Mengembalikan "tidak_valid" bila bentuknya salah.
 */
export function normalisasiNomorWa(input: string | null | undefined): string | null | "tidak_valid" {
  const mentah = (input ?? "").trim();
  if (mentah === "") return null;
  let angka = mentah.replace(/[\s().-]/g, "");
  if (angka.startsWith("+62")) angka = `0${angka.slice(3)}`;
  else if (angka.startsWith("62")) angka = `0${angka.slice(2)}`;
  return /^08\d{8,12}$/.test(angka) ? angka : "tidak_valid";
}

/** Ubah data diri siswa. Minimal satu kolom harus dikirim. Nama hanya boleh diubah siswa mandiri (diperiksa di rute). */
export const profilUpdateSchema = z
  .object({
    nama: z.string().trim().min(2, "Nama minimal 2 karakter").max(100, "Nama maksimal 100 karakter").optional(),
    waKontak: z.string().max(40, "Nomor terlalu panjang").nullable().optional(),
  })
  .refine((d) => d.nama !== undefined || d.waKontak !== undefined, { message: "Tidak ada data yang diubah." })
  .superRefine((d, ctx) => {
    if (d.waKontak !== undefined && normalisasiNomorWa(d.waKontak) === "tidak_valid") {
      ctx.addIssue({
        code: "custom",
        path: ["waKontak"],
        message: "Nomor WhatsApp tidak valid. Contoh: 081234567890 (tanpa spasi atau dengan awalan +62).",
      });
    }
  });

/** Batas 72 karakter: bcrypt (yang dipakai layanan login) hanya membaca 72 byte pertama. */
export const PANJANG_PASSWORD_MAKS = 72;

export const gantiPasswordSchema = z
  .object({
    passwordLama: z.string().min(1, "Password saat ini wajib diisi"),
    passwordBaru: z
      .string()
      .min(8, "Password baru minimal 8 karakter")
      .max(PANJANG_PASSWORD_MAKS, `Password baru maksimal ${PANJANG_PASSWORD_MAKS} karakter`),
    konfirmasi: z.string(),
  })
  .refine((d) => d.passwordBaru === d.konfirmasi, { message: "Konfirmasi password tidak cocok", path: ["konfirmasi"] })
  .refine((d) => d.passwordBaru !== d.passwordLama, {
    message: "Password baru harus berbeda dari password saat ini",
    path: ["passwordBaru"],
  });

export const gantiEmailSchema = z.object({
  emailBaru: z.string().trim().toLowerCase().email("Email tidak valid").max(254, "Email terlalu panjang"),
  password: z.string().min(1, "Password saat ini wajib diisi"),
});

export type ProfilUpdateInput = z.infer<typeof profilUpdateSchema>;
export type GantiPasswordInput = z.infer<typeof gantiPasswordSchema>;
export type GantiEmailInput = z.infer<typeof gantiEmailSchema>;
