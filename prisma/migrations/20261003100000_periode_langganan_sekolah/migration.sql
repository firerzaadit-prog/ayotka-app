-- Periode langganan sekolah (Fase 1 skema pergantian semester/tahun).
--
-- ADITIF: tabel baru + satu kolom nullable + indeks. Kode lama tidak membaca kolom/tabel ini, jadi migrasi
-- aman dijalankan SEBELUM kode baru di-deploy. Seluruh pernyataan hanya menyentuh skema `public`
-- (database ini dipakai bersama soal.ayotka.id yang memakai skema `soal`).

-- AlterTable
ALTER TABLE "entitlements" ADD COLUMN     "periode_id" UUID;

-- CreateTable
CREATE TABLE "school_periods" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "nama" TEXT,
    "mulai" TIMESTAMP(3) NOT NULL,
    "berakhir" TIMESTAMP(3) NOT NULL,
    "masa_tenggang_hari" INTEGER NOT NULL DEFAULT 14,
    "seat_quota" INTEGER NOT NULL,
    "catatan" TEXT,
    "dicabut_at" TIMESTAMP(3),
    "dibuat_oleh_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_periods_school_id_mulai_idx" ON "school_periods"("school_id", "mulai");

-- CreateIndex
CREATE INDEX "entitlements_periode_id_idx" ON "entitlements"("periode_id");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_student_id_periode_id_key" ON "entitlements"("student_id", "periode_id");

-- AddForeignKey
ALTER TABLE "school_periods" ADD CONSTRAINT "school_periods_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_periods" ADD CONSTRAINT "school_periods_dibuat_oleh_id_fkey" FOREIGN KEY ("dibuat_oleh_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "school_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data awal 1: satu "Periode awal" untuk tiap sekolah yang sudah punya kuota DAN masa berlaku.
-- berakhir = akhir hari WIB dari valid_until (tampilan lama "Berlaku sampai {tanggal}" selalu dimaknai sampai
-- akhir hari itu); mulai = awal hari WIB dari kursi tertua sekolah (atau hari ini bila belum ada kursi).
-- Kolom timestamp disimpan sebagai UTC tanpa zona, jadi dikonversi bolak-balik lewat Asia/Jakarta (UTC+7, tanpa DST).
WITH basis AS (
  SELECT
    s."id" AS school_id,
    s."seat_quota" AS seat_quota,
    s."seat_activated_by_id" AS dibuat_oleh_id,
    ((date_trunc('day',
        (COALESCE(
           (SELECT MIN(e."starts_at") FROM "entitlements" e WHERE e."school_id" = s."id" AND e."source" = 'school_seat'),
           (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
         ) AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta'
      )) AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC' AS awal_hari,
    ((date_trunc('day', (s."valid_until" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')
        + INTERVAL '1 day' - INTERVAL '1 millisecond') AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC' AS akhir_hari
  FROM "schools" s
  WHERE s."seat_quota" IS NOT NULL
    AND s."valid_until" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "school_periods" p WHERE p."school_id" = s."id")
)
INSERT INTO "school_periods" ("id", "school_id", "nama", "mulai", "berakhir", "masa_tenggang_hari", "seat_quota", "catatan", "dibuat_oleh_id")
SELECT
  gen_random_uuid(),
  school_id,
  'Periode awal',
  LEAST(awal_hari, akhir_hari),
  akhir_hari,
  14,
  seat_quota,
  'Dibuat otomatis dari kuota dan masa berlaku sebelum fitur periode.',
  dibuat_oleh_id
FROM basis;

-- Data awal 2: hubungkan kursi lama ke periode itu - HANYA satu kursi per siswa (yang berakhir paling akhir),
-- karena kursi unik per siswa per periode. Kursi lain milik siswa yang sama tetap tanpa periode (lama, tetap sah
-- untuk akses tetapi tidak dihitung ke periode baru). Siswa yang sekolahnya tidak punya periode tidak tersentuh.
WITH terakhir AS (
  SELECT DISTINCT ON (e."student_id", e."school_id") e."id" AS entitlement_id, e."school_id" AS school_id
  FROM "entitlements" e
  WHERE e."source" = 'school_seat' AND e."school_id" IS NOT NULL
  ORDER BY e."student_id", e."school_id", e."ends_at" DESC, e."created_at" DESC
)
UPDATE "entitlements" ent
SET "periode_id" = p."id"
FROM terakhir t
JOIN "school_periods" p ON p."school_id" = t.school_id
WHERE ent."id" = t.entitlement_id
  AND ent."periode_id" IS NULL;
