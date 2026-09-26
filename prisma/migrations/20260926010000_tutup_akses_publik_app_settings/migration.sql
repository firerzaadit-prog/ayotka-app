-- app_settings berisi kunci bypass maintenance & kolom kunci API terenkripsi.
-- Kebijakan ini (dibuat manual lewat dashboard, bukan migrasi) membuka SELECT
-- untuk anon/authenticated supaya proxy.ts bisa membaca status maintenance
-- pakai anon key - akibatnya siapa pun bisa membaca seluruh isi tabel lewat
-- REST API Supabase. proxy.ts sekarang memakai service_role (melewati RLS),
-- jadi tidak ada lagi yang perlu membaca tabel ini lewat API publik.
-- WAJIB diterapkan SETELAH proxy.ts versi baru live di production.
DROP POLICY IF EXISTS "Allow select on app_settings" ON "app_settings";
