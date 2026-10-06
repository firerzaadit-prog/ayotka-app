#!/usr/bin/env bash
# Fungsi bersama skrip paket self-host. Di-source oleh skrip lain (bukan dijalankan sendiri).
# shellcheck shell=bash

PAKET_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${APP_DIR:-/var/www/ayotka-app}"
APP_ENV="${APP_ENV:-$APP_DIR/.env}"
ENV_PAKET="$PAKET_DIR/.env"
DB_CONTAINER="ayotka-db"
AUTH_CONTAINER="ayotka-auth"
TANDA_SELESAI="$PAKET_DIR/.pindah-selesai"
URL_PUBLIK="${URL_PUBLIK:-https://ayotka.id}"
MEDIA_DIR_DEFAULT="/var/www/ayotka-media/soal-media"

info() { printf '[ .. ] %s\n' "$*"; }
ok() { printf '[ OK ] %s\n' "$*"; }
peringatan() { printf '[ !! ] %s\n' "$*" >&2; }
gagal() { printf '[GAGAL] %s\n' "$*" >&2; exit 1; }

harus_root() {
  [ "$(id -u)" -eq 0 ] || gagal "Jalankan dengan sudo, contoh: sudo bash $0"
}

# Baca satu variabel dari berkas .env (tanpa meng-eval isinya); tanda kutip pembungkus dibuang.
baca_env() { # berkas kunci
  local nilai
  nilai=$(grep -m1 -E "^[[:space:]]*$2[[:space:]]*=" "$1" 2>/dev/null | sed -E "s/^[[:space:]]*$2[[:space:]]*=[[:space:]]*//; s/[[:space:]]+\$//" || true)
  nilai="${nilai%\"}"; nilai="${nilai#\"}"; nilai="${nilai%\'}"; nilai="${nilai#\'}"
  printf '%s' "$nilai"
}

# Ganti (atau tambahkan) satu variabel di berkas .env. Nilai ditulis dengan tanda kutip ganda.
# Nilai tidak boleh memuat backslash atau tanda kutip ganda (semua nilai paket ini: URL, heksadesimal, base64url).
set_env() { # berkas kunci nilai
  local berkas="$1" kunci="$2" nilai="$3" sementara
  case "$nilai" in *\\*|*\"*) gagal "Nilai untuk $kunci memuat karakter terlarang." ;; esac
  sementara=$(mktemp)
  awk -v k="$kunci" -v v="$nilai" '
    BEGIN { ditulis = 0 }
    {
      if ($0 ~ ("^[[:space:]]*" k "[[:space:]]*=")) {
        if (!ditulis) { print k "=\"" v "\""; ditulis = 1 }
        next
      }
      print $0
    }
    END { if (!ditulis) print k "=\"" v "\"" }
  ' "$berkas" > "$sementara"
  cat "$sementara" > "$berkas"   # cat (bukan mv) agar pemilik & izin berkas tetap
  rm -f "$sementara"
}

