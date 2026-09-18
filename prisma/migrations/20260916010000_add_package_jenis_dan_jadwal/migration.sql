-- CreateEnum
CREATE TYPE "JenisPaket" AS ENUM ('tryout', 'latihan');

-- AlterTable
ALTER TABLE "packages" ADD COLUMN "jenis_paket" "JenisPaket" NOT NULL DEFAULT 'tryout';
ALTER TABLE "packages" ADD COLUMN "buka_mulai" TIMESTAMP(3);
ALTER TABLE "packages" ADD COLUMN "buka_selesai" TIMESTAMP(3);
