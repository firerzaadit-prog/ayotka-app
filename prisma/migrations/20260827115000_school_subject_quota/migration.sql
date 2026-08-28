-- Migration: Redesign sistem langganan
-- 1. Hapus data lama Plan/Order/Subscription (data cleaning)
-- 2. Buat tabel school_subject_quotas (model baru)

-- ============================================================
-- STEP 1: Bersihkan data lama (plan-based billing)
-- ============================================================

-- Hapus subscriptions dulu (FK ke orders & plans)
DELETE FROM subscriptions;

-- Hapus orders (FK ke plans)
DELETE FROM orders;

-- Hapus plans
DELETE FROM plans;

-- Reset planId di schools (set NULL, FK sudah SetNull)
UPDATE schools SET plan_id = NULL WHERE plan_id IS NOT NULL;

-- ============================================================
-- STEP 2: Buat tabel school_subject_quotas
-- ============================================================

CREATE TABLE "school_subject_quotas" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id"        UUID NOT NULL,
  "subject_id"       UUID NOT NULL,
  "try_out_per_siswa" INTEGER NOT NULL DEFAULT 3,
  "kuota_siswa"      INTEGER NOT NULL,
  "created_by"       UUID NOT NULL,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "school_subject_quotas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "school_subject_quotas_school_id_subject_id_key" UNIQUE ("school_id", "subject_id"),
  CONSTRAINT "school_subject_quotas_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE,
  CONSTRAINT "school_subject_quotas_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT,
  CONSTRAINT "school_subject_quotas_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
