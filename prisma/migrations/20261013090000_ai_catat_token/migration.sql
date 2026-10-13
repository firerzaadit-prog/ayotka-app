-- Pencatatan pemakaian token AI per analisis Learning Analytics (13 Okt 2026). Aditif: tiga kolom baru yang boleh kosong di
-- ai_analyses, tidak mengubah atau menghapus data. Analisis lama dibiarkan kosong (tidak diketahui). Dipakai halaman admin
-- pusat (Paket & Rekening) untuk membandingkan pemakaian riil dengan taksiran beban AI yang menentukan harga LA.

-- AlterTable
ALTER TABLE "ai_analyses" ADD COLUMN "token_masuk" INTEGER,
ADD COLUMN "token_keluar" INTEGER,
ADD COLUMN "taksiran_token_masuk" INTEGER;
