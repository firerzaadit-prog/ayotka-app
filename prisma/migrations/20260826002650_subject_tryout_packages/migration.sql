-- CreateTable
CREATE TABLE "subject_tryout_orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'menunggu_verifikasi',
    "bukti_transfer_url" TEXT,
    "catatan_admin" TEXT,
    "disetujui_oleh_admin_id" UUID,
    "disetujui_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_tryout_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_tryout_order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,

    CONSTRAINT "subject_tryout_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_tryout_quotas" (
    "user_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "terpakai" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "subject_tryout_quotas_pkey" PRIMARY KEY ("user_id","subject_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subject_tryout_order_items_order_id_subject_id_key" ON "subject_tryout_order_items"("order_id", "subject_id");

-- AddForeignKey
ALTER TABLE "subject_tryout_orders" ADD CONSTRAINT "subject_tryout_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_tryout_orders" ADD CONSTRAINT "subject_tryout_orders_disetujui_oleh_admin_id_fkey" FOREIGN KEY ("disetujui_oleh_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_tryout_order_items" ADD CONSTRAINT "subject_tryout_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "subject_tryout_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_tryout_order_items" ADD CONSTRAINT "subject_tryout_order_items_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_tryout_quotas" ADD CONSTRAINT "subject_tryout_quotas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_tryout_quotas" ADD CONSTRAINT "subject_tryout_quotas_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

