import { z } from "zod";
import { HAPUS_MASSAL_MAKS } from "@/lib/students/batas";

const nisnSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/, "NISN harus 10 digit angka")
  .optional()
  .or(z.literal(""));

export const studentCreateSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
  nisn: nisnSchema,
  tanggalLahir: z.coerce.date().optional(),
  /** Cuma dipakai admin_pusat (lintas sekolah) - admin_sekolah selalu diresolve dari SchoolUser, lihat resolveSchoolId. */
  schoolId: z.string().uuid().optional().or(z.literal("")),
});

export const studentUpdateSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").optional(),
  nisn: nisnSchema,
  tanggalLahir: z.coerce.date().optional(),
});

export const studentImportRowSchema = z.object({
  nama: z.string().trim().min(2, "Nama wajib diisi"),
  nisn: nisnSchema,
  tanggalLahir: z.coerce.date().optional(),
});

/** Klien yang memilih lebih dari batas ini mengirim bertahap (lihat components/sekolah/hapus-massal.tsx). */
export const studentHapusMassalSchema = z.object({
  ids: z
    .array(z.string().uuid("ID siswa tidak valid"))
    .min(1, "Pilih minimal satu siswa")
    .max(HAPUS_MASSAL_MAKS, `Maksimal ${HAPUS_MASSAL_MAKS} siswa per permintaan`),
});

/** Tandai lulus (lulus: true) atau batalkan tanda lulus (lulus: false) untuk banyak siswa; batas ID sama dengan hapus massal. */
export const studentLulusMassalSchema = studentHapusMassalSchema.extend({ lulus: z.boolean() });

export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
export type StudentImportRow = z.infer<typeof studentImportRowSchema>;
