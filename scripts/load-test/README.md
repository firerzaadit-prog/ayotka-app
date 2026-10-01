# Uji Beban Ujian Serentak

Tujuan: memastikan ratusan sampai ribuan siswa bisa mengerjakan ujian **bersamaan** tanpa
kegagalan massal, sebelum Try Out Nasional atau ujian sekolah besar.

> ## JANGAN jalankan ke production
> Skrip menciptakan ribuan akun & percobaan palsu, dan k6 menembak lalu lintas besar. Pakai
> **lingkungan uji (staging)**: proyek Supabase terpisah + deployment Vercel terpisah (mis. branch
> khusus dengan variabel lingkungan staging). Skrip `seed`/`cleanup` menolak berjalan kecuali Anda
> mengetik host database tujuan di `LOAD_TEST_CONFIRM_HOST` — itu pengaman supaya tidak salah arah.

## Yang diuji

Satu siswa (satu "VU") menjalani alur nyata: login → daftar ujian → halaman instruksi → mulai ujian →
muat soal → jawab soal satu per satu dengan jeda berpikir (sambil **menyegarkan status tiap 20 detik**
seperti halaman ujian sungguhan) → submit → buka halaman hasil. Kedatangan siswa disebar acak
(`RAMP_SECONDS`), bukan semuanya sekaligus.

## Langkah

### 1. Siapkan lingkungan uji
- Proyek Supabase uji dengan skema yang sama (`npx prisma migrate deploy` ke database uji).
- Deployment aplikasi yang menunjuk ke database uji itu. Di deployment uji **saja**, naikkan langit-langit
  login (lihat bagian "Batas login" di bawah), mis. `LOGIN_MAX_PER_IP=100000`, dan batas Supabase Auth proyek uji.
- Isi `.env` lokal dengan `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` milik
  **lingkungan uji** (bukan production).

### 2. Buat akun siswa uji

```bash
LOAD_TEST_CONFIRM_HOST=<host database uji> LOAD_TEST_COUNT=1000 \
  npx tsx --env-file=.env scripts/load-test/seed-load-test-students.ts
```

Membuat sekolah uji "Sekolah Load Test (hapus setelah uji)" dengan kuota kursi cukup, `COUNT` akun
siswa Jalur A (NISN `9xxxxxxxxx`, nama `Load Test Siswa N`), dan menulis kredensialnya ke
`scripts/load-test/students.json` (sudah di `.gitignore` — jangan di-commit). Aman dijalankan ulang.
Maksimum 10.000 akun per run.

### 3. Siapkan ujiannya (lewat aplikasi uji)
- Buat & terbitkan satu paket soal (campur PG / PG Kompleks / PG Kategori supaya realistis).
- **Try Out Mandiri/Nasional** (`MODE=package`, bawaan): pastikan paket terlihat oleh sekolah uji
  (distribusi ke semua sekolah/sekolah uji) dan jenjangnya cocok (akun uji = SMP).
- **Ujian Terjadwal** (`MODE=assignment`): login sebagai admin sekolah "Sekolah Load Test" dan
  tugaskan paket ke seluruh sekolah dengan jendela waktu yang mencakup waktu uji.

### 4. Jalankan k6

```bash
# Pemanasan kecil dulu (jeda berpikir singkat)
k6 run -e BASE_URL=https://staging.contoh.id -e TARGET_VUS=50 -e THINK_MIN=1 -e THINK_MAX=3 \
  scripts/load-test/exam-load-test.js

# Beban sebenarnya
k6 run -e BASE_URL=https://staging.contoh.id -e TARGET_VUS=1000 -e RAMP_SECONDS=300 \
  scripts/load-test/exam-load-test.js
```

Variabel: `BASE_URL`, `TARGET_VUS` (dibatasi jumlah akun), `RAMP_SECONDS`, `MODE` (`package`|`assignment`),
`KATEGORI` (`mandiri`|`nasional`), `PACKAGE_ID`, `THINK_MIN`/`THINK_MAX` (detik), `MAX_MINUTES`.
Install k6: https://k6.io/docs/get-started/installation/

### 5. Membaca hasil

