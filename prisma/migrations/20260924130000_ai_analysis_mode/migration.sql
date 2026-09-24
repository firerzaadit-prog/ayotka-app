-- Mode pemrosesan Analisis AI: "langsung" (default, perilaku lama - diproses
-- begitu ujian selesai) atau "antrean" (cron berlaju terkendali, untuk
-- lonjakan Try Out Nasional). Default "langsung" supaya deploy antrean tidak
-- menurunkan layanan di plan Vercel Hobby (cron cuma sekali/hari).
ALTER TABLE "app_settings" ADD COLUMN "ai_analysis_mode" TEXT NOT NULL DEFAULT 'langsung';
