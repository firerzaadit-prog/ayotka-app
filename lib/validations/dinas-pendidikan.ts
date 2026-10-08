import { z } from "zod";
import { adalahKabupatenKota, adalahProvinsi, periksaPasanganWilayah } from "@/lib/wilayah";

/**
 * Wilayah cakupan akun dinas pendidikan se-Indonesia. Dengan kota/kabupaten = Dinas Kota/Kabupaten (hanya sekolah di
 * situ); hanya provinsi = Dinas Provinsi (semua sekolah di provinsi itu). Isian kota/kabupaten saja (formulir lama)
 * tetap diterima: provinsinya diturunkan dari nama kota/kabupaten oleh rute. "" berarti dikosongkan.
 */
const provinsiOpsional = z
  .string()
  .trim()
  .refine((v) => v === "" || adalahProvinsi(v), { message: "Pilih provinsi yang valid" });

const kabupatenKotaOpsional = z
  .string()
  .trim()
  .refine((v) => v === "" || adalahKabupatenKota(v), { message: "Pilih kota/kabupaten yang valid" });

function periksaPasangan(data: { provinsi?: string; kabupatenKota?: string }, ctx: z.RefinementCtx) {
  const hasil = periksaPasanganWilayah({ provinsi: data.provinsi, kabupatenKota: data.kabupatenKota });
  if (!hasil.ok) ctx.addIssue({ code: "custom", path: ["kabupatenKota"], message: hasil.pesan });
}

export const dinasAdminCreateSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Email tidak valid"),
    nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
    instansi: z.string().trim().min(2, "Nama instansi minimal 2 karakter"),
    provinsi: provinsiOpsional.optional(),
    kabupatenKota: kabupatenKotaOpsional.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.provinsi && !data.kabupatenKota) {
      ctx.addIssue({ code: "custom", path: ["provinsi"], message: "Pilih provinsi wilayah cakupan" });
      return;
    }
    periksaPasangan(data, ctx);
  });

export type DinasAdminCreateInput = z.infer<typeof dinasAdminCreateSchema>;

export const dinasAdminUpdateSchema = z
  .object({
    nama: z.string().trim().min(2, "Nama minimal 2 karakter").optional(),
    instansi: z.string().trim().min(2, "Nama instansi minimal 2 karakter").optional(),
    provinsi: provinsiOpsional.optional(),
    kabupatenKota: kabupatenKotaOpsional.optional(),
    status: z.enum(["aktif", "nonaktif"]).optional(),
  })
  .superRefine(periksaPasangan);

export type DinasAdminUpdateInput = z.infer<typeof dinasAdminUpdateSchema>;
