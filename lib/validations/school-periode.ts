import { z } from "zod";
import { adalahTanggalKalender } from "@/lib/utils/datetime";
import { TENGGANG_MAKS_HARI } from "@/lib/billing/periode-sekolah";

/**
 * Periode langganan sekolah (lib/billing/periode-sekolah.ts). Tanggal dikirim sebagai tanggal kalender WIB
 * ("yyyy-MM-dd", dari input date HTML), BUKAN timestamp UTC: server yang mengubahnya jadi awal hari (mulai)
 * dan akhir hari (berakhir) WIB, supaya "berlaku sampai {tanggal}" berlaku sepanjang hari itu.
 *
 * referredByPartnerId HANYA boleh diisi saat aktivasi PERTAMA sekolah (Bagian 4.1) - lihat pengecekan di
 * app/api/admin-pusat/schools/[id]/periode/route.ts. Komisi mitra saat perpanjangan tetap manual.
 */
const tanggal = z.string().refine(adalahTanggalKalender, { message: "Tanggal tidak valid (format yyyy-MM-dd)." });
const kuota = z.coerce.number().int().min(1, "Kuota kursi minimal 1").max(100000, "Kuota kursi maksimal 100.000");
const tenggang = z.coerce.number().int().min(0, "Masa tenggang tidak boleh negatif").max(TENGGANG_MAKS_HARI, `Masa tenggang maksimal ${TENGGANG_MAKS_HARI} hari`);
const teks = (maks: number) => z.string().trim().max(maks, `Maksimal ${maks} karakter`).nullable();

export const periodeBuatSchema = z.object({
  nama: teks(100).optional(),
  mulai: tanggal,
  berakhir: tanggal,
  seatQuota: kuota,
  masaTenggangHari: tenggang.optional(),
  catatan: teks(500).optional(),
  referredByPartnerId: z.string().uuid().optional().nullable(),
  /** Bila periode ini dibuat untuk memenuhi permintaan perpanjangan admin sekolah: permintaan itu ikut ditandai disetujui. */
  permintaanId: z.string().uuid().optional().nullable(),
});

export const periodeUbahSchema = z
  .object({
    nama: teks(100).optional(),
    mulai: tanggal.optional(),
    berakhir: tanggal.optional(),
    seatQuota: kuota.optional(),
    masaTenggangHari: tenggang.optional(),
    catatan: teks(500).optional(),
    /** true = batalkan periode (salah input): kursi siswa dari periode itu ikut dicabut. */
    dicabut: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "Tidak ada perubahan yang dikirim." });

/** Admin sekolah mengajukan perpanjangan (halaman Periode Baru). Tanggal kalender WIB seperti periode. */
export const permintaanBuatSchema = z.object({
  kuotaDiminta: kuota,
  mulai: tanggal,
  berakhir: tanggal,
  catatan: teks(500).optional(),
});

/** Admin pusat menolak permintaan perpanjangan (menyetujui = membuat periode dengan permintaanId). */
export const permintaanTolakSchema = z.object({
  aksi: z.literal("tolak"),
  catatanAdmin: teks(500).optional(),
});

export type PeriodeBuatInput = z.infer<typeof periodeBuatSchema>;
export type PeriodeUbahInput = z.infer<typeof periodeUbahSchema>;
