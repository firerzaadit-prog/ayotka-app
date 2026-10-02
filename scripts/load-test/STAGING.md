# Menyiapkan Lingkungan Uji (Staging) untuk Uji Beban

Staging = **proyek Supabase kedua + deployment Vercel kedua** yang memakai database dan kunci sendiri,
sehingga uji beban tidak menyentuh production (pengguna, nilai, dan pembayaran nyata aman). Panduan ini
dipakai bersama `README.md` (cara menjalankan k6 dan membaca hasilnya).

> **Waktu yang tepat:** setelah **Supabase Pro** dan **Vercel Pro** aktif. Hobby (Vercel) tidak untuk
> pemakaian komersial, dan paket Free Supabase tidak bisa menaikkan ukuran compute, jadi hasil uji di
> sana tidak mewakili production.

## Perkiraan biaya (cek harga terbaru di halaman billing)

| Komponen | Biaya | Catatan |
|---|---|---|
| Proyek Supabase staging (di organisasi Pro) | compute sendiri, mis. Micro $10/bln, Large $110/bln | Ditagih **per jam**; hapus proyek setelah uji = hanya bayar jam pakainya. |
| Vercel (deployment staging) | pemakaian saja, tidak ada biaya tetap tambahan | Sudah tercakup kredit Pro $20; pantau Spend Management. |
| k6 dari komputer sendiri | gratis | k6 Cloud berbayar, tidak wajib. |

Untuk uji yang berarti, naikkan compute proyek staging **sama dengan ukuran production** selama uji
(Supabase → Project Settings → Compute and Disk; ada jeda singkat saat mengganti), lalu hapus proyeknya.
Alternatif gratis: proyek Free di organisasi terpisah (kuotanya terpisah dari production) - cukup untuk
mencoba alur dan pemanasan kecil (≤ 50 siswa), tidak untuk beban besar.

## A. Supabase staging

1. Supabase → organisasi Pro → **New project** → nama `ayotka-staging`, wilayah **Singapore** (sama dengan
   production), kata sandi database yang kuat (simpan).
2. Authentication → **Rate Limits**: naikkan "sign-ups and sign-ins" dan "token refreshes" (mis. 5000 dan
   5000 per 5 menit) - login dikirim dari server Vercel sehingga batas per-IP berlaku untuk server.
3. Kumpulkan dari Project Settings: **Project URL**, **anon key**, **service role key** (API), dan
   **connection string** pooler (Database → Connection string; pakai port 6543 + `?pgbouncer=true`).
4. Buat berkas `.env.staging` di akar proyek (sudah di `.gitignore`, **jangan di-commit**):

   ```env
   DATABASE_URL="postgresql://postgres.<ID-PROYEK-STAGING>:<SANDI>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   NEXT_PUBLIC_SUPABASE_URL="https://<ID-PROYEK-STAGING>.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
   SUPABASE_SERVICE_ROLE_KEY="..."
   SEED_ADMIN_EMAIL="admin-staging@contoh.id"
   SEED_ADMIN_PASSWORD="<minimal 16 karakter>"
   ```

   **Periksa dua kali** `<ID-PROYEK-STAGING>` di `DATABASE_URL` dan di `NEXT_PUBLIC_SUPABASE_URL` sama dan
   BUKAN ID proyek production. (Skrip uji menolak jalan kalau keduanya berbeda atau Anda belum mengetik ID
   proyek tujuan - tapi pemeriksaan manual tetap yang pertama.)
5. Terapkan skema ke staging (membaca `.env.staging`, bukan `.env`):

   ```bash
   node --env-file=.env.staging node_modules/prisma/build/index.js migrate deploy
   ```

6. Isi data dasar, berurutan:

   ```bash
   npx tsx --env-file=.env.staging prisma/seed.ts                 # admin pusat pertama
   npx tsx --env-file=.env.staging scripts/seed-subjects.ts       # mapel
   ```

7. Paket soal uji dan akun siswa uji (ID proyek tujuan wajib diketik sebagai konfirmasi):

   ```bash
   # coba dulu: semua dibatalkan di akhir, hanya memastikan data sah
   LOAD_TEST_CONFIRM_PROJECT=<ID-PROYEK-STAGING> LOAD_TEST_ROLLBACK=1 \
     npx tsx --env-file=.env.staging scripts/load-test/seed-load-test-exam.ts
   # sungguhan (30 soal campuran; LOAD_TEST_KATEGORI=nasional untuk Try Out Nasional)
   LOAD_TEST_CONFIRM_PROJECT=<ID-PROYEK-STAGING> LOAD_TEST_QUESTIONS=30 \
     npx tsx --env-file=.env.staging scripts/load-test/seed-load-test-exam.ts
   # akun siswa (mulai kecil: 50; naikkan bertahap)
   LOAD_TEST_CONFIRM_PROJECT=<ID-PROYEK-STAGING> LOAD_TEST_COUNT=50 \
     npx tsx --env-file=.env.staging scripts/load-test/seed-load-test-students.ts
   ```

   (Di PowerShell: `$env:LOAD_TEST_CONFIRM_PROJECT="..."; $env:LOAD_TEST_COUNT="50"; npx tsx ...`)

