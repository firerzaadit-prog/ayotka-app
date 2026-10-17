import { z } from "zod";

/**
 * Domain milik AyoTKA sendiri yang tidak punya kotak surat: email login sintetis akun NISN dan alamat pembayaran khusus
 * (lib/billing/email-pembayaran.ts). Tidak boleh dipakai sebagai email kontak - kontak yang tak bisa menerima apa pun
 * hanya menghasilkan email terpental.
 */
const DOMAIN_TANPA_KOTAK_SURAT = ["nisn.ayotka.id", "bayar.ayotka.id"] as const;

export function adalahDomainTanpaKotakSurat(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  return (DOMAIN_TANPA_KOTAK_SURAT as readonly string[]).includes(domain);
}

const alamatEmailKontak = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email kontak wajib diisi")
  .max(254, "Email terlalu panjang")
  .email("Email tidak valid")
  .refine((v) => !adalahDomainTanpaKotakSurat(v), {
    message: "Pakai email yang benar-benar kamu atau orang tuamu pakai (bukan alamat internal AyoTKA).",
  });

/**
 * Tindakan pada email kontak (POST /api/siswa/profil/email-kontak):
 * - simpan: pasang atau ganti email kontak (wajib password saat ini), lalu kirim tautan verifikasi;
 * - kirim_ulang: kirim lagi tautan verifikasi untuk email kontak yang belum diverifikasi (tanpa password: tidak mengubah apa pun);
 * - hapus: lepas email kontak (wajib password saat ini).
 */
export const emailKontakSchema = z.discriminatedUnion("aksi", [
  z.object({ aksi: z.literal("simpan"), email: alamatEmailKontak, password: z.string().min(1, "Password saat ini wajib diisi") }),
  z.object({ aksi: z.literal("kirim_ulang") }),
  z.object({ aksi: z.literal("hapus"), password: z.string().min(1, "Password saat ini wajib diisi") }),
]);

/** Token dari tautan di email verifikasi (POST /api/auth/verifikasi-email-kontak). */
export const verifikasiEmailKontakSchema = z.object({
  token: z.string().trim().min(20, "Tautan verifikasi tidak lengkap").max(700, "Tautan verifikasi tidak valid"),
});

export type EmailKontakInput = z.infer<typeof emailKontakSchema>;
