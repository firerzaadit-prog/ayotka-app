-- Fitur "metode distribusi" (otomatis/bergilir antar paket paralel vs
-- manual) dihapus - tidak pernah ada UI untuk menggabungkan paket ke grup
-- paralel (grup_paralel_id), jadi "otomatis" selalu berperilaku identik
-- dengan "manual" dalam praktiknya. assignments.packageId tetap jadi
-- satu-satunya penentu paket yang dikerjakan siswa.
ALTER TABLE "assignments" DROP COLUMN "metode_distribusi";
DROP TYPE "MetodeDistribusi";

ALTER TABLE "packages" DROP COLUMN "grup_paralel_id";
