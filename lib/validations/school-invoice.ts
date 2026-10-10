import { z } from "zod";

export const schoolInvoiceCreateSchema = z.object({
  jumlahSiswa: z.number().int().min(1, "Jumlah siswa minimal 1."),
  hargaPerSiswa: z.number().int().min(0, "Harga per siswa tidak boleh negatif."),
  jatuhTempo: z.string().min(1, "Tanggal jatuh tempo wajib diisi."),
  keterangan: z.string().max(250).optional().nullable(),
  bankTujuan: z.string().max(250).optional().nullable(),
  catatan: z.string().max(500).optional().nullable(),
  periodeId: z.string().uuid().optional().nullable(),
});

export const schoolInvoiceUpdateSchema = z.object({
  status: z.enum(["menunggu_pembayaran", "lunas", "dibatalkan"]).optional(),
  jumlahSiswa: z.number().int().min(1).optional(),
  hargaPerSiswa: z.number().int().min(0).optional(),
  jatuhTempo: z.string().optional(),
  keterangan: z.string().max(250).optional().nullable(),
  bankTujuan: z.string().max(250).optional().nullable(),
  catatan: z.string().max(500).optional().nullable(),
});
