-- CreateIndex
CREATE UNIQUE INDEX "classes_school_id_academic_year_id_tingkat_nama_rombel_key" ON "classes"("school_id", "academic_year_id", "tingkat", "nama_rombel");
