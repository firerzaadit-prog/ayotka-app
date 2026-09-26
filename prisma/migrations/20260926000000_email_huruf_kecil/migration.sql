-- Email dulu disimpan persis seperti diketik ("Budi@gmail.com"), sementara lupa
-- password & kirim ulang konfirmasi mencari pakai huruf kecil - akun seperti itu
-- tidak bisa reset password. Skema validasi sekarang menormalisasi email jadi
-- huruf kecil; baris lama disamakan di sini. Sudah dicek tidak ada dua akun yang
-- bentrok setelah diubah (kalau ada, unique index membatalkan migrasi ini).
UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");
