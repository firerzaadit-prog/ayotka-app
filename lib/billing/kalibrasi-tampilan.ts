/**
 * Bagian murni dari ringkasan kalibrasi AI (tanpa database), dipakai server (lib/billing/kalibrasi-ai.ts) dan layar admin
 * pusat (components/billing/harga-la-pengaturan.tsx): tipe, rasio nyata/taksiran, dan kesimpulan yang dibaca manusia.
 */
export type KalibrasiAi = {
  /** Jendela waktu ringkasan (hari terakhir). */
  hari: number;
  /** Banyak analisis yang tercatat tokennya pada jendela itu. */
  jumlah: number;
  rataTokenMasuk: number | null;
  rataTokenKeluar: number | null;
  /** Rata-rata taksiran beban AI untuk analisis yang sama. */
  rataTaksiran: number | null;
  /** Rata-rata token masukan nyata dibagi rata-rata taksiran (1 = taksiran tepat; di atas 1 = taksiran terlalu rendah). */
  rasio: number | null;
  totalTokenMasuk: number;
  totalTokenKeluar: number;
};

export const HARI_KALIBRASI = 30;
/** Di bawah ini ringkasan terlalu sedikit untuk dipercaya; layar admin tetap menampilkan angkanya, dengan peringatan. */
export const MINIMAL_ANALISIS_KALIBRASI = 10;
/** Selisih rasio dari 1 yang masih dianggap "cukup tepat". */
export const TOLERANSI_RASIO = 0.15;

/** Rasio nyata/taksiran (dibulatkan 2 desimal); null bila salah satunya tidak ada atau taksiran nol. */
export function hitungRasioKalibrasi(rataNyata: number | null, rataTaksiran: number | null): number | null {
  if (rataNyata === null || rataTaksiran === null || rataTaksiran <= 0) return null;
  return Math.round((rataNyata / rataTaksiran) * 100) / 100;
}

/** Kalimat kesimpulan untuk admin; `cukup` = jumlah analisisnya memadai untuk dipercaya. */
export function kesimpulanKalibrasi(k: KalibrasiAi | null): { teks: string; cukup: boolean } {
  if (!k || k.jumlah === 0) {
    return { teks: "Belum ada analisis yang tercatat tokennya. Angka muncul setelah ada Learning Analytics baru yang selesai diproses.", cukup: false };
  }
  const cukup = k.jumlah >= MINIMAL_ANALISIS_KALIBRASI;
  const peringatan = cukup ? "" : ` Baru ${k.jumlah} analisis tercatat (idealnya minimal ${MINIMAL_ANALISIS_KALIBRASI}); anggap sebagai petunjuk awal.`;
  if (k.rasio === null) return { teks: `Pemakaian nyata belum bisa dibandingkan dengan taksiran.${peringatan}`, cukup };
  // Dibandingkan dalam persen bulat: 1 - 0,85 di floating point = 0,15000000000000002 (bukan 0,15).
  const persen = Math.round(Math.abs(k.rasio - 1) * 100);
  if (persen <= Math.round(TOLERANSI_RASIO * 100)) {
    return { teks: `Taksiran beban AI sudah cukup tepat (selisih sekitar ${persen}%).${peringatan}`, cukup };
  }
  return {
    teks:
      k.rasio > 1
        ? `Pemakaian nyata ${persen}% LEBIH BESAR dari taksiran: modal AI sebenarnya lebih tinggi daripada yang dikira harga.${peringatan}`
        : `Pemakaian nyata ${persen}% LEBIH KECIL dari taksiran: modal AI sebenarnya lebih rendah daripada yang dikira harga.${peringatan}`,
    cukup,
  };
}
