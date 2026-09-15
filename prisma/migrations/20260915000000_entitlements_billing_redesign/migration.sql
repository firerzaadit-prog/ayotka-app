-- CreateEnum
CREATE TYPE "PlanKode" AS ENUM ('free', 'monthly', 'semester', 'school');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('pending', 'paid', 'expired', 'refunded');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('invoice', 'voucher', 'school_seat');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('unused', 'used', 'void');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('pending', 'paid');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'mitra';

-- DropForeignKey
ALTER TABLE "school_subject_quotas" DROP CONSTRAINT "school_subject_quotas_created_by_fkey";

-- DropForeignKey
ALTER TABLE "school_subject_quotas" DROP CONSTRAINT "school_subject_quotas_school_id_fkey";

-- DropForeignKey
ALTER TABLE "school_subject_quotas" DROP CONSTRAINT "school_subject_quotas_subject_id_fkey";

-- DropForeignKey
ALTER TABLE "subject_tryout_order_items" DROP CONSTRAINT "subject_tryout_order_items_order_id_fkey";

-- DropForeignKey
ALTER TABLE "subject_tryout_order_items" DROP CONSTRAINT "subject_tryout_order_items_subject_id_fkey";

-- DropForeignKey
ALTER TABLE "subject_tryout_orders" DROP CONSTRAINT "subject_tryout_orders_disetujui_oleh_admin_id_fkey";

-- DropForeignKey
ALTER TABLE "subject_tryout_orders" DROP CONSTRAINT "subject_tryout_orders_service_package_id_fkey";

-- DropForeignKey
ALTER TABLE "subject_tryout_orders" DROP CONSTRAINT "subject_tryout_orders_user_id_fkey";

-- DropForeignKey
ALTER TABLE "subject_tryout_quotas" DROP CONSTRAINT "subject_tryout_quotas_subject_id_fkey";

-- DropForeignKey
ALTER TABLE "subject_tryout_quotas" DROP CONSTRAINT "subject_tryout_quotas_user_id_fkey";

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "referred_by_partner_id" UUID,
ADD COLUMN     "seat_activated_by_id" UUID,
ADD COLUMN     "seat_quota" INTEGER,
ADD COLUMN     "valid_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "referred_by_student_id" UUID,
ADD COLUMN     "wa_kontak" TEXT;

-- DropTable
DROP TABLE "school_subject_quotas";

-- DropTable
DROP TABLE "service_packages";

-- DropTable
DROP TABLE "subject_tryout_order_items";

-- DropTable
DROP TABLE "subject_tryout_orders";

-- DropTable
DROP TABLE "subject_tryout_quotas";

-- DropEnum
DROP TYPE "OrderStatus";

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "kode" "PlanKode" NOT NULL,
    "subject_id" UUID,
    "nama" TEXT NOT NULL,
    "harga" INTEGER NOT NULL,
    "durasi_hari" INTEGER,
    "fitur" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "subject_id" UUID,
    "amount" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'pending',
    "gateway_ref" TEXT,
    "payment_channel" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "grace_until" TIMESTAMP(3),
    "source" "EntitlementSource" NOT NULL,
    "invoice_id" UUID,
    "voucher_id" UUID,
    "school_id" UUID,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "plan_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'unused',
    "used_by_student_id" UUID,
    "used_at" TIMESTAMP(3),
    "generated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nama" TEXT NOT NULL,
    "kontak" TEXT,
    "referral_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_commissions" (
    "id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "amount" INTEGER,
    "status" "CommissionStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "partner_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_gateway_ref_key" ON "invoices"("gateway_ref");

-- CreateIndex
CREATE INDEX "entitlements_student_id_revoked_at_starts_at_ends_at_idx" ON "entitlements"("student_id", "revoked_at", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "partners_user_id_key" ON "partners"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "partners_referral_code_key" ON "partners"("referral_code");

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_seat_activated_by_id_fkey" FOREIGN KEY ("seat_activated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_referred_by_partner_id_fkey" FOREIGN KEY ("referred_by_partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_referred_by_student_id_fkey" FOREIGN KEY ("referred_by_student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_used_by_student_id_fkey" FOREIGN KEY ("used_by_student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

