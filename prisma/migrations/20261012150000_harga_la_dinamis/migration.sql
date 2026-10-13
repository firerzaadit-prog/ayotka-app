-- Harga Learning Analytics tambahan yang mengikuti beban AI paket (taksiran token masukan prompt; 12-13 Okt 2026). Aditif: hanya membuat tabel
-- baru, tidak mengubah atau menghapus apa pun. Tanpa baris di tabel ini, aplikasi memakai nilai bawaan yang sama
-- (Rp4.500-Rp7.500, ringan 6.500 token, berat 13.500 token); baris "global" dibuat saat admin pusat menyimpan pengaturannya.

-- CreateTable
CREATE TABLE "harga_la_pengaturan" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "harga_min" INTEGER NOT NULL DEFAULT 4500,
    "harga_maks" INTEGER NOT NULL DEFAULT 7500,
    "beban_ringan" INTEGER NOT NULL DEFAULT 6500,
    "beban_berat" INTEGER NOT NULL DEFAULT 13500,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "harga_la_pengaturan_pkey" PRIMARY KEY ("id")
);
