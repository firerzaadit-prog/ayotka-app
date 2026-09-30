-- Urutan paket dalam satu seri Try Out Mandiri berjalan harian (lihat
-- lib/exam/seri-mandiri.ts). Null = paket berdiri sendiri, perilaku lama
-- tidak berubah.
ALTER TABLE "packages" ADD COLUMN "urutan_seri" INTEGER;
