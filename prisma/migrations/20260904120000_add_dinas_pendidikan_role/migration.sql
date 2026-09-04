-- Tambah role dinas_pendidikan (akses read-only lintas sekolah untuk lihat
-- persentase kesiapan TKA). Migrasi terpisah & minimal (cuma tambah value
-- enum) karena PostgreSQL tidak mengizinkan value enum baru dipakai dalam
-- transaksi yang sama dengan ALTER TYPE-nya - biarkan berdiri sendiri.
ALTER TYPE "Role" ADD VALUE 'dinas_pendidikan';
