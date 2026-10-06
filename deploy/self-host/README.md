# Pindah ke server sendiri: database + login + gambar (Tahap 1)

Paket ini memindahkan **semua yang dipakai ayotka.id dari Supabase Cloud** ke server sendiri (VPS yang sama dengan
aplikasinya): database Postgres, mesin login (GoTrue, mesin yang sama dengan Supabase Auth), dan penyimpanan gambar
soal (disk + nginx). Tujuannya agar login tidak lagi bergantung pada kuota/pembatasan Supabase.

**Yang TIDAK dipindah di Tahap 1:** data soal milik generator (skema `soal`, 572 MB, dipakai soal.ayotka.id dan fitur
impor). Itu tetap di Supabase; `SOAL_SOURCE_DATABASE_URL` tidak diubah. Memindahkannya = Tahap 2, bersama dosen.

Semua skrip: **aman diulang**, **memverifikasi dirinya sendiri**, tidak pernah mencetak rahasia, dan tidak menyentuh
aplikasi yang sedang berjalan sampai Langkah 5.

## Gambaran alur

```
Langkah A   kirim kode baru ke GitHub (deploy otomatis)          di komputermu
Langkah B   salin paket ini ke server                             di komputermu + server
Langkah 0   periksa server (hanya membaca)                        server
Langkah 1   pasang database + login lokal (belum dipakai)         server
Langkah 2   cadangkan data dari Supabase (hanya membaca)          server
Langkah 3   pulihkan ke database lokal + bandingkan jumlah baris  server
Langkah 4   uji mesin login dengan alur yang sama seperti aplikasi server
Langkah N   pasang potongan nginx (/supabase dan /media)          server
Langkah 5   PINDAH: alihkan aplikasi ke database + login lokal    server   <- satu-satunya yang mengubah aplikasi
Langkah 7   verifikasi 5 peran dengan akun sementara              server
Langkah 8   pindahkan gambar lama (setelah pembatasan Supabase dicabut)
```

Selama Langkah 0-4 dan N, ayotka.id **tidak berubah sama sekali**.

---

## Langkah A - kode baru harus sudah live

Aplikasi perlu kode yang mengenal penyimpanan lokal, membaca status maintenance lewat Prisma (bukan REST Supabase), dan
menampilkan pesan "layanan masuk gangguan" yang jujur. Kode itu aman dipasang SEBELUM pindah (perilakunya tidak berubah
sampai `.env` diubah di Langkah 5). Tunggu sampai GitHub Actions "Deploy ayotka.id to VPS" hijau.

Cek di server: `ls /var/www/ayotka-app/lib/storage/media-lokal.ts` (harus ada).

## Langkah B - salin paket ke server

Di PowerShell komputermu (folder proyek `D:\ayotka-app`):

```powershell
scp -r deploy\self-host firerza@187.77.115.29:~/selfhost-paket
```

Lalu masuk ke server (`ssh firerza@187.77.115.29`) dan jalankan:

```bash
sudo mkdir -p /opt/ayotka-selfhost
sudo cp -r ~/selfhost-paket/. /opt/ayotka-selfhost/
sudo find /opt/ayotka-selfhost -type f \( -name '*.sh' -o -name '*.mjs' -o -name '*.yml' -o -name '*.sql' -o -name '*.conf' \) -exec sed -i 's/\r$//' {} +
cd /opt/ayotka-selfhost
```

(Baris `sed` membuang sisa format Windows; aman dijalankan walau tidak ada yang perlu dibuang.)

Semua perintah berikut dijalankan dari `/opt/ayotka-selfhost` dengan `sudo`.

## Langkah 0 - periksa server (hanya membaca)

```bash
sudo bash skrip/00-periksa-server.sh
```

Yang diperiksa: RAM/disk, Docker, port 5432 dan 9999 kosong, `.env` aplikasi lengkap, jangkauan ke Supabase, nginx valid,
dan **apakah kunci API tersimpan (Gemini dll.) masih terbaca** (lihat "Kunci enkripsi" di bawah). Baris `[ !! ]`
adalah peringatan; `[GAGAL]`/ringkasan akhir menyebut berapa masalah yang harus dibereskan dulu.

