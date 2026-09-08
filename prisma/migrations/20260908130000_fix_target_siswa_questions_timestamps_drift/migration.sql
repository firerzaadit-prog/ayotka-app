-- Perbaikan drift skema: packages.target_siswa (+ enum TargetSiswa) dan
-- questions.created_at/updated_at ada di schema.prisma sejak lama (fitur
-- Latihan Mandiri / tiket "bolehDipilihSiswa") tapi TIDAK PERNAH tercatat di
-- migration manapun - kemungkinan ditambahkan lewat `prisma db push` sekali
-- waktu, bukan `prisma migrate dev`, jadi lolos dari riwayat migrasi.
--
-- Dampaknya: database mana pun yang dibangun murni dari `prisma migrate
-- deploy` (bukan disinkronkan lewat db push) akan KEHILANGAN kolom-kolom
-- ini, dan setiap query Prisma yang menyentuh kolom penuh model Package
-- (mis. `include: { package: true }` tanpa `select` spesifik - persis pola
-- yang dipakai halaman Detail Riwayat Siswa) akan gagal dengan error
-- database "column target_siswa does not exist" (P2022).
--
-- Ditulis idempoten (guard "IF NOT EXISTS"/exception check) karena database
-- yang pernah disinkronkan manual lewat `db push` (kemungkinan termasuk
-- produksi) bisa saja SUDAH punya sebagian atau semua kolom ini.
DO $$ BEGIN
  CREATE TYPE "TargetSiswa" AS ENUM ('sekolah', 'mandiri', 'semua');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "target_siswa" "TargetSiswa" NOT NULL DEFAULT 'semua';

ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