Ambang batas yang dipasang di skrip (ubah sesuai target Anda):

| Metrik | Ambang | Artinya |
|---|---|---|
| `http_req_failed` | < 2% | persentase permintaan gagal |
| `http_req_duration` p(95) | < 3 detik | 95% permintaan selesai secepat ini |
| `...{name:jawaban}` dan `{name:sinkron}` | p(95) < 1,5 dtk | simpan jawaban & penyegaran harus ngebut |
| `...{name:soal}` dan `{name:mulai_ujian}` | p(95) < 3 dtk | lonjakan saat banyak siswa mulai bersamaan |
| `checks` | > 98% | semua langkah alur berhasil |

Metrik tambahan: `ujian_selesai` (siswa yang sampai submit), `ujian_tidak_bisa_mulai` (tidak ada ujian
yang bisa dikerjakan / ditolak), `login_kena_batas_laju` (login ditolak 429 oleh batas aplikasi atau Supabase —
harus 0 di staging).

Sambil uji berjalan, pantau **Supabase → Reports** (CPU, koneksi, memori) dan **Vercel → Observability**
(error 5xx, durasi fungsi). Kalau CPU/koneksi database jenuh, naikkan compute Supabase dan ulangi.
Naikkan `TARGET_VUS` bertahap (50 → 200 → 1000 → ...) dan catat angka di mana ambang mulai gagal.

### 6. Bersihkan

```bash
LOAD_TEST_CONFIRM_HOST=<host database uji> LOAD_TEST_DRY_RUN=1 \
  npx tsx --env-file=.env scripts/load-test/cleanup-load-test-students.ts   # lihat dulu apa yang dihapus
LOAD_TEST_CONFIRM_HOST=<host database uji> \
  npx tsx --env-file=.env scripts/load-test/cleanup-load-test-students.ts
```

Menghapus percobaan & jawaban uji, siswa uji, akun loginnya di Supabase Auth, dan sekolah uji (kalau
sudah kosong), lalu menghapus `students.json`. Hanya siswa yang **sekaligus** milik sekolah uji, ber-NISN
`9xxxxxxxxx`, dan bernama `Load Test Siswa N` yang disentuh.

## Batas login (juga berlaku di production)

`POST /api/auth/login` hanya menghitung **login yang GAGAL** (kata sandi/akun salah), bukan semua percobaan,
jadi satu kelas atau lab sekolah yang keluar lewat satu IP publik bisa login serentak selama kata sandinya
benar. Bawaan (per menit, per server), tidak perlu disetel:

| Batas | Bawaan | Variabel darurat |
|---|---|---|
| kegagalan dari satu IP (semua akun) | 30 | `LOGIN_FAIL_LIMIT_PER_IP` |
| kegagalan pada satu akun dari satu IP | 5 | `LOGIN_FAIL_LIMIT_PER_ACCOUNT` |
| semua percobaan dari satu IP (langit-langit anti banjir) | 600 | `LOGIN_MAX_PER_IP` |

Variabel hanya "rem darurat" (mis. saat ada serangan). Nilai kosong/salah ketik kembali ke bawaan.

**Untuk uji beban dari satu mesin**, semua siswa tampak berasal dari satu IP (Vercel menimpa header
`x-forwarded-for`, jadi tidak bisa dipalsukan). Login yang berhasil tidak dihitung, tapi langit-langit semua
percobaan tetap berlaku: di deployment uji **saja**, set `LOGIN_MAX_PER_IP=100000` agar tidak menghambat uji.

**Batas Supabase Auth (di luar kode kita).** Supabase membatasi login per IP **server** kita (bukan IP siswa,
karena login dikirim dari server Vercel): Authentication → Rate Limits → "sign-ups and sign-ins" (bawaan 30
per 5 menit per IP) dan "token refreshes" (bawaan 150 per 5 menit per IP). Untuk uji beban/ujian serentak,
naikkan di proyek uji (dan di production sebelum ujian besar). Kalau terkena, aplikasi menampilkan "Sistem sedang
ramai" (HTTP 429), bukan "password salah", dan metrik k6 `login_kena_batas_laju` akan naik.
