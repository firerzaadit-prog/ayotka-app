#!/usr/bin/env bash
# LANGKAH 1 - menyiapkan database Postgres dan mesin login (GoTrue) di server ini.
# Aman diulang. TIDAK menyentuh aplikasi yang sedang berjalan dan TIDAK memindahkan data apa pun.
# Jalankan:  sudo bash skrip/01-siapkan.sh
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
harus_root
cd "$PAKET_DIR"

command -v openssl >/dev/null || gagal "openssl tidak ada (apt install openssl)."
docker info >/dev/null 2>&1 || gagal "Docker tidak bisa dipakai."
docker compose version >/dev/null 2>&1 || gagal "Plugin 'docker compose' tidak ada."
[ ! -f "$TANDA_SELESAI" ] || gagal "Pemindahan sudah selesai (ada $TANDA_SELESAI). Skrip ini hanya untuk persiapan awal."

# ---------- rahasia ----------
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

# JWT HS256 tanpa pustaka tambahan. Argumen: rahasia peran. Berlaku 10 tahun (sama seperti kunci anon/service Supabase).
buat_jwt() {
  local header payload sig iat exp
  iat=$(date +%s)
  exp=$((iat + 315360000))
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$2" "$iat" "$exp" | b64url)
  sig=$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -hmac "$1" -binary | b64url)
  printf '%s.%s.%s' "$header" "$payload" "$sig"
}

if [ -f "$ENV_PAKET" ]; then
  ok "Rahasia sudah ada ($ENV_PAKET) - dipakai ulang, TIDAK dibuat ulang."
else
  info "Membuat rahasia baru (kata sandi database, kunci JWT, kunci anon & service)..."
  umask 077
  pw=$(openssl rand -hex 24)
  jwt_secret=$(openssl rand -hex 48)
  anon=$(buat_jwt "$jwt_secret" anon)
  service=$(buat_jwt "$jwt_secret" service_role)
  cat > "$ENV_PAKET" <<EOF
# Dibuat otomatis oleh skrip/01-siapkan.sh pada $(date -u +%FT%TZ). RAHASIA - jangan dibagikan, jangan di-commit.
# Mengganti JWT_SECRET membuat ANON_KEY/SERVICE_ROLE_KEY dan semua sesi login tidak berlaku lagi.
POSTGRES_PASSWORD="$pw"
JWT_SECRET="$jwt_secret"
ANON_KEY="$anon"
SERVICE_ROLE_KEY="$service"
JWT_EXPIRY="3600"
SITE_URL="$URL_PUBLIK"
API_EXTERNAL_URL="$URL_PUBLIK/supabase/auth/v1"
ADDITIONAL_REDIRECT_URLS="$URL_PUBLIK/**"
DISABLE_SIGNUP="true"
EOF
  chmod 600 "$ENV_PAKET"
  ok "Rahasia dibuat dan disimpan di $ENV_PAKET (izin 600, hanya root)."
fi

# ---------- folder ----------
mkdir -p "$PAKET_DIR/volumes/db/data" "$PAKET_DIR/backup"
chmod 700 "$PAKET_DIR/backup"

# ---------- jalankan ----------
info "Mengunduh image (pertama kali beberapa menit, ~1 GB; tanpa tampilan kemajuan)..."
docker compose pull --quiet
info "Menjalankan database dan mesin login..."
docker compose up -d --quiet-pull

# Galat container ditampilkan ringkas (satu baris dipotong 400 karakter): log GoTrue bisa memuat SQL panjang berulang-ulang.
cuplik_log() { docker compose logs --no-log-prefix --tail="${2:-6}" "$1" 2>&1 | cut -c1-400; }

tunggu "database siap" 180 wadah_sehat "$DB_CONTAINER" || { cuplik_log db 15; gagal "Database tidak sehat dalam 3 menit."; }
ok "Database siap."
tunggu "mesin login siap" 180 curl -fsS http://127.0.0.1:9999/health || { cuplik_log auth 6; gagal "Mesin login tidak sehat dalam 3 menit. Lihat galat terakhir di atas."; }
ok "Mesin login siap (GoTrue menjawab /health)."

# GoTrue membuat tabel auth.* sendiri saat pertama berjalan.
jumlah_migrasi=$(psql_lokal -Atc "select count(*) from auth.schema_migrations" 2>/dev/null || echo 0)
[ "${jumlah_migrasi:-0}" -gt 0 ] || gagal "Tabel auth belum termigrasi (cek: docker compose logs auth)."
ok "Skema login siap ($jumlah_migrasi migrasi GoTrue terpasang)."

echo
info "Port yang terbuka (harus 127.0.0.1 saja, TIDAK 0.0.0.0):"
ss -ltn | awk 'NR==1 || $4 ~ /:(5432|9999)$/' | sed 's/^/    /'
if ss -ltn | awk '$4 ~ /:(5432|9999)$/ {print $4}' | grep -vqE '^127\.0\.0\.1:'; then
  gagal "Ada port database/login yang terbuka ke luar! Hentikan: docker compose down"
fi
ok "Database dan login hanya bisa dijangkau dari server ini."

docker compose ps
echo
ok "Langkah 1 selesai. Berikutnya: sudo bash skrip/02-cadangkan-supabase.sh"
