-- CreateEnum
CREATE TYPE "Role" AS ENUM ('siswa', 'admin_sekolah', 'admin_pusat');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('aktif', 'nonaktif');

-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('pending_verifikasi', 'aktif', 'suspend');

-- CreateEnum
CREATE TYPE "Jenjang" AS ENUM ('SD', 'SMP');

-- CreateEnum
CREATE TYPE "LevelKognitif" AS ENUM ('C1', 'C2', 'C3', 'C4', 'C5', 'C6');

-- CreateEnum
CREATE TYPE "Jalur" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('belum_klaim', 'sudah_klaim');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('pending', 'active', 'nonaktif');

-- CreateEnum
CREATE TYPE "TingkatKesulitan" AS ENUM ('mudah', 'sedang', 'sulit');

-- CreateEnum
CREATE TYPE "QuestionFormat" AS ENUM ('pg', 'pg_kompleks', 'pg_kategori');

-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('pusat', 'sekolah');

-- CreateEnum
CREATE TYPE "TipePaket" AS ENUM ('paralel', 'bertingkat');

-- CreateEnum
CREATE TYPE "ModePembahasan" AS ENUM ('langsung', 'setelah_tutup');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "VisibilityTarget" AS ENUM ('semua', 'sekolah', 'publik');

-- CreateEnum
CREATE TYPE "MetodeDistribusi" AS ENUM ('otomatis', 'manual');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('berjalan', 'paused', 'selesai', 'kedaluwarsa');

