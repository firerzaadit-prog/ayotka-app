# Load Test — Tiket 4.14

Target: ±1.000 siswa mengerjakan ujian bersamaan tanpa degradasi (Bagian 9 brief).

## Kenapa tidak dijalankan otomatis

Tugas AI coding agent ini berjalan di sandbox development, bukan di lingkungan yang
bisa menembak lalu lintas nyata ke server staging/produksi kalian dengan 1.000
koneksi bersamaan. Load test yang jujur **wajib** dijalankan dari luar (mesin lokal
tim, atau job CI khusus) melawan deployment staging yang sungguhan — bukan disimulasikan
di sini. Bagian ini menyiapkan skrip & datanya; menjalankannya adalah langkah manual kalian.

## Langkah-langkah

### 1. Siapkan data ujian lewat UI (sekali saja)

Di lingkungan **staging** (jangan produksi):

1. Admin Pusat → buat sekolah baru khusus load test, aktifkan, set kuota siswa
   >= jumlah akun yang mau dites (mis. 1000).
2. Admin Pusat → buat & aktifkan tahun ajaran.
3. Admin Sekolah (sekolah load test tadi) → buat 1 rombel.
4. Buat paket soal, isi beberapa soal (campuran PG/PG Kompleks/PG Kategori supaya
   realistis), publish.
5. Admin Sekolah → Penugasan Ujian → tugaskan paket itu ke rombel tadi, dengan
   jendela waktu (mulai/selesai) yang mencakup kapan load test akan dijalankan
   (mis. buka dari sekarang sampai beberapa jam ke depan).
6. Catat **school id** dan **class id** rombel itu (terlihat di URL halaman
   detail masing-masing, atau lewat Prisma Studio).

### 2. Seed akun siswa massal

```bash
LOAD_TEST_SCHOOL_ID=<school-id> \
LOAD_TEST_CLASS_ID=<class-id> \
LOAD_TEST_COUNT=1000 \
npx tsx scripts/load-test/seed-load-test-students.ts
```

Menghasilkan `scripts/load-test/students.json` (kredensial 1000 akun siswa
Jalur A, sudah "klaim" & siap login).

### 3. Install & jalankan k6

```bash
# Install (lihat https://k6.io/docs/get-started/installation/ untuk OS lain)
brew install k6   # macOS, contoh

k6 run -e BASE_URL=https://staging.ayotka.id -e TARGET_VUS=1000 \
  scripts/load-test/exam-load-test.js
```

Skrip akan ramp-up bertahap (2 menit naik ke target VU, tahan 5 menit,
turun 1 menit) — setiap "virtual user" login, buka ujian, jawab tiap soal
dengan jeda acak (simulasi waktu berpikir), lalu submit.

### 4. Baca hasilnya

k6 mencetak ringkasan di akhir run. Yang paling penting untuk kriteria selesai
Tiket 4.14 ("sistem tetap responsif, tidak ada request timeout massal"):

- `http_req_failed` — persentase request gagal. Ambang di skrip: `< 2%`.
- `http_req_duration p(95)` — 95% request selesai dalam berapa lama. Ambang: `< 3 detik`.

Kedua ambang batas ini contoh awal — sesuaikan dengan SLA yang kalian putuskan
sendiri. Kalau salah satu threshold gagal, k6 keluar dengan exit code bukan-nol
dan menandai metrik yang gagal di ringkasan.

### 5. Bersihkan setelah selesai

Akun load test (`Load Test Siswa 1..N`, email `*@nisn.ayotka.id` dengan NISN
berawalan `9`) sebaiknya dihapus (soft delete lewat halaman Siswa, atau hapus
langsung sekolah load test-nya lewat "Hapus sekolah" di Admin Pusat kalau
sudah tidak dibutuhkan) supaya tidak mengotori data staging.
