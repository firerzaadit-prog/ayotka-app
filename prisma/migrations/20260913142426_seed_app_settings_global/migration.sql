-- Pastikan baris "global" selalu ada di app_settings sebelum aplikasi menerima
-- traffic - menghindari race condition upsert di Vercel multi-instance cold start
-- (lihat lib/ai/settings.ts: getAiAutoAnalysisSettings memakai upsert-on-read
-- supaya tidak bergantung seed script, tapi di cold start banyak instance bisa
-- race saat baris belum ada). ON CONFLICT DO NOTHING = idempoten, aman dijalankan
-- ulang kalau baris sudah ada dari migrasi sebelumnya.
INSERT INTO "app_settings" ("id", "ai_auto_analysis_max_per_subject", "updated_at")
VALUES ('global', 3, NOW())
ON CONFLICT ("id") DO NOTHING;
