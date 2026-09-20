-- AlterTable
ALTER TABLE "students" ADD COLUMN "email_ortu" TEXT,
ADD COLUMN "email_ortu_terverifikasi_at" TIMESTAMP(3),
ADD COLUMN "laporan_ortu_aktif" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "laporan_ortu_terakhir_periode" TEXT;
