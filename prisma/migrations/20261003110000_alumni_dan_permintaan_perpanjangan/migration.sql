-- Alumni (Student.lulus_at) dan permintaan perpanjangan langganan sekolah (Fase 2 skema pergantian semester/tahun).
--
-- ADITIF: satu kolom nullable, satu enum, satu tabel baru, dan indeks. Kode lama tidak membaca satu pun dari
-- ini, jadi aman dijalankan SEBELUM kode baru di-deploy. Harus dijalankan SETELAH migrasi
-- 20261003100000_periode_langganan_sekolah (tabel school_periods dirujuk di sini). Seluruh pernyataan hanya
-- menyentuh skema `public` (database ini dipakai bersama soal.ayotka.id yang memakai skema `soal`).

-- CreateEnum
CREATE TYPE "StatusPermintaanPerpanjangan" AS ENUM ('menunggu', 'disetujui', 'ditolak');

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "lulus_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "school_renewal_requests" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "diajukan_oleh_id" UUID,
    "kuota_diminta" INTEGER NOT NULL,
    "mulai_diminta" TIMESTAMP(3) NOT NULL,
    "berakhir_diminta" TIMESTAMP(3) NOT NULL,
    "catatan" TEXT,
    "status" "StatusPermintaanPerpanjangan" NOT NULL DEFAULT 'menunggu',
    "periode_id" UUID,
    "ditangani_oleh_id" UUID,
    "ditangani_at" TIMESTAMP(3),
    "catatan_admin" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_renewal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_renewal_requests_school_id_status_idx" ON "school_renewal_requests"("school_id", "status");

-- CreateIndex
CREATE INDEX "school_renewal_requests_status_created_at_idx" ON "school_renewal_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "students_school_id_lulus_at_idx" ON "students"("school_id", "lulus_at");

-- AddForeignKey
ALTER TABLE "school_renewal_requests" ADD CONSTRAINT "school_renewal_requests_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_renewal_requests" ADD CONSTRAINT "school_renewal_requests_diajukan_oleh_id_fkey" FOREIGN KEY ("diajukan_oleh_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_renewal_requests" ADD CONSTRAINT "school_renewal_requests_ditangani_oleh_id_fkey" FOREIGN KEY ("ditangani_oleh_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_renewal_requests" ADD CONSTRAINT "school_renewal_requests_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "school_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
