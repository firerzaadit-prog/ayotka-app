-- CreateTable
CREATE TABLE "ai_analyses_sekolah" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "kunci" TEXT NOT NULL,
    "versi_prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "ringkasan" TEXT NOT NULL,
    "detail_json" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_sekolah_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_analyses_sekolah_kunci_key" ON "ai_analyses_sekolah"("kunci");

-- CreateIndex
CREATE INDEX "ai_analyses_sekolah_school_id_idx" ON "ai_analyses_sekolah"("school_id");

-- AddForeignKey
ALTER TABLE "ai_analyses_sekolah" ADD CONSTRAINT "ai_analyses_sekolah_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
