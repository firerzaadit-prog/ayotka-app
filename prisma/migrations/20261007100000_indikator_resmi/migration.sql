-- Indikator resmi Pusmendik Kemendikdasmen (master + rerata nasional) dan tautannya ke soal.
--
-- ADITIF: dua kolom nullable di `questions`, satu tabel baru `indikator_resmi`, indeks, dan satu kunci asing
-- (ON DELETE SET NULL). Tidak ada baris yang diubah (kolom baru semuanya NULL), jadi kode lama yang tidak tahu
-- tentang kolom ini tetap berjalan - aman dijalankan SEBELUM kode baru aktif. Hanya menyentuh skema `public`
-- (database ini dipakai bersama soal.ayotka.id yang memakai skema `soal`).

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "indikator_id" UUID,
ADD COLUMN     "indikator_teks" TEXT;

-- CreateTable
CREATE TABLE "indikator_resmi" (
    "id" UUID NOT NULL,
    "jenjang" TEXT NOT NULL,
    "kd_mapel" TEXT NOT NULL,
    "nama_mapel" TEXT NOT NULL,
    "elemen" TEXT NOT NULL,
    "subelemen" TEXT NOT NULL,
    "kompetensi" TEXT NOT NULL,
    "subkompetensi" TEXT,
    "indikator" TEXT NOT NULL,
    "teks_kunci" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL,
    "nilai_nasional" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "indikator_resmi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "indikator_resmi_jenjang_nama_mapel_idx" ON "indikator_resmi"("jenjang", "nama_mapel");

-- CreateIndex
CREATE UNIQUE INDEX "indikator_resmi_jenjang_nama_mapel_teks_kunci_key" ON "indikator_resmi"("jenjang", "nama_mapel", "teks_kunci");

-- CreateIndex
CREATE INDEX "questions_indikator_id_idx" ON "questions"("indikator_id");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_indikator_id_fkey" FOREIGN KEY ("indikator_id") REFERENCES "indikator_resmi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
