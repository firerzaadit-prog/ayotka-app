#!/usr/bin/env bash
# LANGKAH 11 - mengalihkan pemakai skema `soal` dari Supabase ke database LOKAL (salinannya dibuat skrip/10 --final).
#   - ayotka.id: SOAL_SOURCE_DATABASE_URL di .env aplikasi diganti ke akun baca-saja lokal, aplikasi di-reload.
#   - generator soal.ayotka.id: alamat barunya disiapkan di berkas (hanya root yang bisa membaca); pemilik generator
#     yang memasangnya di .env generator (skrip ini sengaja TIDAK menyentuh generator).
# Syarat: salinan AKHIR dari skrip/10 --final yang dibuat <= 30 menit lalu, dan isi Supabase masih identik dengannya.
#
#   sudo bash skrip/11-alihkan-soal.sh [--ya]     mengalihkan
#   sudo bash skrip/11-alihkan-soal.sh --batalkan mengembalikan ayotka.id ke Supabase (generator dikembalikan manual)
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
harus_root
cd "$PAKET_DIR"

GENERATOR_DIR="${GENERATOR_DIR:-/var/www/generator-soal-tka}"
BERKAS_URL_GENERATOR="$PAKET_DIR/soal-app-url.txt"
BERKAS_URL_LAMA="$PAKET_DIR/.soal-url-lama"
BATALKAN=0
YA=0
while [ $# -gt 0 ]; do
  case "$1" in
    --batalkan) BATALKAN=1 ;;
    --ya) YA=1 ;;
    *) gagal "Argumen tidak dikenal: $1" ;;
  esac
  shift
done

[ -f "$TANDA_SELESAI" ] || gagal "Pemindahan database ayotka.id (Langkah 5) belum selesai."

petunjuk_generator() {
  echo
  info "UNTUK PEMILIK GENERATOR (soal.ayotka.id) - sekitar 1 menit:"
  echo "  1. Lihat alamat barunya:   sudo cat $BERKAS_URL_GENERATOR"
  echo "  2. Di $GENERATOR_DIR/.env ganti baris DATABASE_URL=... dengan baris itu"
  echo "     (simpan baris lama di komentar # sebagai cadangan; JANGAN hapus bagian ?sslmode=disable - tanpa itu kode"
  echo "     generator memaksa SSL dan database lokal menolaknya)."
  echo "  3. Nyalakan lagi dengan akun yang menjalankan pm2 generator:   pm2 restart generator-soal-tka --update-env"
  echo "  4. Uji: login di https://soal.ayotka.id lalu buka daftar paket/soal."
}

# ---------- pembatalan ----------
if [ "$BATALKAN" -eq 1 ]; then
  [ -f "$TANDA_SOAL_DIALIHKAN" ] || gagal "Belum ada pengalihan yang bisa dibatalkan."
  [ -s "$BERKAS_URL_LAMA" ] || gagal "Alamat lama ($BERKAS_URL_LAMA) tidak tersimpan; kembalikan SOAL_SOURCE_DATABASE_URL secara manual."
  peringatan "Pembatalan mengembalikan ayotka.id membaca soal dari SUPABASE. Bila GENERATOR sudah menulis ke database lokal sejak pengalihan,"
  peringatan "data barunya (soal baru, log) hanya ada di lokal dan TIDAK ikut kembali. Hentikan generator dulu, dan kembalikan"
  peringatan "DATABASE_URL generator ke alamat Supabase lama sebelum menyalakannya lagi."
  [ "$YA" -eq 1 ] || konfirmasi BATALKAN "Kembalikan ayotka.id ke database soal di Supabase."
  set_env "$APP_ENV" SOAL_SOURCE_DATABASE_URL "$(cat "$BERKAS_URL_LAMA")"
  ( cd "$APP_DIR" && pm2 reload ayotka-app --update-env )
  rm -f "$TANDA_SOAL_DIALIHKAN"
  ok "ayotka.id kembali membaca soal dari Supabase."
  info "Kembalikan juga DATABASE_URL di $GENERATOR_DIR/.env ke alamat Supabase lama, lalu: pm2 restart generator-soal-tka --update-env"
  exit 0
fi

# ---------- sudah dialihkan ----------
if [ -f "$TANDA_SOAL_DIALIHKAN" ]; then
  ok "Sudah dialihkan ($(cat "$TANDA_SOAL_DIALIHKAN"))."
  petunjuk_generator
  exit 0
fi

