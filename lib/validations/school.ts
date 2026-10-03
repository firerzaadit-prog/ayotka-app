import { z } from "zod";
import { KABUPATEN_KOTA_JATIM } from "@/lib/constants/wilayah";
import { adalahTanggalKalender } from "@/lib/utils/datetime";

const schoolBaseSchema = z.object({
  nama: z.string().trim().min(3, "Nama sekolah minimal 3 karakter"),
  npsn: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "NPSN harus 8 digit angka")
    .optional()
    .or(z.literal("")),
  jenjang: z.enum(["SD", "SMP"]),
  alamat: z.string().trim().optional().or(z.literal("")),
  /// Opsional (bukan wajib) supaya sekolah lama & sekolah yang dibuat lewat
  /// jalur lain (registrasi mandiri, approve antrean pending) tidak diblokir -
  /// tapi WAJIB diisi kalau sekolah ini ingin muncul di dashboard dinas
  /// pendidikan wilayahnya (lihat lib/dinas/wilayah.ts).
  kabupatenKota: z
    .string()
    .refine((v) => (KABUPATEN_KOTA_JATIM as readonly string[]).includes(v), {
      message: "Pilih kota/kabupaten yang valid",
    })
    .optional()
    .or(z.literal("")),
  /// Hanya saat membuat sekolah: kuota + tanggal berakhir membentuk periode langganan pertama
  /// (lihat lib/billing/periode-sekolah.ts). Wajib berpasangan; perpanjangan lewat halaman periode sekolah.
  seatQuota: z.coerce.number().int().positive("Kuota kursi harus lebih dari 0").optional(),
  validUntil: z
    .string()
    .refine(adalahTanggalKalender, { message: "Tanggal masa berlaku tidak valid" })
    .optional()
    .or(z.literal("")),
  adminEmail: z.string().trim().toLowerCase().email("Format email admin tidak valid").optional().or(z.literal("")),
  adminNama: z.string().trim().min(2, "Nama admin minimal 2 karakter").optional().or(z.literal("")),
});

export const schoolCreateSchema = schoolBaseSchema.superRefine((data, ctx) => {
  const adaKuota = data.seatQuota != null;
  const adaTanggal = Boolean(data.validUntil);
  if (adaKuota !== adaTanggal) {
    ctx.addIssue({
      code: "custom",
      path: [adaKuota ? "validUntil" : "seatQuota"],
      message: "Kuota kursi dan masa berlaku harus diisi bersamaan (atau dua-duanya dikosongkan).",
    });
  }
});

/// Mengubah data sekolah TIDAK menyentuh kuota/masa berlaku/akun admin (itu lewat periode langganan dan
/// halaman admin sekolah); kolom itu dibuang supaya tidak bisa menimpa tabel sekolah langsung.
export const schoolUpdateSchema = schoolBaseSchema
  .omit({ seatQuota: true, validUntil: true, adminEmail: true, adminNama: true })
  .partial()
  .extend({
    status: z.enum(["pending_verifikasi", "aktif", "suspend"]).optional(),
  });

export type SchoolCreateInput = z.infer<typeof schoolCreateSchema>;
export type SchoolUpdateInput = z.infer<typeof schoolUpdateSchema>;

/** Tiket 7.4: aksi admin pusat atas antrean sekolah pending dari siswa mandiri. */
export const schoolPendingActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    nama: z.string().trim().min(3, "Nama sekolah minimal 3 karakter"),
    npsn: z
      .string()
      .trim()
      .regex(/^\d{8}$/, "NPSN harus 8 digit angka")
      .optional()
      .or(z.literal("")),
    alamat: z.string().trim().optional().or(z.literal("")),
  }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("merge"), targetSchoolId: z.string().uuid() }),
]);
export type SchoolPendingActionInput = z.infer<typeof schoolPendingActionSchema>;
