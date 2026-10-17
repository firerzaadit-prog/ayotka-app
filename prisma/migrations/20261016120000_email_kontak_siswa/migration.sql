-- Email kontak untuk akun siswa yang masuk dengan NISN (16 Okt 2026). Aditif: dua kolom baru yang boleh kosong di
-- students; tidak mengubah atau menghapus data. Akun NISN memakai email login sintetis ({nisn}@nisn.ayotka.id) yang tidak
-- punya kotak surat, jadi tidak bisa menerima tautan lupa password atau bukti pembayaran. Email kontak ini terpisah dari
-- email login dan hanya dipakai bila sudah diverifikasi (email_kontak_verified_at terisi).

-- AlterTable
ALTER TABLE "students" ADD COLUMN "email_kontak" TEXT,
ADD COLUMN "email_kontak_verified_at" TIMESTAMP(3);