# psql ke database lokal (di dalam container, lewat TCP localhost; kata sandi dari PGPASSWORD di container).
# Contoh: psql_lokal -Atc "select 1"
psql_lokal() {
  docker exec -i "$DB_CONTAINER" psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

# Sama, tetapi sebagai supabase_admin (superuser image): dipakai untuk menulis ke skema auth milik GoTrue.
psql_admin() {
  docker exec -i "$DB_CONTAINER" psql -h localhost -U supabase_admin -d postgres -v ON_ERROR_STOP=1 "$@"
}

# psql ke database sumber (Supabase Cloud) dari dalam container lokal; alamatnya lewat variabel lingkungan SRC_URL
# supaya kata sandi tidak muncul di daftar proses.
psql_sumber() {
  docker exec -i -e SRC_URL "$DB_CONTAINER" sh -c 'psql "$SRC_URL" -v ON_ERROR_STOP=1 "$@"' sh "$@"
}

# Muat alamat database sumber dari .env aplikasi (koneksi sesi pooler, port 5432: dibutuhkan pg_dump/psql).
muat_sumber() { # [berkas_env]  (bawaan: .env aplikasi)
  local berkas="${1:-$APP_ENV}"
  [ -r "$berkas" ] || { peringatan "Tidak bisa membaca $berkas (jalankan dengan sudo; atau atur APP_ENV=...)."; return 1; }
  local url
  url=$(baca_env "$berkas" DIRECT_URL)
  [ -n "$url" ] || url=$(baca_env "$berkas" DATABASE_URL)
  [ -n "$url" ] || { peringatan "DIRECT_URL/DATABASE_URL tidak ada di $berkas."; return 1; }
  # Query string seperti ?pgbouncer=true ditolak psql/pg_dump; buang.
  SRC_URL="${url%%\?*}"
  # Pengaman: kalau .env aplikasi sudah dialihkan ke database LOKAL, "sumber" bukan Supabase lagi. Mencadangkan/memulihkan
  # dari sini akan menimpa database lokal dengan dirinya sendiri.
  case "$SRC_URL" in
    *@127.0.0.1[:/]*|*@localhost[:/]*|*@db[:/]*)
      peringatan "DIRECT_URL di $APP_ENV sudah mengarah ke database lokal - pemindahan sudah terjadi. Skrip ini hanya untuk sebelum pindah."
      return 1 ;;
  esac
  export SRC_URL
}

tunggu() { # deskripsi detik perintah...
  local deskripsi="$1" batas="$2" i=0
  shift 2
  info "Menunggu $deskripsi (maks $batas dtk)..."
  until "$@" >/dev/null 2>&1; do
    i=$((i + 1))
    [ "$i" -lt "$batas" ] || return 1
    sleep 1
  done
}

wadah_sehat() { [ "$(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null || true)" = "healthy" ]; }

# Tampilkan baris ringkas hitungan baris per tabel (public.* dan auth.users/identities) dari sebuah database.
# Argumen: "sumber" atau "lokal"; keluaran: "nama|jumlah" per baris, terurut.
hitung_baris() {
  local sisi="$1" daftar sql="" t
  if [ "$sisi" = "sumber" ]; then
    daftar=$(psql_sumber -Atc "select tablename from pg_tables where schemaname='public' order by 1")
  else
    daftar=$(psql_lokal -Atc "select tablename from pg_tables where schemaname='public' order by 1")
  fi
  for t in $daftar; do
    sql+="select 'public.$t' as t, count(*) as n from public.\"$t\" union all "
  done
  sql+="select 'auth.users', count(*) from auth.users union all select 'auth.identities', count(*) from auth.identities order by 1"
  if [ "$sisi" = "sumber" ]; then
    psql_sumber -At -F'|' -c "$sql"
  else
    psql_lokal -At -F'|' -c "$sql"
  fi
}

# Jeda cron AyoTKA selama pemindahan (supaya tidak ada tulis ke database di tengah pemulihan); pastikan dipulihkan.
CRON_FILE="/etc/cron.d/ayotka"
CRON_DIJEDA="/etc/cron.d.ayotka.dijeda"
jeda_cron() {
  if [ -f "$CRON_FILE" ]; then
    mv "$CRON_FILE" "$CRON_DIJEDA"
    info "Cron AyoTKA dijeda sementara."
  fi
}
lanjut_cron() {
  if [ -f "$CRON_DIJEDA" ] && [ ! -f "$CRON_FILE" ]; then
    mv "$CRON_DIJEDA" "$CRON_FILE"
    ok "Cron AyoTKA dilanjutkan."
  fi
}

konfirmasi() { # kata_yang_harus_diketik pesan
  local jawaban
  printf '%s\n> Ketik %s lalu Enter untuk melanjutkan (selain itu = batal): ' "$2" "$1"
  read -r jawaban
  [ "$jawaban" = "$1" ] || gagal "Dibatalkan. Tidak ada yang diubah."
}
