-- Fase B restrukturisasi taksonomi soal (permintaan user, 1 Okt 2026):
-- Materi->SubMateri->Kompetensi (3 level, tingkat, kode) diratakan jadi
-- Elemen->Kompetensi (2 level, tanpa tingkat/kode, sub_elemen jadi field
-- bebas) - menyamakan struktur dengan soal.ayotka.id yang memang tidak
-- punya tabel referensi terpisah utk sub_elemen (cuma string bebas per
-- soal) maupun konsep tingkat (hanya jenjang).
--
-- Strategi: ALTER tabel kompetensi/questions DI TEMPAT (bukan bikin baris
-- baru + remap FK) - kompetensi.id TIDAK berubah sama sekali, jadi semua FK
-- yang sudah ada (blueprint_items.kompetensi_id, competency_scores.kompetensi_id,
-- taxonomy_mappings.kompetensi_id, questions.kompetensi_id) tetap valid tanpa
-- perlu diremap. Ini jauh lebih aman daripada bikin baris kompetensi baru.
--
-- Data produksi dicek dulu (baca-saja) sebelum migration ini ditulis: 6
-- subject, 20 baris materi (mengelompok jadi 9 elemen unik setelah tingkat
-- diabaikan), 41 sub_materi, 132 kompetensi, 107 question. Dibandingkan
-- dengan soal.fixed_taxonomies (referensi resmi soal.ayotka.id, 8 baris:
-- 5 elemen SD Matematika + 3 elemen SD Bahasa Indonesia), HANYA elemen
-- "Bilangan" (SD Matematika) yang cocok PERSIS namanya - satu-satunya yang
-- ditandai resmi=true. Sisanya (SD Matematika "Data"/"Geometri dan
-- Pengukuran", SD Bahasa Indonesia "Membaca", semua elemen SMP) TIDAK
-- direname/dipaksa cocok secara sepihak - human judgement (mis. memecah
-- "Geometri dan Pengukuran" jadi 2 elemen resmi terpisah) diserahkan ke
-- admin lewat badge "belum diverifikasi" di halaman Taxonomy, sesuai
-- keputusan user "isi bebas untuk sisanya, tandai sisanya untuk ditinjau".
--
-- Semua statement di bawah scoped ke schema public (bukan schema `soal`
-- milik soal.ayotka.id di database bersama yang sama).

-- 1) Tabel elemen (pengganti materi).
CREATE TABLE "elemen" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "nama" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL,
    "resmi" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "elemen_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "elemen" ADD CONSTRAINT "elemen_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) Isi elemen dari materi lama, dikelompokkan (subject_id, nama) MENGABAIKAN
--    tingkat - beberapa materi lama dgn nama sama tapi tingkat beda (mis.
--    "Bilangan" tingkat 4/5/6) jadi SATU baris elemen.
INSERT INTO "elemen" ("id", "subject_id", "nama", "urutan", "resmi")
SELECT gen_random_uuid(), "subject_id", "nama", MIN("urutan"), false
FROM "materi"
GROUP BY "subject_id", "nama";

-- 3) Tandai resmi=true utk elemen yang cocok PERSIS dgn soal.fixed_taxonomies
--    (lihat penjelasan di atas - cuma "Bilangan" SD Matematika).
UPDATE "elemen" SET "resmi" = true
WHERE "subject_id" = '03410e54-deee-463f-929d-52622f8a673a' AND "nama" = 'Bilangan';

-- 4) kompetensi: tambah elemen_id + sub_elemen (nullable dulu, diisi dari
--    rantai lama sub_materi->materi, baru NOT NULL).
ALTER TABLE "kompetensi" ADD COLUMN "elemen_id" UUID;
ALTER TABLE "kompetensi" ADD COLUMN "sub_elemen" TEXT;

UPDATE "kompetensi" k
SET "elemen_id" = e."id",
    "sub_elemen" = sm."nama"
FROM "sub_materi" sm
JOIN "materi" m ON m."id" = sm."materi_id"
JOIN "elemen" e ON e."subject_id" = m."subject_id" AND e."nama" = m."nama"
WHERE k."sub_materi_id" = sm."id";

ALTER TABLE "kompetensi" ALTER COLUMN "elemen_id" SET NOT NULL;
ALTER TABLE "kompetensi" ALTER COLUMN "sub_elemen" SET NOT NULL;
ALTER TABLE "kompetensi" ADD CONSTRAINT "kompetensi_elemen_id_fkey"
    FOREIGN KEY ("elemen_id") REFERENCES "elemen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kompetensi" DROP COLUMN "kode";
ALTER TABLE "kompetensi" DROP COLUMN "sub_materi_id";

-- 5) questions: elemen_id menggantikan materi_id (kolom denormalisasi tanpa
--    FK Prisma, sama seperti sebelumnya - lihat Question.elemenId di schema).
ALTER TABLE "questions" ADD COLUMN "elemen_id" UUID;

UPDATE "questions" q
SET "elemen_id" = e."id"
FROM "materi" m
JOIN "elemen" e ON e."subject_id" = m."subject_id" AND e."nama" = m."nama"
WHERE q."materi_id" = m."id";

ALTER TABLE "questions" DROP COLUMN "materi_id";
ALTER TABLE "questions" DROP COLUMN "sub_materi_id";

-- 6) Drop tabel lama (urutan FK: sub_materi dulu baru materi).
DROP TABLE "sub_materi";
DROP TABLE "materi";
