-- Jalur C sekarang juga bisa lewat Midtrans: mitra beli batch voucher
-- sendiri (bukan cuma admin pusat yang generate manual). voucher_order_id
-- di vouchers nullable karena batch yang di-generate admin pusat manual
-- tetap tidak punya order Midtrans sama sekali.

-- CreateEnum
CREATE TYPE "VoucherOrderStatus" AS ENUM ('pending', 'paid', 'expired');

-- CreateTable
CREATE TABLE "voucher_orders" (
    "id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "VoucherOrderStatus" NOT NULL DEFAULT 'pending',
    "gateway_ref" TEXT,
    "payment_channel" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_orders_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN "voucher_order_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "voucher_orders_gateway_ref_key" ON "voucher_orders"("gateway_ref");

-- AddForeignKey
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_voucher_order_id_fkey" FOREIGN KEY ("voucher_order_id") REFERENCES "voucher_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
