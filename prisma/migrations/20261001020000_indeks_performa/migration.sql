-- Indeks kunci asing untuk jalur panas (membuka/mengerjakan ujian, daftar & riwayat,
-- ranking, analitik, saldo). Temuan Supabase performance advisor "unindexed_foreign_keys":
-- tanpa indeks, tiap query by kunci asing memindai seluruh tabel, yang makin lambat begitu
-- ribuan siswa x puluhan soal tersimpan.
--
-- HANYA tabel di schema `public` (milik AyoTKA). Schema `soal` (aplikasi soal.ayotka.id)
-- sengaja tidak disentuh - database ini dipakai bersama.
-- Aman dijalankan ulang (IF NOT EXISTS). Tabel masih kecil sekarang, jadi pembuatan indeks
-- selesai dalam hitungan milidetik. Membatalkan: DROP INDEX "<nama_indeks>".
CREATE INDEX IF NOT EXISTS "assignments_school_id_idx" ON "assignments"("school_id");
CREATE INDEX IF NOT EXISTS "assignments_package_id_idx" ON "assignments"("package_id");
CREATE INDEX IF NOT EXISTS "attempt_answers_question_id_idx" ON "attempt_answers"("question_id");
CREATE INDEX IF NOT EXISTS "attempts_student_id_idx" ON "attempts"("student_id");
CREATE INDEX IF NOT EXISTS "attempts_package_id_idx" ON "attempts"("package_id");
CREATE INDEX IF NOT EXISTS "attempts_assignment_id_idx" ON "attempts"("assignment_id");
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX IF NOT EXISTS "competency_scores_kompetensi_id_idx" ON "competency_scores"("kompetensi_id");
CREATE INDEX IF NOT EXISTS "invoices_student_id_idx" ON "invoices"("student_id");
CREATE INDEX IF NOT EXISTS "invoices_plan_id_idx" ON "invoices"("plan_id");
CREATE INDEX IF NOT EXISTS "login_logs_user_id_idx" ON "login_logs"("user_id");
CREATE INDEX IF NOT EXISTS "packages_subject_id_idx" ON "packages"("subject_id");
CREATE INDEX IF NOT EXISTS "question_categories_question_id_idx" ON "question_categories"("question_id");
CREATE INDEX IF NOT EXISTS "question_options_question_id_idx" ON "question_options"("question_id");
CREATE INDEX IF NOT EXISTS "question_statements_question_id_idx" ON "question_statements"("question_id");
CREATE INDEX IF NOT EXISTS "question_statements_correct_category_id_idx" ON "question_statements"("correct_category_id");
CREATE INDEX IF NOT EXISTS "questions_package_id_idx" ON "questions"("package_id");
CREATE INDEX IF NOT EXISTS "questions_kompetensi_id_idx" ON "questions"("kompetensi_id");
CREATE INDEX IF NOT EXISTS "saldo_transactions_student_id_status_idx" ON "saldo_transactions"("student_id", "status");
CREATE INDEX IF NOT EXISTS "students_school_id_idx" ON "students"("school_id");
