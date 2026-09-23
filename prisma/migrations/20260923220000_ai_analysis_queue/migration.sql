-- Antrean Analisis AI: attempt yang lolos jatah ditandai "masuk antrean" di
-- sini dulu (bukan langsung memanggil Gemini via after() seperti sebelumnya).
-- Cron app/api/cron/proses-antrean-ai yang benar-benar memproses, dengan laju
-- dibatasi - lihat lib/ai/queue-worker.ts.
ALTER TABLE "attempts" ADD COLUMN "ai_analysis_queued_at" TIMESTAMP(3);
