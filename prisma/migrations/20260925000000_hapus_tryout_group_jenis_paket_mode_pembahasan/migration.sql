-- Keputusan user (25 Sep 2026):
-- 1) Fitur "Grup Try Out" (pooling beberapa variasi paket + pemilihan acak
--    per siswa) dihapus - dalam praktiknya paket yang disebar selalu satu
--    saja, soal & urutan opsi tetap teracak per siswa lewat
--    Package.acak_soal/acak_opsi. Try Out Nasional sekarang dikelola
--    langsung di Bank Soal (Package.kategori), tidak lewat tabel terpisah.
--    Audit sebelum migrasi ini: cuma ada 1 TryOutGroup (status draft, 1
--    variasi arsip tanpa soal) dan 0 attempt yang terkait - aman dihapus
--    tanpa migrasi data.
-- 2) Package.jenis_paket (tryout/latihan) dihapus - semua paket sekarang
--    setara boleh dianalisis AI, kelayakannya murni ditentukan kondisi
--    langganan siswa (semester/bulanan/free) saat attempt dibuat, bukan
--    flag per-paket. Semua baris yang ada sudah 'tryout' (0 baris 'latihan'),
--    jadi tidak ada informasi yang hilang.
-- 3) Package.mode_pembahasan dihapus - pembahasan sekarang SELALU tampil
--    langsung setelah siswa submit (menyederhanakan, mengurangi risiko bug
--    dari gerbang jadwal assignment.selesai yang lama).

-- DropForeignKey
ALTER TABLE "packages" DROP CONSTRAINT IF EXISTS "packages_try_out_group_id_fkey";
ALTER TABLE "try_out_group_visibility" DROP CONSTRAINT IF EXISTS "try_out_group_visibility_group_id_fkey";
ALTER TABLE "try_out_group_visibility" DROP CONSTRAINT IF EXISTS "try_out_group_visibility_school_id_fkey";
ALTER TABLE "try_out_groups" DROP CONSTRAINT IF EXISTS "try_out_groups_subject_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "try_out_group_visibility";
DROP TABLE IF EXISTS "try_out_groups";

-- DropColumn
ALTER TABLE "packages" DROP COLUMN IF EXISTS "try_out_group_id";
ALTER TABLE "packages" DROP COLUMN IF EXISTS "jenis_paket";
ALTER TABLE "packages" DROP COLUMN IF EXISTS "mode_pembahasan";

-- DropEnum
DROP TYPE IF EXISTS "JenisPaket";
DROP TYPE IF EXISTS "ModePembahasan";
