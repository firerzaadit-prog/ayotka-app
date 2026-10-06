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

Paket ikut terkirim ke server lewat deploy GitHub (folder `deploy/self-host` di dalam folder aplikasi), jadi cukup
disalin di server. Masuk dengan `ssh -o ServerAliveInterval=30 firerza@187.77.115.29`, lalu:

```bash
sudo mkdir -p /opt/ayotka-selfhost
sudo cp -r /var/www/ayotka-app/deploy/self-host/. /opt/ayotka-selfhost/
cd /opt/ayotka-selfhost
```

Menyalin ulang paket yang diperbarui aman: `.env` rahasia, `volumes/`, dan `backup/` tidak ada di repo sehingga tidak
tertimpa. (Mengirim dari komputer lain: `scp -r deploy\self-host firerza@IP:~/selfhost-paket`, lalu
`sudo find /opt/ayotka-selfhost -type f \( -name '*.sh' -o -name '*.mjs' -o -name '*.yml' -o -name '*.sql' -o -name '*.conf' \) -exec sed -i 's/\r$//' {} +`
untuk membuang sisa format Windows.)

Semua perintah berikut dijalankan dari `/opt/ayotka-selfhost` dengan `sudo`.

### Langkah panjang: jalankan di latar belakang server

Sambungan SSH bisa putus di tengah jalan (idle, laptop tidur, jaringan). Langkah yang lama (1, 2, 3+4, 5) sebaiknya
dijalankan seperti ini, supaya tetap berjalan walau SSH putus; hasilnya dibaca dari berkas log:

```bash
sudo -v
sudo rm -f /tmp/ayotka-selesai
sudo nohup bash -c 'bash skrip/01-siapkan.sh > /tmp/ayotka-langkah1.log 2>&1 && bash skrip/02-cadangkan-supabase.sh > /tmp/ayotka-langkah2.log 2>&1; echo selesai > /tmp/ayotka-selesai' > /dev/null 2>&1 &
# lihat hasilnya (ulangi sampai muncul "proses sudah berhenti"):
tail -n 25 /tmp/ayotka-langkah1.log | cut -c1-220; tail -n 40 /tmp/ayotka-langkah2.log | cut -c1-220
ls /tmp/ayotka-selesai 2>/dev/null && echo "(proses sudah berhenti)"
```

Langkah 3 memakai `--ya` agar tidak menunggu ketikan (aman: database lokal belum dipakai):
`bash skrip/03-pulihkan.sh --ya > /tmp/ayotka-langkah3.log 2>&1 && node skrip/04-uji-gotrue.mjs > /tmp/ayotka-langkah4.log 2>&1`.
Langkah 5 meminta ketikan `PINDAH`, jadi jalankan di depan layar (bukan nohup).

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

Server ini punya beberapa situs, masing-masing berkas sendiri di `/etc/nginx/sites-enabled/` (ayotka.id, soal.ayotka.id,
ai.ayotka.id, dst.). Potongan hanya disisipkan ke blok HTTPS milik **ayotka.id**; situs lain tidak tersentuh. Lihat
dulu petanya (hanya membaca):

```bash
sudo nginx -T 2>/dev/null | grep -nE "^# configuration file|server_name|listen |location |proxy_pass" | cut -c1-150
```

Cari berkas `ayotka.id` (di server ini: `/etc/nginx/sites-enabled/ayotka.id`, satu `location / {` ke
`127.0.0.1:3001`). Lalu jalankan blok ini (terbukti di server pada 6 Okt 2026). Ia memberi cadangan berkas,
mendaftarkan alamat server sendiri (IPv4 dan IPv6) sebagai satu-satunya yang boleh memanggil API admin login,
menyisipkan satu baris `include` tepat sebelum `location / {` (hanya bila belum ada), menguji dengan `nginx -t`, dan
**mengembalikan berkas lama otomatis bila gagal**:

```bash
sudo mkdir -p /etc/nginx/snippets /var/www/ayotka-media/soal-media
sudo cp /opt/ayotka-selfhost/nginx/ayotka-selfhost.conf /etc/nginx/snippets/ayotka-selfhost.conf
BERKAS=/etc/nginx/sites-enabled/ayotka.id
sudo cp -L "$BERKAS" ~/nginx-ayotka.id.sebelum-selfhost.bak
for a in ::1 $(ip -6 addr show scope global | awk '/inet6/ {print $2}' | cut -d/ -f1); do sudo grep -q "allow $a;" /etc/nginx/snippets/ayotka-selfhost.conf || sudo sed -i "/allow 187.77.115.29;/a\    allow $a;" /etc/nginx/snippets/ayotka-selfhost.conf; done
grep -n "allow\|deny" /etc/nginx/snippets/ayotka-selfhost.conf
sudo grep -q "ayotka-selfhost.conf" "$BERKAS" || sudo sed -i --follow-symlinks '0,/^[[:space:]]*location \/ {/s//    include \/etc\/nginx\/snippets\/ayotka-selfhost.conf;\n\n    location \/ {/' "$BERKAS"
grep -n -B1 -A3 "ayotka-selfhost.conf" "$BERKAS"
sudo nginx -t && sudo systemctl reload nginx && echo "NGINX DIMUAT ULANG" || { echo "nginx -t GAGAL - mengembalikan berkas lama"; sudo cp ~/nginx-ayotka.id.sebelum-selfhost.bak "$BERKAS"; sudo nginx -t; }
```

(Jika IP publik server bukan `187.77.115.29`, ubah baris `allow` di `nginx/ayotka-selfhost.conf` dulu.)

Uji hasilnya:

```bash
curl -s --max-time 20 https://ayotka.id/supabase/auth/v1/health; echo                     # JSON ber-"version"
curl -s -o /dev/null -w "%{http_code}\n" https://ayotka.id/supabase/auth/v1/admin/users    # dari server: 401
sudo node skrip/04-uji-gotrue.mjs --publik                                                 # semua LULUS
```

Dari komputer lain (internet), API admin harus tertutup: `curl.exe -s -o NUL -w "%{http_code}" https://ayotka.id/supabase/auth/v1/admin/users`
harus **403**, dan `/supabase/rest/v1/` serta gambar yang tidak ada harus 404. Berkas statis di `/media/soal-media/`
dilayani nginx dari `/var/www/ayotka-media/soal-media/` (uji penuhnya dilakukan otomatis oleh Langkah 5).

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
| `ayotka-auth` restart terus, log "must be owner of function uid" | GoTrue harus memakai `supabase_admin` di `GOTRUE_DB_DATABASE_URL` (fungsi `auth.uid()` dimiliki role `postgres` pada image ini) |
| Buat akun gagal 500 "column users.aud does not exist" | `GOTRUE_DB_DATABASE_URL` harus berakhiran `?search_path=auth` (kalau tidak, GoTrue membaca tabel `users` aplikasi di skema `public`) |
| SSH putus di tengah langkah panjang | jalankan lewat `sudo nohup ... &` dan baca log di /tmp (lihat "Langkah panjang" di Langkah B) |
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
