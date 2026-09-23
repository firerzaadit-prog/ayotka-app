-- Blueprint.tingkat (Int tunggal) -> Blueprint.tingkatList (Int[]), sama pola
-- dengan Package.tingkatList (migrasi 20260905180000), supaya satu kisi-kisi
-- bisa dipakai untuk lebih dari satu tingkat kelas sekaligus.
ALTER TABLE "blueprints" ADD COLUMN "tingkat_list" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

-- Pindahkan nilai lama (tidak ada data yang hilang).
UPDATE "blueprints" SET "tingkat_list" = ARRAY["tingkat"];

ALTER TABLE "blueprints" ALTER COLUMN "tingkat_list" DROP DEFAULT;
ALTER TABLE "blueprints" DROP COLUMN "tingkat";
