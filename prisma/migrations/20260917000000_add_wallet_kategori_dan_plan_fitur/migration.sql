-- CreateEnum
CREATE TYPE "TryOutKategori" AS ENUM ('mandiri', 'nasional');

-- CreateEnum
CREATE TYPE "AnalisisSumber" AS ENUM ('kuota', 'saldo');

-- CreateEnum
CREATE TYPE "SaldoTransactionTipe" AS ENUM ('topup', 'debit_analisis', 'penyesuaian_admin');

-- CreateEnum
CREATE TYPE "SaldoTransactionStatus" AS ENUM ('pending', 'berhasil', 'gagal');

-- AlterTable
ALTER TABLE "packages" ADD COLUMN "kategori" "TryOutKategori" NOT NULL DEFAULT 'mandiri';

-- AlterTable
ALTER TABLE "try_out_groups" ADD COLUMN "kategori" "TryOutKategori" NOT NULL DEFAULT 'mandiri';

-- AlterTable
ALTER TABLE "attempts" ADD COLUMN "analisis_ai_diminta" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ai_analyses" ADD COLUMN "sumber" "AnalisisSumber" NOT NULL DEFAULT 'kuota';

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN "harga_learning_analytics" INTEGER NOT NULL DEFAULT 7500;

-- CreateTable
CREATE TABLE "voucher_price_tiers" (
    "id" UUID NOT NULL,
    "min_jumlah" INTEGER NOT NULL,
    "diskon_persen" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "voucher_price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voucher_price_tiers_min_jumlah_key" ON "voucher_price_tiers"("min_jumlah");

-- CreateTable
CREATE TABLE "saldo_transactions" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "tipe" "SaldoTransactionTipe" NOT NULL,
    "status" "SaldoTransactionStatus" NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "keterangan" TEXT,
    "gateway_ref" TEXT,
    "payment_channel" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saldo_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saldo_transactions_gateway_ref_key" ON "saldo_transactions"("gateway_ref");

-- AddForeignKey
ALTER TABLE "saldo_transactions" ADD CONSTRAINT "saldo_transactions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Skema diskon mitra baru (permintaan user, Bagian A) - MENGGANTI total
-- tingkatan lama yang hardcoded di kode (1-9=0%, 10-49=10%, 50+=20%).
INSERT INTO "voucher_price_tiers" ("id", "min_jumlah", "diskon_persen", "label") VALUES
  (gen_random_uuid(), 2, 20, '2-9 voucher'),
  (gen_random_uuid(), 10, 25, '10-49 voucher'),
  (gen_random_uuid(), 50, 30, '50+ voucher');
