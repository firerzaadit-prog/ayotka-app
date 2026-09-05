-- Kolom guard konkurensi berbasis database, menggantikan Map/Set in-memory
-- di lib/exam/session-guard.ts & lib/ai/analysis-guard.ts. Map/Set per-proses
-- itu cuma valid untuk 1 instance server, sementara target deploy
-- sesungguhnya (Vercel serverless) bisa menjalankan banyak instance
-- sekaligus - state guard perlu dibagi lewat database supaya "satu sesi
-- aktif per attempt" dan "satu proses AI per attempt" konsisten lintas
-- instance mana pun yang menangani request berikutnya.
ALTER TABLE "attempts" ADD COLUMN "active_tab_token" TEXT;
ALTER TABLE "attempts" ADD COLUMN "active_tab_last_seen" TIMESTAMP(3);
ALTER TABLE "attempts" ADD COLUMN "ai_analysis_processing_at" TIMESTAMP(3);
ALTER TABLE "attempts" ADD COLUMN "ai_analysis_last_error" TEXT;
