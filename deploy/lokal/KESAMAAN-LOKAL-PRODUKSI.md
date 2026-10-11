# Menyamakan komputer lokal dengan produksi (ayotka.id)

Tujuan: yang berjalan di `localhost` berperilaku **persis** seperti di ayotka.id. Caranya bukan membuat tiruan, melainkan
menjalankan **kode yang sama** di atas **database dan login yang sama**.

```
 komputer ini                                        server ayotka.id (187.77.115.29)
 ┌───────────────────────────┐   terowongan SSH      ┌──────────────────────────────┐
 │ next dev (localhost:3000) │ ─ 127.0.0.1:5433 ───► │ Postgres 17  (database)      │
 │ kode = commit produksi    │ ─ 127.0.0.1:19999 ──► │ GoTrue v2.196 (login, admin) │
 │ .env + .env.local         │ ─ https://ayotka.id ─► │ nginx → GoTrue (login publik)│
 └───────────────────────────┘                       └──────────────────────────────┘
```

> **Karena database dan login-nya produksi, semua yang Anda lakukan di localhost adalah tindakan di produksi.**
> Menghapus siswa, mengimpor soal, mereset kata sandi, mengirim email, memakai kuota AI: semuanya nyata. Baca bagian 5.

## 1. Apa yang sama, dan bagaimana dijamin

| Hal | Cara dijamin | Dicek oleh |
|---|---|---|
| **Kode** | Folder kerja = commit yang berjalan di server (deploy GitHub Actions terakhir yang sukses). Perubahan yang belum di-commit membuat kode lokal berbeda dari produksi dan dilaporkan sebagai `BEDA` lengkap dengan daftar berkasnya. | `npm run lokal:cek` bagian 1 |
| **Database** | Aplikasi lokal membaca/menulis database produksi yang sama lewat terowongan SSH (`DATABASE_URL` → `127.0.0.1:5433`). Skemanya otomatis sama. | bagian 4 dan `--db` |
| **Login (Auth)** | `NEXT_PUBLIC_SUPABASE_URL=https://ayotka.id/supabase`: GoTrue produksi yang sama, akun dan kata sandi yang sama. | bagian 4 |
| **API admin login** (13 rute: buat admin sekolah/mitra/dinas, reset kata sandi, registrasi, lupa kata sandi, hapus siswa, paksa keluar) | nginx menolaknya dari luar server, jadi dialihkan lewat terowongan kedua ke GoTrue (`SUPABASE_ADMIN_TUNNEL_URL`, `lib/supabase/admin-terowongan.ts`). | bagian 4 |
| **Konfigurasi** (kunci AI, email, Midtrans, enkripsi pengaturan, dll.) | Nilai yang sama persis; dibandingkan lewat sidik-jari tanpa membuka nilainya. | bagian 3 |
| **Versi** Node, Next, Prisma, Supabase, zona waktu | Dibandingkan dengan rekaman server. | bagian 2 |
| **Perilaku halaman** | 10 halaman/rute dibandingkan langsung dengan ayotka.id (status, pengalihan, judul, tautan, judul bagian, header keamanan). | bagian 5 |

## 2. Menyalakan

1. **Terowongan** (jendela PowerShell tersendiri; biarkan terbuka):
   ```powershell
   .\scripts\lokal\terowongan.ps1
   ```
   Skrip ini membuka dua penerusan sekaligus (database `5433` dan API admin `19999`). Bila ada terowongan lama (hanya satu
   penerusan) skrip menyebut cara menutupnya.
2. **Server dev** (jendela lain): `npm run dev`
3. **Periksa**: `npm run lokal:cek`. Hasil tiap butir: `SAMA`, `WAJAR` (beda tetapi memang begitu, ada alasannya), `CEK`
   (lihat manual), `BEDA` (harus dibereskan), `INFO`.

`.env` dan `.env.local` (keduanya diabaikan git) menentukan sisanya. `.env.local` mengalahkan `.env` dan berisi:
`LOKAL_TERHUBUNG_PRODUKSI=true` (mematikan unggah gambar, lihat bagian 4) dan `SUPABASE_ADMIN_TUNNEL_URL`.
Catatan: `.env.local` **tidak** bisa merujuk variabel di `.env` (`${VAR}` hanya bekerja di dalam satu berkas).

## 3. Merekam konfigurasi server (sekali, dan setelah ada perubahan besar di server)

Pemeriksa membandingkan dengan rekaman `deploy/lokal/produksi-referensi.json`. Rekaman dibuat dari server:

```powershell
.\scripts\lokal\ambil-konfigurasi-produksi.ps1
```

Skrip `deploy/self-host/skrip/cetak-konfigurasi.mjs` dialirkan lewat SSH ke `node` di server (tidak ada yang ditinggal atau
diubah di sana) dan mencetak JSON yang **tidak memuat rahasia**: nilai hanya untuk variabel yang jelas bukan rahasia,
alamat database tanpa kata sandi, dan untuk kunci/token hanya sidik-jari (10 heksadesimal pertama sha256, tidak bisa
dibalik). Kata sandi tidak diberi sidik-jari sama sekali. Sebelum disimpan, keluaran diperiksa lagi terhadap pola rahasia
umum. Isinya: commit di server, versi Node/npm/pm2/nginx, **zona waktu**, versi paket, variabel lingkungan efektif
(sumbernya: proses pm2 atau berkas `.env`), baris cron, arahan nginx yang memengaruhi aplikasi, dan wadah Docker.

