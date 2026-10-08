import { z } from "zod";
import { adalahKabupatenKota, adalahProvinsi, periksaPasanganWilayah, STATUS_SEKOLAH } from "@/lib/wilayah";
import { adalahTanggalKalender } from "@/lib/utils/datetime";

/// Isian wilayah + status sekolah, dipakai bersama oleh sekolah (admin pusat), antrean sekolah baru, dan pendaftaran
/// siswa mandiri. Semuanya opsional di sini; "" artinya dikosongkan. Pasangan provinsi + kabupaten/kota diperiksa
/// bersama (kabupaten/kota harus berada di provinsinya) oleh periksaPasanganWilayah.
export const wilayahSekolahFields = {
  provinsi: z
    .string()
    .trim()
    .refine((v) => v === "" || adalahProvinsi(v), { message: "Pilih provinsi yang valid" })
    .optional(),
  kabupatenKota: z
    .string()
    .trim()
    .refine((v) => v === "" || adalahKabupatenKota(v), { message: "Pilih kota/kabupaten yang valid" })
    .optional(),
  statusSekolah: z.union([z.enum(STATUS_SEKOLAH), z.literal("")]).optional(),
};

/** Tambahkan galat bila kabupaten/kota tidak berada di provinsi yang dikirim bersamanya. */
export function periksaWilayahPadaSkema(
  data: { provinsi?: string; kabupatenKota?: string },
  ctx: z.RefinementCtx,
) {
  if (!data.provinsi || !data.kabupatenKota) return;
  const hasil = periksaPasanganWilayah({ provinsi: data.provinsi, kabupatenKota: data.kabupatenKota });
  if (!hasil.ok) ctx.addIssue({ code: "custom", path: ["kabupatenKota"], message: hasil.pesan });
}

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
  /// Opsional (bukan wajib) supaya sekolah lama & sekolah yang dibuat lewat jalur lain (registrasi mandiri, approve
  /// antrean pending) tidak diblokir - tapi WAJIB diisi kalau sekolah ini ingin muncul di dashboard dinas pendidikan
  /// wilayahnya (lihat lib/dinas/wilayah.ts) dan di pemetaan nilai per wilayah.
  ...wilayahSekolahFields,
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
  periksaWilayahPadaSkema(data, ctx);
});

/// Mengubah data sekolah TIDAK menyentuh kuota/masa berlaku/akun admin (itu lewat periode langganan dan
/// halaman admin sekolah); kolom itu dibuang supaya tidak bisa menimpa tabel sekolah langsung.
export const schoolUpdateSchema = schoolBaseSchema
  .omit({ seatQuota: true, validUntil: true, adminEmail: true, adminNama: true })
  .partial()
  .extend({
    status: z.enum(["pending_verifikasi", "aktif", "suspend"]).optional(),
  })
  .superRefine(periksaWilayahPadaSkema);

/// Profil sekolah yang boleh diubah admin sekolah sendiri: alamat, wilayah, dan status sekolah. Nama, NPSN, jenjang,
/// status akun, dan langganan tetap hanya di tangan admin pusat.
export const profilSekolahUpdateSchema = z
  .object({
    alamat: z.string().trim().max(300, "Alamat maksimal 300 karakter").optional(),
    ...wilayahSekolahFields,
  })
  .superRefine(periksaWilayahPadaSkema);

export type SchoolCreateInput = z.infer<typeof schoolCreateSchema>;
export type SchoolUpdateInput = z.infer<typeof schoolUpdateSchema>;
export type ProfilSekolahUpdateInput = z.infer<typeof profilSekolahUpdateSchema>;

/** Tiket 7.4: aksi admin pusat atas antrean sekolah pending dari siswa mandiri. */
export const schoolPendingActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("approve"),
      nama: z.string().trim().min(3, "Nama sekolah minimal 3 karakter"),
      npsn: z
        .string()
        .trim()
        .regex(/^\d{8}$/, "NPSN harus 8 digit angka")
        .optional()
        .or(z.literal("")),
      alamat: z.string().trim().optional().or(z.literal("")),
      ...wilayahSekolahFields,
    })
    .superRefine(periksaWilayahPadaSkema),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("merge"), targetSchoolId: z.string().uuid() }),
]);
export type SchoolPendingActionInput = z.infer<typeof schoolPendingActionSchema>;
