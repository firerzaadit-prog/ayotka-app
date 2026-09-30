-- Fase A restrukturisasi taksonomi & penghapusan "tingkat" (permintaan user,
-- 30 Sep - 1 Okt 2026): TKA adalah tes lintas-jenjang (SD->SMP->SMA), bukan
-- alat kurikulum per-kelas, jadi konsep tingkat (kelas 1-12) dihapus total,
-- termasuk seluruh fitur Kelas/Rombel & Tahun Ajaran yang bergantung padanya.
-- Cek pre-flight (baca-saja, dijalankan sebelum migration ini): production
-- cuma punya 5 baris assignments total, tidak ada sekolah yang pernah
-- menargetkan >1 rombel berbeda, dan 0 assignment aktif saat ini - jadi
-- Assignment jadi target sekolah penuh (schoolId saja) tanpa risiko nyata.
-- Semua statement di bawah scoped ke schema public (bukan schema `soal`
-- milik soal.ayotka.id di database bersama yang sama).

-- 1) Assignment: lepas dari Class sebelum Class dihapus.
ALTER TABLE "assignments" DROP COLUMN "class_id";

-- 2) student_enrollments mereferensikan classes & academic_years.
DROP TABLE "student_enrollments";

-- 3) classes mereferensikan schools, academic_years, users (wali_kelas_id).
DROP TABLE "classes";

-- 4) academic_years sudah tidak direferensikan apa pun lagi.
DROP TABLE "academic_years";

-- 5) tingkat numerik lain yang independen dari Kelas/Rombel.
ALTER TABLE "students" DROP COLUMN "tingkat";
ALTER TABLE "packages" DROP COLUMN "tingkat_list";
ALTER TABLE "blueprints" DROP COLUMN "tingkat_list";
