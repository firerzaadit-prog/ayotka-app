-- Wilayah cakupan dinas pendidikan (kota/kabupaten Jawa Timur). Kolom
-- `schools.kabupaten_kota` dan tabel `dinas_admins` SUDAH ADA di database
-- production (dibuat lewat `prisma db push` di sesi sebelumnya, sebelum
-- fitur ini selesai dikerjakan) - migrasi ini idempotent (IF NOT EXISTS) supaya
-- aman dijalankan di production yang sudah punya strukturnya, sekaligus tetap
-- berfungsi di database baru/lokal yang belum punya sama sekali.

ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "kabupaten_kota" TEXT;

CREATE TABLE IF NOT EXISTS "dinas_admins" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nama" TEXT NOT NULL,
    "instansi" TEXT NOT NULL,
    "kabupaten_kota" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dinas_admins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dinas_admins_user_id_key" ON "dinas_admins"("user_id");

DO $$ BEGIN
    ALTER TABLE "dinas_admins" ADD CONSTRAINT "dinas_admins_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
