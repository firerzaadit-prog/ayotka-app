export type PesanTutor = { role: "user" | "assistant"; content: string };

/**
 * Ambil paling banyak `maks` pesan TERAKHIR sebagai riwayat yang dikirim ke Tutor AI. Percakapan yang dikirim harus
 * dimulai dari pesan siswa (aturan server), jadi pesan tutor di awal potongan dibuang. Dipakai klien sebelum mengirim.
 */
export function potongRiwayat<T extends PesanTutor>(pesan: T[], maks: number): T[] {
  const akhir = pesan.slice(Math.max(0, pesan.length - maks));
  let awal = 0;
  while (awal < akhir.length && akhir[awal]!.role !== "user") awal++;
  return akhir.slice(awal);
}
