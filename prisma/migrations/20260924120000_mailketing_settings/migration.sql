-- Kredensial email cadangan Mailketing di Pengaturan Sistem (admin pusat),
-- pola sama dengan kolom Resend. Kolom nullable & tambahan saja - tidak
-- mengubah data yang ada.
ALTER TABLE "app_settings" ADD COLUMN "mailketing_api_token_encrypted" TEXT;
ALTER TABLE "app_settings" ADD COLUMN "mailketing_from_email" TEXT;