# ---------- syarat ----------
[ -f "$TANDA_SOAL_FINAL" ] || gagal "Belum ada salinan AKHIR. Hentikan generator (pm2 stop generator-soal-tka), lalu: sudo bash skrip/10-pindahkan-skema-soal.sh --final"
find "$TANDA_SOAL_FINAL" -mmin -30 2>/dev/null | grep -q . \
  || gagal "Salinan akhir sudah lebih dari 30 menit. Ulangi: sudo bash skrip/10-pindahkan-skema-soal.sh --final"
wadah_sehat "$DB_CONTAINER" || gagal "Database lokal belum sehat (docker compose ps)."
muat_sumber_lama || exit 1

sandi_reader=$(baca_env "$ENV_PAKET" SOAL_READER_PASSWORD)
sandi_app=$(baca_env "$ENV_PAKET" SOAL_APP_PASSWORD)
[ -n "$sandi_reader" ] && [ -n "$sandi_app" ] || gagal "Kata sandi peran soal tidak ada di $ENV_PAKET - jalankan skrip/10 dulu."

info "Memeriksa ulang bahwa salinan lokal masih IDENTIK dengan Supabase..."
[ "$(sidik_soal sumber)" = "$(sidik_soal lokal)" ] \
  || gagal "Isi skema soal di Supabase berbeda dari salinan lokal (ada yang menulis sejak salinan akhir). Hentikan generator lalu ulangi skrip/10 --final."
ok "Identik."

# ---------- hak akses harus pas: tidak kurang, tidak lebih ----------
uji_sql() { # peran sandi sql -> keluaran; sandi lewat lingkungan supaya tidak muncul di daftar proses
  PGPASSWORD="$2" docker exec -e PGPASSWORD "$DB_CONTAINER" psql -h localhost -U "$1" -d postgres -v ON_ERROR_STOP=1 -Atc "$3"
}
harus_bisa() { # peran sandi sql deskripsi
  uji_sql "$1" "$2" "$3" >/dev/null 2>&1 || gagal "Seharusnya BISA tetapi gagal: $4"
}
harus_ditolak() { # peran sandi sql deskripsi
  if uji_sql "$1" "$2" "$3" >/dev/null 2>&1; then gagal "Seharusnya DITOLAK tetapi berhasil (hak terlalu luas): $4"; fi
}
info "Menguji hak akses peran..."
harus_bisa ayotka_app_reader "$sandi_reader" "select count(*) from soal.question_packages" "pembaca ayotka membaca soal.question_packages"
harus_bisa ayotka_app_reader "$sandi_reader" "select count(*) from soal.questions" "pembaca ayotka membaca soal.questions"
harus_bisa ayotka_app_reader "$sandi_reader" "select count(*) from soal.stimulus" "pembaca ayotka membaca soal.stimulus"
harus_ditolak ayotka_app_reader "$sandi_reader" "select 1 from soal.users limit 1" "pembaca ayotka membaca soal.users (akun generator)"
harus_ditolak ayotka_app_reader "$sandi_reader" "select 1 from public.users limit 1" "pembaca ayotka membaca public.users"
[ "$(uji_sql ayotka_app_reader "$sandi_reader" "select has_table_privilege(current_user,'soal.questions','INSERT') or has_table_privilege(current_user,'soal.questions','UPDATE') or has_table_privilege(current_user,'soal.questions','DELETE')")" = "f" ]   || gagal "Seharusnya DITOLAK tetapi berhasil (hak terlalu luas): pembaca ayotka punya hak tulis pada soal.questions"
harus_bisa soal_app "$sandi_app" "select count(*) from soal.users" "generator membaca soal.users"
[ "$(uji_sql soal_app "$sandi_app" "select has_table_privilege(current_user,'soal.questions','INSERT') and has_table_privilege(current_user,'soal.questions','UPDATE') and has_table_privilege(current_user,'soal.questions','DELETE') and has_table_privilege(current_user,'soal.system_settings','UPDATE')")" = "t" ]   || gagal "Seharusnya BISA tetapi gagal: generator menulis soal.questions dan soal.system_settings"
harus_ditolak soal_app "$sandi_app" "select 1 from public.users limit 1" "generator membaca public.users (data ayotka.id)"
harus_ditolak soal_app "$sandi_app" "select 1 from auth.users limit 1" "generator membaca auth.users (akun login)"
ok "Hak akses tepat: pembaca ayotka hanya membaca 3 tabel; generator hanya memegang skema soal."

# ---------- uji dengan jalur yang SAMA dengan aplikasi (lewat port tertutup 127.0.0.1, bukan di dalam container) ----------
url_reader="postgresql://ayotka_app_reader:${sandi_reader}@127.0.0.1:5432/postgres"
url_generator="postgresql://soal_app:${sandi_app}@127.0.0.1:5432/postgres?sslmode=disable"

