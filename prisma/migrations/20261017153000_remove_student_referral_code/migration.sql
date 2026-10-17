-- Hapus kolom referral_code dari tabel students (17 Okt 2026).
-- Siswa tidak lagi memiliki kode referral. Kode referral / klaim voucher hanya diperoleh dari mitra.

-- DropIndex
DROP INDEX IF EXISTS "students_referral_code_key";

-- AlterTable
ALTER TABLE "students" DROP COLUMN IF EXISTS "referral_code";
