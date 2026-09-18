-- CreateTable
CREATE TABLE "try_out_groups" (
    "id" UUID NOT NULL,
    "owner_type" "OwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "jenjang" "Jenjang" NOT NULL,
    "tingkat_list" INTEGER[],
    "nama" TEXT NOT NULL,
    "durasi_menit" INTEGER NOT NULL,
    "jumlah_soal" INTEGER NOT NULL,
    "max_attempt" INTEGER,
    "target_siswa" "TargetSiswa" NOT NULL DEFAULT 'semua',
    "mode_pembahasan" "ModePembahasan" NOT NULL DEFAULT 'setelah_tutup',
    "status" "PackageStatus" NOT NULL DEFAULT 'draft',
    "buka_mulai" TIMESTAMP(3),
    "buka_selesai" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "try_out_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "try_out_group_visibility" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "target_type" "VisibilityTarget" NOT NULL,
    "school_id" UUID,

    CONSTRAINT "try_out_group_visibility_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "packages" ADD COLUMN "try_out_group_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "try_out_group_visibility_group_id_target_type_school_id_key" ON "try_out_group_visibility"("group_id", "target_type", "school_id");

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_try_out_group_id_fkey" FOREIGN KEY ("try_out_group_id") REFERENCES "try_out_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_out_groups" ADD CONSTRAINT "try_out_groups_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_out_group_visibility" ADD CONSTRAINT "try_out_group_visibility_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "try_out_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_out_group_visibility" ADD CONSTRAINT "try_out_group_visibility_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
