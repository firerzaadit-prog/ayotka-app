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
 * Baris ai_analyses lama masih ber-versiPrompt lama sampai di-"Analisis
 * ulang".
 */
export const PROMPT_VERSION = "2026-09-v3";
