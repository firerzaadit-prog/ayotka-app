-- Nomor urutan seri Try Out Mandiri tidak boleh kembar pada satu mata pelajaran dan jenjang (permintaan user,
-- 5 Okt 2026). Aplikasi sudah memeriksanya sebelum menyimpan (lib/exam/seri-mandiri.ts: periksaUrutanSeriPaket);
-- indeks ini adalah pengaman terakhir kalau dua admin menyimpan nomor yang sama pada saat bersamaan.
--
-- Hanya paket Mandiri yang punya urutan dan belum diarsipkan yang dihitung (paket arsip melepas nomornya, sama
-- seperti pemeriksaan di aplikasi). Indeks parsial tidak dapat ditulis di schema.prisma, jadi `prisma migrate dev`
-- akan menganggapnya di luar skema - jangan dihapus; migrasi ini aditif dan aman dijalankan ulang.
CREATE UNIQUE INDEX IF NOT EXISTS "packages_urutan_seri_unik"
  ON "packages" ("subject_id", "jenjang", "urutan_seri")
  WHERE "kategori" = 'mandiri' AND "urutan_seri" IS NOT NULL AND "status" <> 'archived';
