/**
 * Naikkan nilai ini tiap kali struktur/isi prompt di lib/ai/prompt.ts
 * berubah signifikan - disimpan di ai_analyses.versi_prompt supaya nanti
 * gampang bedakan hasil lama vs baru kalau prompt direvisi. Dibandingkan
 * dengan versiPrompt tersimpan di GET /api/attempts/[id]/analisis-ai
 * (field "outdated" di respons) supaya UI bisa menandai hasil lama.
 *
 * 2026-09-v2: prompt sekarang menyertakan SEMUA soal + jawaban siswa vs
 * kunci vs pembahasan (sebelumnya cuma sampel soal salah yang dipotong).
 * 2026-09-v3: prompt sekarang menyertakan nama materi & sub materi (dulu
 * cuma kode+deskripsi kompetensi) di peta kompetensi & tiap rincian soal.
 * 2026-09-v4 (Bagian 8.2 brief): prompt menyertakan ringkasan Kerangka
 * Asesmen TKA resmi (kalau tersedia untuk mapel paket ujian ini) sebagai
 * acuan pembanding narasi per kompetensi - lihat lib/content/kerangka-asesmen.ts.
 * 2026-09-v5: struktur output disesuaikan menjadi 5 bagian: Ringkasan Kemampuan,
 * Peta Kompetensi AI, Kelebihan Siswa, Kekurangan Siswa, Rekomendasi Belajar.
 * 2026-09-v6: persona guru analis pendidikan dengan Bahasa Indonesia baku santun
 * yang berbicara langsung kepada siswa.
 * 2026-09-v7 (permintaan user): field output "petaKompetensi" (Peta Kompetensi AI,
 * narasi per kode kompetensi) dihapus - dianggap redundan dengan Peta Kompetensi
 * (bar chart per materi) yang sudah dihitung program, bukan AI. Struktur output
 * sekarang 4 bagian: Ringkasan, Kelebihan Siswa, Kekurangan Siswa, Rekomendasi -
 * ketiga bagian terakhir WAJIB menyebut nama materi/sub-materi spesifik (bukan
 * generik) dan dibatasi ketat ke materi yang benar-benar ada di matriks asesmen
 * paket ini (tidak boleh menyinggung topik di luar itu).
 */
export const PROMPT_VERSION = "2026-09-v7";
