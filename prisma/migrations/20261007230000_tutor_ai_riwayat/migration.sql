-- Riwayat percakapan Tanya Tutor AI: isi pesan siswa dan balasan tutor disimpan SEMINGGU lalu dihapus otomatis
-- (lib/tutor/penyimpanan.ts). Foto tidak disimpan, hanya penanda ada_foto. Aditif: kolom baru nullable/berbawaan,
-- baris yang sudah ada (hanya jejak pemakaian) tetap sah dengan isi kosong.

-- AlterTable
ALTER TABLE "tutor_ai_pesan" ADD COLUMN     "ada_foto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "balasan" TEXT,
ADD COLUMN     "pesan" TEXT;

-- CreateIndex
CREATE INDEX "tutor_ai_pesan_attempt_id_question_id_created_at_idx" ON "tutor_ai_pesan"("attempt_id", "question_id", "created_at");

-- CreateIndex
CREATE INDEX "tutor_ai_pesan_created_at_idx" ON "tutor_ai_pesan"("created_at");
