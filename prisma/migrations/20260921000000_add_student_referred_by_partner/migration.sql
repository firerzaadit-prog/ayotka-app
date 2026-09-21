-- Siswa yang mendaftar mandiri dengan kode referral MITRA dicatat asalnya.
-- Kolom nullable (siswa lama = NULL), jadi tidak mengubah data yang ada.
ALTER TABLE "students" ADD COLUMN "referred_by_partner_id" UUID;

ALTER TABLE "students"
  ADD CONSTRAINT "students_referred_by_partner_id_fkey"
  FOREIGN KEY ("referred_by_partner_id") REFERENCES "partners"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "students_referred_by_partner_id_idx" ON "students"("referred_by_partner_id");
