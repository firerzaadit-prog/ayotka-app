-- Buku nomor untuk Pembuat Invoice di Admin Pusat (16 Okt 2026). Aditif: satu tabel baru, tidak mengubah atau menghapus
-- data yang ada. Tiap invoice yang diterbitkan dari pembuat itu dicatat di sini supaya nomornya tidak dipakai ganda oleh
-- invoice sekolah (dan sebaliknya), dan PDF-nya bisa diunduh ulang dari isian yang tersimpan (kolom data).

-- CreateTable
CREATE TABLE "invoice_bebas" (
    "id" UUID NOT NULL,
    "nomor_invoice" TEXT NOT NULL,
    "penerima" TEXT NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "status" "StatusInvoiceSekolah" NOT NULL DEFAULT 'menunggu_pembayaran',
    "tanggal_invoice" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "dibuat_oleh_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_bebas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_bebas_nomor_invoice_key" ON "invoice_bebas"("nomor_invoice");

-- CreateIndex
CREATE INDEX "invoice_bebas_created_at_idx" ON "invoice_bebas"("created_at");