## Langkah 1 - pasang database dan login lokal

```bash
sudo bash skrip/01-siapkan.sh
```

Membuat rahasia baru (`/opt/ayotka-selfhost/.env`, izin 600), mengunduh image (~1 GB, pertama kali beberapa menit), dan
menjalankan dua container: `ayotka-db` (Postgres 17) dan `ayotka-auth` (GoTrue). Port hanya terikat ke `127.0.0.1`;
skrip berhenti kalau ada yang terbuka ke luar.

**Simpan salinan `/opt/ayotka-selfhost/.env` di tempat aman** (pengelola kata sandi). Jangan di chat, jangan di Git.
Kehilangan `JWT_SECRET` = semua orang login ulang dan kunci anon/service dibuat ulang; kehilangan `POSTGRES_PASSWORD`
= butuh pemulihan manual.

## Langkah 2 - cadangkan dari Supabase (hanya membaca dari Supabase)

```bash
sudo bash skrip/02-cadangkan-supabase.sh
# opsional, sebagai asuransi untuk data generator (+-600 MB):
sudo bash skrip/02-cadangkan-supabase.sh --dengan-soal
```

Hasil di `backup/<tanggal>/`: `public.dump`, `auth-akun.dump`, `hitung-sumber.txt`, `SHA256SUMS`. Setiap berkas diperiksa
terbaca utuh. **Salin ke komputermu** (perintahnya dicetak skrip) supaya ada arsip di luar server.

## Langkah 3 - pulihkan ke database lokal

```bash
sudo bash skrip/03-pulihkan.sh
```

Ketik `PULIHKAN` saat diminta. Menyalin skema `public` dan akun login (kata sandi dalam bentuk hash, tidak ada yang perlu
reset). Lalu **membandingkan jumlah baris setiap tabel** dengan Supabase; kalau ada yang beda, skrip berhenti dan
menunjukkan tabel mana. Boleh diulang kapan saja sebelum Langkah 5.

## Langkah 4 - uji mesin login lokal

```bash
sudo node skrip/04-uji-gotrue.mjs
```

Menguji alur yang dipakai aplikasi: buat akun lewat API admin, masuk, baca pengguna, pembaruan sesi (termasuk dua
pembaruan serentak), tautan pemulihan dan pendaftaran, penolakan kunci anon di API admin, pendaftaran publik ditutup, dan
40 login berturut-turut tanpa terkena batas laju. Semua harus `LULUS`; akun uji dihapus otomatis.

## Langkah N - pasang potongan nginx

Aplikasi akan memanggil login lewat `https://ayotka.id/supabase/auth/v1/...` dan menyajikan gambar dari
`https://ayotka.id/media/soal-media/...`. Keduanya diatur satu potongan konfigurasi.

1. Cari berkas konfigurasi situs ayotka.id:
   ```bash
   sudo grep -rln "server_name" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null
   sudo nginx -T 2>/dev/null | grep -n "server_name"
   ```
2. Pasang potongan dan buat cadangan konfigurasi (ganti `NAMA_BERKAS` dengan berkas dari langkah 1):
   ```bash
   sudo mkdir -p /etc/nginx/snippets /var/www/ayotka-media/soal-media
   sudo cp /opt/ayotka-selfhost/nginx/ayotka-selfhost.conf /etc/nginx/snippets/ayotka-selfhost.conf
   sudo cp /etc/nginx/sites-enabled/NAMA_BERKAS ~/nginx-NAMA_BERKAS.bak
   ```
3. Buka berkas itu (`sudo nano /etc/nginx/sites-enabled/NAMA_BERKAS`), cari blok `server { ... }` yang memuat
   `server_name ayotka.id` dan `listen 443`, lalu tambahkan **satu baris** tepat sebelum `location / {`:
   ```
       include /etc/nginx/snippets/ayotka-selfhost.conf;
   ```
   Simpan: `Ctrl+O`, `Enter`, `Ctrl+X`. (Jika alamat IP server bukan `187.77.115.29`, ubah dua baris `allow` di
   `ayotka-selfhost.conf` dulu.)
