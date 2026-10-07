import { z } from "zod";
import { dariInputWaktuWIB } from "@/lib/utils/datetime";

/**
 * Waktu dari form jadwal menjadi Date. Teks tanpa zona ("2026-10-08T08:00", isi <input type="datetime-local">)
 * dibaca sebagai WIB, bukan waktu setempat server - lihat dariInputWaktuWIB di lib/utils/datetime.ts untuk alasannya.
 * Pengganti z.coerce.date() pada semua jadwal yang diketik admin.
 */
export const waktuWIB = z.string({ error: "Waktu wajib diisi." }).transform((nilai, ctx) => {
  const hasil = dariInputWaktuWIB(nilai);
  if (!hasil) {
    ctx.addIssue({ code: "custom", message: "Format waktu tidak valid." });
    return z.NEVER;
  }
  return hasil;
});
