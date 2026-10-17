/**
 * Sumber angka "rerata nasional" di semua tabel daya serap (rapor siswa, laporan sekolah, dinas pendidikan, PDF, Excel):
 * rata-rata nasional per indikator dari portal resmi daya serap TKA Kemendikdasmen untuk tahun ajaran di bawah ini.
 *
 * Satu tempat supaya tahun ajarannya tidak berbeda-beda antar tampilan. Pada permintaan user (16 Okt 2026) tiap tabel
 * yang memuat rujukan nasional wajib menuliskan sumbernya; tests/unit/catatan-rujukan-nasional.test.ts memastikan
 * setiap tampilan itu memakai kalimat ini, jadi menambah tabel nasional baru tanpa catatan akan ketahuan.
 *
 * Murni (tanpa import server/React) agar bisa dipakai komponen web, pembuat PDF, dan pembuat Excel.
 */
export const TAHUN_AJARAN_RUJUKAN_NASIONAL = "2025/2026";

/** Kalimat catatan di bawah tabel: "Rujukan nasional berdasarkan data hasil TKA tahun ajaran 2025/2026." */
export const CATATAN_RUJUKAN_NASIONAL = `Rujukan nasional berdasarkan data hasil TKA tahun ajaran ${TAHUN_AJARAN_RUJUKAN_NASIONAL}.`;