Setelah itu `npm run lokal:cek` menunjukkan selisih nyata (mis. zona waktu, versi Node, variabel yang hilang).
Zona waktu server memengaruhi tanggal/jam yang dihitung di sisi server; bila beda, isi `TZ=` di `.env.local`.

## 4. Perbedaan yang tersisa (semuanya disengaja)

| Beda | Mengapa | Dampak |
|---|---|---|
| `next dev` vs `next start` | Server menjalankan build production; lokal biasanya mode development. | Logika dan tampilan sama; waktu muat, pesan galat, dan cache beda. |
| **Unggah gambar dimatikan** di lokal | Berkas hanya akan ada di disk komputer ini, sedangkan alamat `https://ayotka.id/media/...` tersimpan di database bersama, jadi gambar rusak bagi semua pengguna. Penjaganya di `lib/storage/media-lokal.ts` (aktif bila `LOKAL_TERHUBUNG_PRODUKSI=true`). | Unggah lewat https://ayotka.id. Impor soal dari generator tetap jalan, tetapi karena penyimpanan gagal, kode impor memakai cadangannya: gambar disimpan sebagai alamat sumber (`soal.ayotka.id`) atau data-URI di kolom `media`, bukan berkas di server (`GENERATOR_IMAGES_DIR` hanya ada di disk server). Lebih baik impor gambar dilakukan dari ayotka.id. |
| `SOAL_SOURCE_DATABASE_URL` | Server memakai peran baca-saja `ayotka_app_reader`; lokal memakai alamat yang sama dengan `DIRECT_URL`. | Kode hanya membaca; hasilnya sama. |
| Cron server (antrean AI tiap 5 menit, cadangan harian) | Hanya berjalan di server. | Analisis AI yang diminta dari lokal tetap diproses (antreannya di database bersama) oleh cron server. |
| nginx (HSTS, batas ukuran badan permintaan, gzip, `/media/*`) | Lapisan ini tidak ada di lokal. | Mis. foto Tutor AI yang terlalu besar ditolak nginx di server tetapi lolos di lokal. |
| Browser membuka `localhost` | Halaman `/reset-password` memanggil GoTrue dari browser; dari origin `localhost` ditolak CORS. | Tautan reset dari email mengarah ke `https://ayotka.id` (`NEXT_PUBLIC_APP_URL`), jadi di produksi, bukan di lokal. |

## 5. Risiko karena terhubung ke produksi

- **Data**: setiap tulis (hapus massal, impor, reset kata sandi, ubah pengaturan) langsung mengenai data produksi.
- **Email, AI, pembayaran**: kunci produksi aktif. Email terkirim ke alamat sungguhan; kuota Gemini terpakai.
- **Skrip di `scripts/`** yang menulis ke database (mis. `create-dummy-students.ts`, `demo-daya-serap.mjs`, skrip sinkronisasi
  media) menulis ke **produksi**. Jangan dijalankan tanpa niat.
- **Migrasi**: `prisma migrate deploy` dari komputer ini mengubah skema produksi. Migrasi seharusnya hanya lewat deploy.
- Kebiasaan aman: uji tulis dengan akun/sekolah khusus uji lalu hapus; lihat dulu `npm run lokal:cek`.
- Opsi yang lebih aman (belum dibuat, ketersediaannya tergantung kebutuhan): peran Postgres baca-saja untuk komputer ini
  (login tetap jalan; semua tulis ditolak), atau salinan data produksi di database lokal terpisah.

## 6. Mode production yang persis sama (opsional)

`npm run build` lalu `npx next start -p 3000` menjalankan build production seperti di server. Butuh RAM besar
(±2–3 GB bebas); matikan `npm run dev` dulu. Setelah itu `npm run lokal:cek` bagian 5 melaporkan mode production.

## 7. Bila lokal "tampak beda"

1. `npm run lokal:cek`: lihat butir `BEDA`.
2. `git status`: perubahan yang belum di-commit membuat kode tidak sama dengan produksi. Pekerjaan lain sebaiknya di cabang sendiri.
3. `git pull` bila lokal tertinggal dari commit produksi, lalu `npm ci` bila ada paket yang berubah.
4. Hapus cache dev: matikan `npm run dev`, hapus folder `.next\dev`, jalankan lagi.
5. Browser: cookie `localhost` berbeda dari cookie ayotka.id; masuk ulang sekali.

## 8. Perubahan yang belum di-commit

Selama ada perubahan yang belum di-commit (mis. pekerjaan yang belum selesai), kode lokal **tidak** sama dengan produksi;
`npm run lokal:cek` menyebut berkasnya. Kode lokal baru sama lagi setelah perubahan itu di-commit dan dideploy, atau
disimpan ke cabang lain. Jangan menyimpan atau membuang pekerjaan orang/AI lain di folder ini tanpa persetujuan pemiliknya.

Cabang `wip/*` di komputer ini (mis. `wip/lokal-2026-10-11`) hanyalah cadangan lokal yang tidak pernah di-push:
`git switch wip/lokal-2026-10-11` untuk melihatnya, atau `git checkout wip/lokal-2026-10-11 -- <berkas>` untuk mengambil satu berkas.
