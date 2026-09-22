-- CreateEnum
CREATE TYPE "StimulusTipe" AS ENUM ('teks', 'data');

-- CreateTable
CREATE TABLE "stimulus" (
    "id" UUID NOT NULL,
    "tipe" "StimulusTipe" NOT NULL,
    "judul" TEXT,
    "konten" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stimulus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy_mappings" (
    "id" UUID NOT NULL,
    "sumber" TEXT NOT NULL,
    "source_elemen" TEXT NOT NULL,
    "source_sub_elemen" TEXT,
    "source_kompetensi" TEXT,
    "kompetensi_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taxonomy_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soal_import_logs" (
    "id" UUID NOT NULL,
    "source_paket_id" TEXT NOT NULL,
    "source_paket_code" TEXT NOT NULL,
    "package_id" UUID NOT NULL,
    "imported_by" UUID NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soal_import_logs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "questions" ADD COLUMN "stimulus_id" UUID;

-- CreateIndex
CREATE INDEX "taxonomy_mappings_sumber_source_elemen_idx" ON "taxonomy_mappings"("sumber", "source_elemen");

-- CreateIndex
CREATE INDEX "soal_import_logs_source_paket_id_idx" ON "soal_import_logs"("source_paket_id");

-- CreateIndex
CREATE UNIQUE INDEX "soal_import_logs_package_id_key" ON "soal_import_logs"("package_id");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_stimulus_id_fkey" FOREIGN KEY ("stimulus_id") REFERENCES "stimulus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomy_mappings" ADD CONSTRAINT "taxonomy_mappings_kompetensi_id_fkey" FOREIGN KEY ("kompetensi_id") REFERENCES "kompetensi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomy_mappings" ADD CONSTRAINT "taxonomy_mappings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soal_import_logs" ADD CONSTRAINT "soal_import_logs_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soal_import_logs" ADD CONSTRAINT "soal_import_logs_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
