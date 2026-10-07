-- Jejak pemakaian fitur Tanya Tutor AI (satu baris = satu pesan siswa, TANPA isi pesan) untuk batas harian per siswa.
-- Aditif: hanya tabel baru; kode lama tidak menyentuhnya.

-- CreateTable
CREATE TABLE "tutor_ai_pesan" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_ai_pesan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tutor_ai_pesan_student_id_created_at_idx" ON "tutor_ai_pesan"("student_id", "created_at");

-- AddForeignKey
ALTER TABLE "tutor_ai_pesan" ADD CONSTRAINT "tutor_ai_pesan_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_ai_pesan" ADD CONSTRAINT "tutor_ai_pesan_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
