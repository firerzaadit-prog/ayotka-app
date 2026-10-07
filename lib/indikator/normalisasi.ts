/**
 * Kunci pencocokan teks indikator: spasi berurutan/di tepi dirapikan dan huruf dibuat kecil semua. Hanya itu - sengaja
 * TIDAK ada pencocokan mirip-mirip atau lewat nomor "(N)": diuji pada data nyata (7 Okt 2026), nomor yang sama di
 * generator soal.ayotka.id dan di master resmi sering berarti indikator yang sama sekali berbeda (mis. nomor 12:
 * "Menilai dampak sosial ekonomi..." vs "Menilai ketepatan antara ilustrasi dengan isi teks"), jadi pencocokan lewat
 * nomor akan menukar nilai rapor. Soal yang tidak persis sama dibiarkan jujur sebagai "di luar indikator resmi".
 */
export function kunciTeksIndikator(teks: string | null | undefined): string {
  return String(teks ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Kode jenjang master (SD/SMP/SMA) dari nama jenjang mana pun ("SD/MI", "SMP/MTs", "SD"). null bila tak dikenali. */
export function kodeJenjangMaster(jenjang: string | null | undefined): "SD" | "SMP" | "SMA" | null {
  const j = String(jenjang ?? "").trim().toUpperCase();
  if (/^SD(\b|\/|$)/.test(j)) return "SD";
  if (/^SMP(\b|\/|$)/.test(j)) return "SMP";
  if (/^SMA(\b|\/|$)/.test(j)) return "SMA";
  return null;
}

/** Kunci gabungan jenjang + mapel + teks, dipakai sebagai kunci Map pencocokan dan keunikan master. */
export function kunciMaster(jenjang: string, namaMapel: string, teksKunci: string): string {
  return `${jenjang}|${namaMapel.trim().toLowerCase()}|${teksKunci}`;
}
