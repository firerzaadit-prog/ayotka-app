/**
 * Naikkan nilai ini tiap kali struktur/isi prompt di lib/ai/prompt.ts
 * berubah signifikan - disimpan di ai_analyses.versi_prompt supaya nanti
 * gampang bedakan hasil lama vs baru kalau prompt direvisi.
 *
 * 2026-09-v2: prompt sekarang menyertakan SEMUA soal + jawaban siswa vs
 * kunci vs pembahasan (sebelumnya cuma sampel soal salah yang dipotong).
 * Baris ai_analyses lama masih ber-versiPrompt "2026-08-v1" sampai
 * di-"Analisis ulang".
 */
export const PROMPT_VERSION = "2026-09-v2";