## B. Vercel staging

Preview deployment Vercel dibuat untuk setiap branch git. Staging = branch `staging` dengan variabel
lingkungan sendiri.

1. Buat dan dorong branch: `git switch -c staging` lalu `git push -u origin staging`.
2. Vercel → proyek **ayotka-app** → Settings → **Environment Variables**. Tambahkan variabel berikut dengan
   Environment = **Preview** dan **Git Branch = `staging`** (variabel khusus branch menimpa variabel Preview
   umum):

   | Variabel | Nilai |
   |---|---|
   | `DATABASE_URL` | connection string pooler **staging** |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL proyek **staging** |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key staging |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role key staging |
   | `APP_ENCRYPTION_KEY` | string acak baru (bukan milik production) |
   | `NEXT_PUBLIC_APP_URL` | URL pratinjau staging (isi setelah deployment pertama) |
   | `PAYMENT_MODE` | `affiliate` |
   | `LOGIN_MAX_PER_IP` | `100000` (hanya di staging: semua siswa uji tampak dari satu IP) |

   Jangan isi kunci Gemini/Midtrans/email di staging: uji beban memakai `gunakanLearningAnalytics: false`
   dan tidak mengirim email.
3. **Penting - pastikan pratinjau lain tidak ikut menunjuk staging, dan staging tidak menunjuk production.**
   Cek daftar variabel Preview umum (tanpa branch) - kalau itu menunjuk ke production, itu yang dipakai
   branch lain selain `staging`.
4. Settings → **Deployment Protection** → **Protection Bypass for Automation** → buat kunci. Kunci ini
   dipakai k6 lewat `-e VERCEL_BYPASS=<kunci>` supaya bisa menembus perlindungan login pratinjau.
5. Push ke branch `staging`, tunggu build selesai, catat URL pratinjau (mis.
   `https://ayotka-app-git-staging-<tim>.vercel.app`).

## C. Periksa sebelum menembak (3 hal, wajib)

1. Buka URL staging dan login sebagai admin staging (`SEED_ADMIN_EMAIL`): berhasil, dan di Supabase staging →
   Table Editor → `login_logs` muncul baris barunya. (Kalau login gagal tapi akun itu ada di production,
   deployment masih menunjuk production - **hentikan**.)
2. Login sebagai satu siswa uji (NISN dari `students.json`) dan kerjakan paket "Uji Beban" sampai hasil
   tampil. Ini membuktikan seluruh alur berjalan sebelum 1000 siswa dicoba.
3. Di production, `login_logs` **tidak** bertambah akibat uji ini.

## D. Menjalankan uji bertahap

```bash
# Pemanasan (jeda berpikir singkat)
k6 run -e BASE_URL=https://<URL-STAGING> -e VERCEL_BYPASS=<kunci> -e TARGET_VUS=50 -e THINK_MIN=1 -e THINK_MAX=3 \
  scripts/load-test/exam-load-test.js
# Naik bertahap: 200 -> 500 -> 1000 -> ..., catat angka di mana ambang mulai gagal
k6 run -e BASE_URL=https://<URL-STAGING> -e VERCEL_BYPASS=<kunci> -e TARGET_VUS=1000 -e RAMP_SECONDS=300 \
  scripts/load-test/exam-load-test.js
```

Sebelum menaikkan beban, buat akun lebih banyak (`LOAD_TEST_COUNT=1000`, maks 10.000). Pantau Supabase
**Reports** (CPU, koneksi, memori) dan Vercel **Observability** (error 5xx, durasi fungsi) selama uji. Kalau
CPU atau koneksi database jenuh, naikkan compute staging dan ulangi. Batasi satu uji ≤ 30 menit dan pasang
Spend Management Vercel dengan batas kecil agar tagihan tidak kejutan.

## E. Setelah selesai

1. Bersihkan akun uji: `scripts/load-test/cleanup-load-test-students.ts` (lihat README).
2. Hapus variabel branch `staging` di Vercel dan branch `staging` di git.
3. **Hapus proyek Supabase staging** (Project Settings → General → Delete project) agar biaya berhenti.
4. Catat hasilnya (beban maksimum yang lolos ambang, ukuran compute yang dipakai) sebagai dasar menentukan
   ukuran compute production sebelum Try Out Nasional.