info "Menguji alamat baru dari sisi aplikasi ayotka.id (Prisma, kueri yang sama dengan impor soal)..."
( cd "$APP_DIR" && URL_UJI="$url_reader" node -e '
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient({ datasources: { db: { url: process.env.URL_UJI } } });
(async () => {
  const paket = await p.$queryRawUnsafe("SELECT id, code, nama, jenjang, mapel, status, jumlah_soal AS \"jumlahSoal\" FROM soal.question_packages WHERE status = $1 ORDER BY code ASC", "diterbitkan");
  const soal = await p.$queryRawUnsafe("SELECT id, code, nomor_urut AS \"nomorUrut\", jenjang, mapel, elemen, sub_elemen AS \"subElemen\", kompetensi, indikator, level_kognitif AS \"levelKognitif\", tingkat_kesulitan AS \"tingkatKesulitan\", bentuk_soal AS \"bentukSoal\", stimulus_id AS \"stimulusId\", paket_id AS \"paketId\", payload FROM soal.questions WHERE paket_id = $1 ORDER BY nomor_urut ASC NULLS LAST", paket[0] ? paket[0].id : "");
  if (paket.length < 1) throw new Error("tidak ada paket berstatus diterbitkan");
  console.log("paket diterbitkan: " + paket.length + "; soal pada paket pertama: " + soal.length);
  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
' ) || gagal "Aplikasi ayotka.id tidak bisa membaca soal lewat alamat baru. Tidak ada yang diubah."
ok "Aplikasi bisa membaca paket dan soal lewat alamat baru."

if [ -d "$GENERATOR_DIR/node_modules/pg" ]; then
  info "Menguji alamat baru dari sisi generator (pustaka pg milik generator, konfigurasi SSL persis seperti kodenya)..."
  ( cd "$GENERATOR_DIR" && URL_UJI="$url_generator" node -e '
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.URL_UJI, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 10000 });
pool.query("select (select count(*) from soal.questions)::int as soal, (select count(*) from soal.users)::int as pengguna")
  .then((r) => { console.log("soal: " + r.rows[0].soal + ", pengguna generator: " + r.rows[0].pengguna); return pool.end(); })
  .catch((e) => { console.error(e.message); process.exit(1); });
' ) || gagal "Pustaka pg generator tidak bisa terhubung lewat alamat baru. Tidak ada yang diubah."
  ok "Generator (dengan kode SSL-nya) bisa terhubung lewat alamat baru."
else
  peringatan "Folder generator ($GENERATOR_DIR/node_modules/pg) tidak ditemukan - uji sisi generator dilewati. Atur GENERATOR_DIR=... bila lokasinya lain."
fi

# ---------- alihkan ayotka.id ----------
[ "$YA" -eq 1 ] || konfirmasi ALIHKAN "ayotka.id akan membaca soal dari database LOKAL mulai sekarang (reload aplikasi ~10 detik)."

url_lama=$(baca_env "$APP_ENV" SOAL_SOURCE_DATABASE_URL)
( umask 077; printf '%s\n' "$url_lama" > "$BERKAS_URL_LAMA" )
cp -p "$APP_ENV" "$APP_ENV.sebelum-soal-$(date -u +%Y%m%d-%H%M%S)"
set_env "$APP_ENV" SOAL_SOURCE_DATABASE_URL "$url_reader"
info "Memuat ulang aplikasi..."
( cd "$APP_DIR" && pm2 reload ayotka-app --update-env )

if ! tunggu "aplikasi menjawab" 90 curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:3001/login"; then
  peringatan "Aplikasi tidak menjawab setelah dialihkan - mengembalikan alamat lama."
  set_env "$APP_ENV" SOAL_SOURCE_DATABASE_URL "$url_lama"
  ( cd "$APP_DIR" && pm2 reload ayotka-app --update-env ) || true
  gagal "Dibatalkan otomatis. Cek: pm2 logs ayotka-app --lines 50"
fi
ok "ayotka.id kini membaca soal dari database lokal."

# ---------- siapkan alamat untuk generator ----------
( umask 077; printf 'DATABASE_URL="%s"\n' "$url_generator" > "$BERKAS_URL_GENERATOR" )
chmod 600 "$BERKAS_URL_GENERATOR"
date -u +%FT%TZ > "$TANDA_SOAL_DIALIHKAN"
ok "Alamat untuk generator tersimpan di $BERKAS_URL_GENERATOR (hanya root yang bisa membaca)."
petunjuk_generator
echo
info "Untuk membatalkan: sudo bash skrip/11-alihkan-soal.sh --batalkan (dan kembalikan DATABASE_URL generator)."
