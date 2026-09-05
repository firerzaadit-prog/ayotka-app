-- Package.tingkat (Int tunggal) -> Package.tingkatList (Int[]), supaya satu
-- paket soal bisa menjangkau lebih dari satu tingkat kelas sekaligus (mis.
-- kelas 7 & 8 dalam satu paket), bukan harus diduplikasi jadi beberapa paket
-- identik per tingkat. Data lama dipindah apa adanya (satu tingkat -> array
-- berisi satu elemen) sebelum kolom lama dihapus, supaya tidak ada paket yang
-- kehilangan info tingkatnya.
ALTER TABLE "packages" ADD COLUMN "tingkat_list" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
UPDATE "packages" SET "tingkat_list" = ARRAY["tingkat"];
ALTER TABLE "packages" ALTER COLUMN "tingkat_list" DROP DEFAULT;
ALTER TABLE "packages" DROP COLUMN "tingkat";