4. Uji lalu muat ulang:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```
5. Dari server: `curl -s https://ayotka.id/supabase/auth/v1/health` harus menjawab JSON (bukan 404).
   Dari komputermu (PowerShell): `curl.exe -s -o NUL -w "%{http_code}" https://ayotka.id/supabase/auth/v1/admin/users`
   harus **403** (API admin tertutup dari internet).
6. Uji ulang login lewat alamat publik: `sudo node skrip/04-uji-gotrue.mjs --publik` (semua LULUS).

Kalau bingung di langkah 3, kirim hasil `sudo nginx -T | sed -n '1,400p'` (tanpa rahasia) dan saya tuliskan barisnya.

## Langkah 5 - PINDAH

```bash
sudo bash skrip/05-pindah.sh
```

Skrip memeriksa semua prasyarat dulu (login lokal lulus, nginx meneruskan `/supabase` dan `/media`, kode baru sudah
ter-deploy), lalu meminta kamu mengetik `PINDAH`. Setelah itu, berurutan:
cadangkan `.env` aplikasi, jeda cron, ambil data terbaru dari Supabase dan pulihkan lagi, kunci kunci enkripsi, ubah
`.env`, `npm run build` (3-6 menit), `pm2 reload`, cek `/login` dan login palsu, pasang cadangan harian
(02:30 WIB, `/var/backups/ayotka`, 14 hari). Kalau build atau pengecekan gagal, `.env` dikembalikan otomatis.

Sepanjang proses (+-10 menit) situs boleh terasa tidak stabil; lakukan di luar jam ujian.

## Langkah 7 - verifikasi lima peran

```bash
sudo node skrip/07-verifikasi-peran.mjs
```

Membuat akun sementara siswa, admin sekolah, mitra, dinas pendidikan, dan admin pusat, lalu lewat alamat publik menguji:
masuk, beranda tiap peran (nama akun tampil), sesi bertahan, keluar, alur reset kata sandi, **sesi kedaluwarsa (penyebab
502 dulu)**, dan unggah gambar ke disk. Semua data uji dihapus otomatis. Semua harus `LULUS`.

## Langkah 8 - pindahkan gambar lama (nanti)

Gambar soal lama masih di Supabase Storage yang sekarang dibatasi (HTTP 402). Setelah pembatasan dicabut (upgrade atau
siklus tagihan baru):

```bash
sudo bash skrip/08-pindahkan-gambar.sh --bukti-transfer
```

Mengunduh semua gambar ke disk, memeriksa isinya gambar, mencadangkan database, lalu mengganti alamat lama di seluruh
kolom teks. Sebelum itu gambar lama tidak tampil (sama seperti sebelum pindah); gambar baru yang diunggah sudah tersimpan
di disk.

---

## Jalan mundur

```bash
sudo bash skrip/06-batalkan.sh
```

Mengembalikan `.env` aplikasi ke Supabase Cloud dan membangun ulang. **Hanya berguna kalau Supabase Auth sudah berfungsi
lagi.** Data yang dibuat setelah pindah hanya ada di database lokal (cadangannya disimpan sebelum batal).

## Kunci enkripsi pengaturan (penting)

Kunci API yang disimpan lewat Admin Pusat (Gemini, Midtrans, Resend, SMTP, Mailketing) dienkripsi dengan
`APP_ENCRYPTION_KEY`; **kalau itu kosong, aplikasi memakai `SUPABASE_SERVICE_ROLE_KEY`** (lib/security/crypto.ts). Karena
`SUPABASE_SERVICE_ROLE_KEY` berganti saat pindah, kunci yang tersimpan bisa mendadak tidak terbaca. `skrip/kunci-enkripsi.mjs`
(dipanggil Langkah 0 dan 5) memeriksanya dan, dengan `--kunci`, mengisi `APP_ENCRYPTION_KEY` dengan nilai kunci lama
sebelum diganti. Nilainya tidak pernah dicetak.

