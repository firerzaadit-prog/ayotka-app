-- Migration: Mengubah enum LevelKognitif dari C1-C6 (Bloom's Taxonomy)
-- menjadi L1-L3 sesuai Matriks Asesmen (Level 1=Knowing/Understanding,
-- Level 2=Applying, Level 3=Reasoning).
--
-- PostgreSQL tidak mendukung ALTER TYPE ... RENAME VALUE secara langsung
-- untuk menghapus nilai lama, jadi kita:
-- 1. Buat enum baru dengan nilai L1/L2/L3
-- 2. Update kolom yang menggunakannya dengan mapping C1/C2 -> L1, C3/C4 -> L2, C5/C6 -> L3
-- 3. Ganti tipe kolom ke enum baru
-- 4. Hapus enum lama

-- Langkah 1: Buat enum baru
CREATE TYPE "LevelKognitif_new" AS ENUM ('L1', 'L2', 'L3');

-- Langkah 2a: Update kolom level_kognitif di tabel kompetensi
-- Mapping: C1,C2 -> L1 | C3,C4 -> L2 | C5,C6 -> L3
ALTER TABLE "kompetensi"
  ALTER COLUMN "level_kognitif" TYPE "LevelKognitif_new"
  USING (
    CASE "level_kognitif"::text
      WHEN 'C1' THEN 'L1'
      WHEN 'C2' THEN 'L1'
      WHEN 'C3' THEN 'L2'
      WHEN 'C4' THEN 'L2'
      WHEN 'C5' THEN 'L3'
      WHEN 'C6' THEN 'L3'
      ELSE 'L1'
    END
  )::"LevelKognitif_new";

-- Langkah 2b: Update kolom level_bloom di tabel questions (jika ada)
ALTER TABLE "questions"
  ALTER COLUMN "level_bloom" TYPE "LevelKognitif_new"
  USING (
    CASE "level_bloom"::text
      WHEN 'C1' THEN 'L1'
      WHEN 'C2' THEN 'L1'
      WHEN 'C3' THEN 'L2'
      WHEN 'C4' THEN 'L2'
      WHEN 'C5' THEN 'L3'
      WHEN 'C6' THEN 'L3'
      ELSE 'L1'
    END
  )::"LevelKognitif_new";

-- Langkah 3: Hapus enum lama dan rename enum baru
DROP TYPE "LevelKognitif";
ALTER TYPE "LevelKognitif_new" RENAME TO "LevelKognitif";
