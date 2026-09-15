-- Bagian 6.4 (kasus tepi #4): siswa butuh kode referral sendiri untuk
-- dibagikan ke calon siswa baru, dipakai untuk diskon 30% transaksi
-- pertama (lihat lib/billing/entitlements referral logic di checkout).
ALTER TABLE "students" ADD COLUMN "referral_code" TEXT;

-- Backfill siswa yang sudah ada (production) dengan kode unik acak,
-- charset sama seperti generateReadableCode (tanpa 0/O, 1/I).
DO $$
DECLARE
  r RECORD;
  new_code TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
BEGIN
  FOR r IN SELECT id FROM students WHERE referral_code IS NULL LOOP
    LOOP
      new_code := '';
      FOR i IN 1..6 LOOP
        new_code := new_code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM students WHERE referral_code = new_code);
    END LOOP;
    UPDATE students SET referral_code = new_code WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE "students" ALTER COLUMN "referral_code" SET NOT NULL;
CREATE UNIQUE INDEX "students_referral_code_key" ON "students"("referral_code");
