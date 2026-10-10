-- CreateEnum
CREATE TYPE "StatusInvoiceSekolah" AS ENUM ('menunggu_pembayaran', 'lunas', 'dibatalkan');

-- CreateTable
CREATE TABLE "school_invoices" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "periode_id" UUID,
    "nomor_invoice" TEXT NOT NULL,
    "jumlah_siswa" INTEGER NOT NULL,
    "harga_per_siswa" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "status" "StatusInvoiceSekolah" NOT NULL DEFAULT 'menunggu_pembayaran',
    "tanggal_invoice" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jatuh_tempo" TIMESTAMP(3) NOT NULL,
    "keterangan" TEXT,
    "bank_tujuan" TEXT,
    "catatan" TEXT,
    "dibayar_at" TIMESTAMP(3),
    "dibuat_oleh_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_invoices_nomor_invoice_key" ON "school_invoices"("nomor_invoice");

-- CreateIndex
CREATE INDEX "school_invoices_school_id_status_idx" ON "school_invoices"("school_id", "status");

-- CreateIndex
CREATE INDEX "school_invoices_school_id_tanggal_invoice_idx" ON "school_invoices"("school_id", "tanggal_invoice");

-- AddForeignKey
ALTER TABLE "school_invoices" ADD CONSTRAINT "school_invoices_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_invoices" ADD CONSTRAINT "school_invoices_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "school_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_invoices" ADD CONSTRAINT "school_invoices_dibuat_oleh_id_fkey" FOREIGN KEY ("dibuat_oleh_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
