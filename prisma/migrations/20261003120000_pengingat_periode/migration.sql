-- Catatan pengingat langganan sekolah (Fase 3 skema pergantian semester/tahun): hanya dua pengingat per periode (H-7, H-1).
--
-- ADITIF: satu enum dan satu tabel baru. Kode lama tidak membaca ini, jadi aman dijalankan SEBELUM kode baru di-deploy.
-- Harus dijalankan SETELAH 20261003100000_periode_langganan_sekolah (tabel school_periods dirujuk di sini). Seluruh
-- pernyataan hanya menyentuh skema `public` (database ini dipakai bersama soal.ayotka.id yang memakai skema `soal`).

-- CreateEnum
CREATE TYPE "JenisPengingatPeriode" AS ENUM ('h7', 'h1');

-- CreateTable
CREATE TABLE "school_period_reminders" (
    "id" UUID NOT NULL,
    "periode_id" UUID NOT NULL,
    "jenis" "JenisPengingatPeriode" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selesai_at" TIMESTAMP(3),
    "penerima" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "school_period_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_period_reminders_periode_id_jenis_key" ON "school_period_reminders"("periode_id", "jenis");

-- AddForeignKey
ALTER TABLE "school_period_reminders" ADD CONSTRAINT "school_period_reminders_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "school_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
