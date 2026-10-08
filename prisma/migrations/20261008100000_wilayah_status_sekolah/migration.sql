-- Data sekolah dan dinas pendidikan se-Indonesia: provinsi + status sekolah (negeri/swasta), untuk memetakan nilai per wilayah dan jenis
-- sekolah. Migrasi aditif (kolom baru boleh kosong): kode lama tetap berjalan.

-- CreateEnum
CREATE TYPE "StatusSekolah" AS ENUM ('negeri', 'swasta');

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "provinsi" TEXT,
ADD COLUMN     "status_sekolah" "StatusSekolah";

-- CreateIndex
CREATE INDEX "schools_provinsi_kabupaten_kota_idx" ON "schools"("provinsi", "kabupaten_kota");

-- Backfill: sebelum ini kota/kabupaten hanya boleh berupa daftar Jawa Timur (lib/constants/wilayah.ts), jadi sekolah
-- yang sudah punya kota/kabupaten dari daftar itu otomatis berada di Provinsi Jawa Timur. Nilai di luar daftar (tidak
-- seharusnya ada) dibiarkan kosong agar tidak salah dipetakan.
UPDATE "schools" SET "provinsi" = 'Jawa Timur'
WHERE "provinsi" IS NULL AND "kabupaten_kota" IN (
    'Kabupaten Bangkalan',
    'Kabupaten Banyuwangi',
    'Kabupaten Blitar',
    'Kabupaten Bojonegoro',
    'Kabupaten Bondowoso',
    'Kabupaten Gresik',
    'Kabupaten Jember',
    'Kabupaten Jombang',
    'Kabupaten Kediri',
    'Kabupaten Lamongan',
    'Kabupaten Lumajang',
    'Kabupaten Madiun',
    'Kabupaten Magetan',
    'Kabupaten Malang',
    'Kabupaten Mojokerto',
    'Kabupaten Nganjuk',
    'Kabupaten Ngawi',
    'Kabupaten Pacitan',
    'Kabupaten Pamekasan',
    'Kabupaten Pasuruan',
    'Kabupaten Ponorogo',
    'Kabupaten Probolinggo',
    'Kabupaten Sampang',
    'Kabupaten Sidoarjo',
    'Kabupaten Situbondo',
    'Kabupaten Sumenep',
    'Kabupaten Trenggalek',
    'Kabupaten Tuban',
    'Kabupaten Tulungagung',
    'Kota Batu',
    'Kota Blitar',
    'Kota Kediri',
    'Kota Madiun',
    'Kota Malang',
    'Kota Mojokerto',
    'Kota Pasuruan',
    'Kota Probolinggo',
    'Kota Surabaya'
);

-- Akun dinas pendidikan ikut punya provinsi; kota/kabupaten jadi opsional supaya ada Dinas Provinsi (semua kota/
-- kabupaten di provinsinya) di samping Dinas Kota/Kabupaten. Akun lama sudah punya kota/kabupaten (Jawa Timur),
-- jadi cakupannya tidak berubah.
ALTER TABLE "dinas_admins" ADD COLUMN     "provinsi" TEXT,
ALTER COLUMN "kabupaten_kota" DROP NOT NULL;

UPDATE "dinas_admins" SET "provinsi" = 'Jawa Timur'
WHERE "provinsi" IS NULL AND "kabupaten_kota" IN (
    'Kabupaten Bangkalan',
    'Kabupaten Banyuwangi',
    'Kabupaten Blitar',
    'Kabupaten Bojonegoro',
    'Kabupaten Bondowoso',
    'Kabupaten Gresik',
    'Kabupaten Jember',
    'Kabupaten Jombang',
    'Kabupaten Kediri',
    'Kabupaten Lamongan',
    'Kabupaten Lumajang',
    'Kabupaten Madiun',
    'Kabupaten Magetan',
    'Kabupaten Malang',
    'Kabupaten Mojokerto',
    'Kabupaten Nganjuk',
    'Kabupaten Ngawi',
    'Kabupaten Pacitan',
    'Kabupaten Pamekasan',
    'Kabupaten Pasuruan',
    'Kabupaten Ponorogo',
    'Kabupaten Probolinggo',
    'Kabupaten Sampang',
    'Kabupaten Sidoarjo',
    'Kabupaten Situbondo',
    'Kabupaten Sumenep',
    'Kabupaten Trenggalek',
    'Kabupaten Tuban',
    'Kabupaten Tulungagung',
    'Kota Batu',
    'Kota Blitar',
    'Kota Kediri',
    'Kota Madiun',
    'Kota Malang',
    'Kota Mojokerto',
    'Kota Pasuruan',
    'Kota Probolinggo',
    'Kota Surabaya'
);

-- Profil lama yang dulu diisi string kosong (upsert tanpa wilayah) dianggap belum diatur.
UPDATE "dinas_admins" SET "kabupaten_kota" = NULL WHERE "kabupaten_kota" = '';
