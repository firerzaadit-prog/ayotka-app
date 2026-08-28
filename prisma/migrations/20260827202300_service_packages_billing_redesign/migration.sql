-- Migration: Redesign billing — hapus Plan/Order/Subscription/UsageCounter,
-- tambah tabel service_packages, tambah service_package_id ke subject_tryout_orders,
-- bersihkan field plan dari schools.

-- ============================================================
-- STEP 1: Bersihkan kolom plan dari tabel schools
-- ============================================================

ALTER TABLE "schools"
  DROP COLUMN IF EXISTS "plan_id",
  DROP COLUMN IF EXISTS "kuota_siswa",
  DROP COLUMN IF EXISTS "langganan_mulai",
  DROP COLUMN IF EXISTS "langganan_berakhir";

-- ============================================================
-- STEP 2: Hapus tabel billing lama (data sudah kosong)
-- ============================================================

-- Hapus usage_counters
DROP TABLE IF EXISTS "usage_counters";

-- Hapus subscriptions (FK ke orders & plans)
DROP TABLE IF EXISTS "subscriptions";

-- Hapus orders (FK ke plans)
DROP TABLE IF EXISTS "orders";

-- Hapus plans (FK dari schools sudah dihapus di step 1)
DROP TABLE IF EXISTS "plans";

-- ============================================================
-- STEP 3: Buat tabel service_packages
-- ============================================================

CREATE TABLE "service_packages" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "nama"             TEXT NOT NULL,
  "harga_per_mapel"  INTEGER NOT NULL,
  "try_out_per_mapel" INTEGER NOT NULL DEFAULT 3,
  "deskripsi"        TEXT,
  "is_active"        BOOLEAN NOT NULL DEFAULT true,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- STEP 4: Tambah kolom service_package_id ke subject_tryout_orders
-- ============================================================

-- Tambah kolom dulu sebagai nullable (untuk data lama yang mungkin ada)
ALTER TABLE "subject_tryout_orders"
  ADD COLUMN "service_package_id" UUID;

-- Buat satu default paket untuk data lama (jika ada)
INSERT INTO "service_packages" ("id", "nama", "harga_per_mapel", "try_out_per_mapel", "deskripsi", "is_active")
VALUES (
  gen_random_uuid(),
  'Paket Standar TKA',
  20000,
  3,
  'Rp20.000 per mata pelajaran, sudah termasuk 3× Try Out TKA.',
  true
)
ON CONFLICT DO NOTHING;

-- Update baris lama (jika ada) dengan paket default
UPDATE "subject_tryout_orders"
SET "service_package_id" = (
  SELECT "id" FROM "service_packages" ORDER BY "created_at" ASC LIMIT 1
)
WHERE "service_package_id" IS NULL;

-- Jadikan NOT NULL dan tambah FK
ALTER TABLE "subject_tryout_orders"
  ALTER COLUMN "service_package_id" SET NOT NULL;

ALTER TABLE "subject_tryout_orders"
  ADD CONSTRAINT "subject_tryout_orders_service_package_id_fkey"
    FOREIGN KEY ("service_package_id") REFERENCES "service_packages"("id") ON DELETE RESTRICT;

-- ============================================================
-- STEP 5: Hapus enum lama (PostgreSQL tidak support DROP TYPE IF NOT USED
--          langsung, tapi karena sudah tidak ada kolom yang pakai ini, aman)
-- ============================================================

DROP TYPE IF EXISTS "PlanTarget";
DROP TYPE IF EXISTS "SubscriptionStatus";
