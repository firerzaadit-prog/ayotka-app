-- Fitur laporan bulanan orang tua dibatalkan. Kolom baru ditambahkan dan
-- dihapus lagi di hari yang sama (dicek sebelum dijalankan: 0 baris berisi
-- data), jadi tidak ada data yang hilang.
ALTER TABLE "students" DROP COLUMN "email_ortu",
DROP COLUMN "email_ortu_terverifikasi_at",
DROP COLUMN "laporan_ortu_aktif",
DROP COLUMN "laporan_ortu_terakhir_periode";