-- CreateEnum
CREATE TYPE "PlanTarget" AS ENUM ('sekolah', 'siswa');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('menunggu_verifikasi', 'disetujui', 'ditolak', 'kedaluwarsa');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('aktif', 'tenggang', 'kedaluwarsa', 'batal');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'aktif',
    "email_verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" UUID NOT NULL,
    "npsn" TEXT,
    "nama" TEXT NOT NULL,
    "jenjang" "Jenjang" NOT NULL,
    "alamat" TEXT,
    "kode_sekolah" TEXT NOT NULL,
    "status" "SchoolStatus" NOT NULL DEFAULT 'pending_verifikasi',
    "plan_id" UUID,
    "kuota_siswa" INTEGER NOT NULL,
    "langganan_mulai" TIMESTAMP(3),
    "langganan_berakhir" TIMESTAMP(3),

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jenjang" "Jenjang" NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_users" (
    "user_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "sub_role" TEXT,

    CONSTRAINT "school_users_pkey" PRIMARY KEY ("user_id","school_id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" UUID NOT NULL,
    "nama" TEXT NOT NULL,
    "mulai" TIMESTAMP(3) NOT NULL,
    "selesai" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "tingkat" INTEGER NOT NULL,
    "nama_rombel" TEXT NOT NULL,
    "wali_kelas_id" UUID,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materi" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "jenjang" "Jenjang" NOT NULL,
    "tingkat" INTEGER NOT NULL,
    "nama" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL,

    CONSTRAINT "materi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_materi" (
    "id" UUID NOT NULL,
    "materi_id" UUID NOT NULL,
    "nama" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL,

    CONSTRAINT "sub_materi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kompetensi" (
    "id" UUID NOT NULL,
    "sub_materi_id" UUID NOT NULL,
    "kode" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "level_kognitif" "LevelKognitif" NOT NULL,

    CONSTRAINT "kompetensi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "school_id" UUID,
    "nisn" TEXT,
    "nama" TEXT NOT NULL,
    "jenjang" "Jenjang" NOT NULL,
    "tingkat" INTEGER NOT NULL,
    "jalur" "Jalur" NOT NULL,
    "claim_token" TEXT,
    "claim_status" "ClaimStatus" NOT NULL DEFAULT 'belum_klaim',
    "tanggal_lahir" DATE,
    "status" "StudentStatus" NOT NULL DEFAULT 'pending',
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_enrollments" (
    "student_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,

    CONSTRAINT "student_enrollments_pkey" PRIMARY KEY ("student_id","class_id","academic_year_id")
);

-- CreateTable
CREATE TABLE "blueprints" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "jenjang" "Jenjang" NOT NULL,
    "tingkat" INTEGER NOT NULL,
    "nama" TEXT NOT NULL,
    "total_soal" INTEGER NOT NULL,

    CONSTRAINT "blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blueprint_items" (
    "id" UUID NOT NULL,
    "blueprint_id" UUID NOT NULL,
    "kompetensi_id" UUID NOT NULL,
    "tingkat_kesulitan" "TingkatKesulitan" NOT NULL,
    "format_soal" "QuestionFormat" NOT NULL,
    "jumlah_soal" INTEGER NOT NULL,

    CONSTRAINT "blueprint_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL,
    "owner_type" "OwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "jenjang" "Jenjang" NOT NULL,
    "tingkat" INTEGER NOT NULL,
    "nama" TEXT NOT NULL,
    "durasi_menit" INTEGER NOT NULL,
    "jumlah_soal" INTEGER NOT NULL,
    "acak_soal" BOOLEAN NOT NULL DEFAULT true,
    "acak_opsi" BOOLEAN NOT NULL DEFAULT true,
    "max_attempt" INTEGER,
    "tipe_paket" "TipePaket" NOT NULL DEFAULT 'paralel',
    "grup_paralel_id" UUID,
    "blueprint_id" UUID,
    "boleh_dipilih_siswa" BOOLEAN NOT NULL DEFAULT false,
    "mode_pembahasan" "ModePembahasan" NOT NULL DEFAULT 'setelah_tutup',
    "status" "PackageStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_visibility" (
    "id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "target_type" "VisibilityTarget" NOT NULL,
    "school_id" UUID,

    CONSTRAINT "package_visibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "format" "QuestionFormat" NOT NULL,
    "teks" TEXT NOT NULL,
    "media" TEXT,
    "bobot" INTEGER NOT NULL DEFAULT 1,
    "tingkat_kesulitan" "TingkatKesulitan" NOT NULL,
    "materi_id" UUID,
    "sub_materi_id" UUID,
    "kompetensi_id" UUID NOT NULL,
    "level_bloom" "LevelKognitif" NOT NULL,
    "pembahasan" TEXT,
    "created_by" UUID NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "teks" TEXT NOT NULL,
    "media" TEXT,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "urutan" INTEGER NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_categories" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL,

    CONSTRAINT "question_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_statements" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "teks" TEXT NOT NULL,
    "media" TEXT,
    "correct_category_id" UUID NOT NULL,
    "urutan" INTEGER NOT NULL,

    CONSTRAINT "question_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "class_id" UUID,
    "school_id" UUID,
    "mulai" TIMESTAMP(3) NOT NULL,
    "selesai" TIMESTAMP(3) NOT NULL,
    "metode_distribusi" "MetodeDistribusi" NOT NULL DEFAULT 'otomatis',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "assignment_id" UUID,
    "mulai_at" TIMESTAMP(3) NOT NULL,
    "selesai_at" TIMESTAMP(3),
    "status" "AttemptStatus" NOT NULL DEFAULT 'berjalan',
    "sisa_detik" INTEGER NOT NULL,
    "skor_mentah" DOUBLE PRECISION,
    "skor_akhir" DOUBLE PRECISION,
    "ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_answers" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "jawaban_json" JSONB,
    "skor" DOUBLE PRECISION,
    "skor_maks" DOUBLE PRECISION NOT NULL,
    "ragu" BOOLEAN NOT NULL DEFAULT false,
    "answered_at" TIMESTAMP(3),

    CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_answer_statements" (
    "id" UUID NOT NULL,
    "attempt_answer_id" UUID NOT NULL,
    "statement_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "attempt_answer_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_scores" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "kompetensi_id" UUID NOT NULL,
    "jml_benar" INTEGER NOT NULL,
    "jml_soal" INTEGER NOT NULL,
    "persentase" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "competency_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "versi_prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "ringkasan" TEXT NOT NULL,
    "detail_json" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "nama" TEXT NOT NULL,
    "target" "PlanTarget" NOT NULL,
    "harga" INTEGER NOT NULL,
    "durasi_hari" INTEGER NOT NULL,
    "kuota" INTEGER,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "nama_bank" TEXT NOT NULL,
    "nomor_rekening" TEXT NOT NULL,
    "atas_nama" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'menunggu_verifikasi',
    "bukti_transfer_url" TEXT,
    "catatan_admin" TEXT,
    "disetujui_oleh_admin_id" UUID,
    "disetujui_at" TIMESTAMP(3),
    "diperpanjang_oleh_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "mulai_at" TIMESTAMP(3) NOT NULL,
    "berakhir_at" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'aktif',
    "order_id" UUID,
    "diperpanjang_oleh_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_counters" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "periode_bulan" TEXT NOT NULL,
    "jml_attempt" INTEGER NOT NULL DEFAULT 0,
    "jml_analisis_ai" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ip" TEXT,
    "device" TEXT,
    "login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logout_at" TIMESTAMP(3),

    CONSTRAINT "login_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "aksi" TEXT NOT NULL,
    "entitas" TEXT NOT NULL,
    "entitas_id" TEXT,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "schools_npsn_key" ON "schools"("npsn");

-- CreateIndex
CREATE UNIQUE INDEX "schools_kode_sekolah_key" ON "schools"("kode_sekolah");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_kode_key" ON "subjects"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_nisn_key" ON "students"("nisn");

-- CreateIndex
CREATE UNIQUE INDEX "students_claim_token_key" ON "students"("claim_token");

-- CreateIndex
CREATE UNIQUE INDEX "student_enrollments_student_id_academic_year_id_key" ON "student_enrollments"("student_id", "academic_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_visibility_package_id_target_type_school_id_key" ON "package_visibility"("package_id", "target_type", "school_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_answers_attempt_id_question_id_key" ON "attempt_answers"("attempt_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_answer_statements_attempt_answer_id_statement_id_key" ON "attempt_answer_statements"("attempt_answer_id", "statement_id");

-- CreateIndex
CREATE UNIQUE INDEX "competency_scores_attempt_id_kompetensi_id_key" ON "competency_scores"("attempt_id", "kompetensi_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_analyses_attempt_id_key" ON "ai_analyses"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_counters_user_id_periode_bulan_key" ON "usage_counters"("user_id", "periode_bulan");

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_users" ADD CONSTRAINT "school_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_users" ADD CONSTRAINT "school_users_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_wali_kelas_id_fkey" FOREIGN KEY ("wali_kelas_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materi" ADD CONSTRAINT "materi_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_materi" ADD CONSTRAINT "sub_materi_materi_id_fkey" FOREIGN KEY ("materi_id") REFERENCES "materi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kompetensi" ADD CONSTRAINT "kompetensi_sub_materi_id_fkey" FOREIGN KEY ("sub_materi_id") REFERENCES "sub_materi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprints" ADD CONSTRAINT "blueprints_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprint_items" ADD CONSTRAINT "blueprint_items_blueprint_id_fkey" FOREIGN KEY ("blueprint_id") REFERENCES "blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprint_items" ADD CONSTRAINT "blueprint_items_kompetensi_id_fkey" FOREIGN KEY ("kompetensi_id") REFERENCES "kompetensi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_blueprint_id_fkey" FOREIGN KEY ("blueprint_id") REFERENCES "blueprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_visibility" ADD CONSTRAINT "package_visibility_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_visibility" ADD CONSTRAINT "package_visibility_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_kompetensi_id_fkey" FOREIGN KEY ("kompetensi_id") REFERENCES "kompetensi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_categories" ADD CONSTRAINT "question_categories_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_statements" ADD CONSTRAINT "question_statements_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_statements" ADD CONSTRAINT "question_statements_correct_category_id_fkey" FOREIGN KEY ("correct_category_id") REFERENCES "question_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answer_statements" ADD CONSTRAINT "attempt_answer_statements_attempt_answer_id_fkey" FOREIGN KEY ("attempt_answer_id") REFERENCES "attempt_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answer_statements" ADD CONSTRAINT "attempt_answer_statements_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "question_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_scores" ADD CONSTRAINT "competency_scores_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_scores" ADD CONSTRAINT "competency_scores_kompetensi_id_fkey" FOREIGN KEY ("kompetensi_id") REFERENCES "kompetensi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_disetujui_oleh_admin_id_fkey" FOREIGN KEY ("disetujui_oleh_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_diperpanjang_oleh_admin_id_fkey" FOREIGN KEY ("diperpanjang_oleh_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_diperpanjang_oleh_admin_id_fkey" FOREIGN KEY ("diperpanjang_oleh_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_logs" ADD CONSTRAINT "login_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