## Perawatan sehari-hari

- **Cadangan:** otomatis harian di `/var/backups/ayotka` (14 hari). Cadangan di server yang sama tidak melindungi dari
  server rusak: salin berkala ke komputermu, mis. `scp "firerza@187.77.115.29:/var/backups/ayotka/db-*.dump" .`
- **Status:** `cd /opt/ayotka-selfhost && sudo docker compose ps`; log: `sudo docker compose logs --tail 100 auth`
- **Mulai ulang:** `sudo docker compose restart` (container otomatis hidup lagi setelah server restart).
- **Pembaruan image:** versi dikunci di `docker-compose.yml`. Perbarui sengaja, bukan otomatis: ubah versi, lalu
  `sudo docker compose pull && sudo docker compose up -d`, lalu uji `04-uji-gotrue.mjs`.
- **Keamanan:** `sudo ss -ltn | grep -E ':5432|:9999'` harus menunjukkan `127.0.0.1` saja. Jangan membuka port 5432
  di firewall.
- **Migrasi Prisma ke depan** dari komputermu: buka terowongan `ssh -L 5433:127.0.0.1:5432 firerza@187.77.115.29`,
  lalu pakai `DIRECT_URL` ke `127.0.0.1:5433` (kata sandi di `/opt/ayotka-selfhost/.env`).

## Pemecahan masalah

| Gejala | Periksa |
|---|---|
| Login 503 "Layanan masuk sedang gangguan" | `sudo docker compose ps` (auth sehat?), `sudo docker compose logs --tail 50 auth`, `curl -s https://ayotka.id/supabase/auth/v1/health` |
| Login 401 padahal password benar | akun ada? `sudo docker exec ayotka-db psql -h localhost -U postgres -c "select email from auth.users limit 5"` |
| Semua pengguna terlempar ke login secara acak | `GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL` harus 10 di `docker-compose.yml` (uji Langkah 4 membuktikannya) |
| Gambar baru tidak tampil | `ls -l /var/www/ayotka-media/soal-media`, snippet nginx ter-include?, izin folder 755 |
| Kunci Gemini "tidak terbaca" | jalankan `sudo node skrip/kunci-enkripsi.mjs`; bila perlu isi ulang di Admin Pusat > Pengaturan |
| Build gagal di Langkah 5 | `.env` sudah dikembalikan otomatis; kirim 30 baris terakhir keluarannya |
| `curl https://ayotka.id/...` dari SERVER sendiri gagal/time out (padahal dari komputermu bisa) | server tidak bisa memanggil IP publiknya sendiri (hairpin). Solusi: `echo "127.0.0.1 ayotka.id" \| sudo tee -a /etc/hosts` lalu ulangi uji |
| Disk penuh | `sudo du -sh /var/lib/docker /var/backups/ayotka /opt/ayotka-selfhost/volumes` |

## Setelah pindah: matikan Vercel

Vercel masih punya `.env` dan cron lama yang menunjuk ke database Supabase LAMA (data di sana sudah tidak dipakai).
Setelah Langkah 7 lulus, hentikan proyek Vercel (atau hapus entri `crons` di `vercel.json` dan hentikan deployment
otomatisnya) supaya tidak ada proses yang menulis ke database lama. Penjadwalan sudah berjalan lewat cron server
(`/etc/cron.d/ayotka`, tiap 5 menit).

## Tahap 2 (nanti, bersama dosen): data soal generator

Memindahkan skema `soal` (572 MB) ke Postgres yang sama berarti `DATABASE_URL` aplikasi generator (soal.ayotka.id) dan
`SOAL_SOURCE_DATABASE_URL` ayotka.id diubah, role baca-saja `ayotka_app_reader` dibuat ulang, dan generator dijeda saat
dump terakhir. Sekaligus kesempatan menurunkan beban data: kolom `payload` rata-rata 106 KB per soal karena gambar/SVG
disimpan di dalam database.
