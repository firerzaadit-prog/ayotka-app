#!/usr/bin/env bash
# JALAN MUNDUR - mengembalikan aplikasi ke Supabase Cloud (memakai .env yang dicadangkan langkah 5).
#
# PERHATIAN:
#  - Hanya berguna kalau Supabase Auth sudah berfungsi lagi (pembatasan HTTP 402 sudah dicabut). Cek dulu:
#      curl -s https://pyqeqhvouysotijhkhdg.supabase.co/auth/v1/health -H "apikey: <anon key>"   (harus 200)
#  - Data yang dibuat SETELAH pemindahan (siswa baru, percobaan ujian, dsb.) hanya ada di database lokal dan TIDAK ikut
#    kembali ke Supabase. Cadangan database lokal ada di /var/backups/ayotka.
#
# Jalankan:  sudo bash skrip/06-batalkan.sh
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
harus_root
cd "$PAKET_DIR"

[ -f "$PAKET_DIR/.env-sebelum-pindah" ] || gagal "Tidak ada catatan cadangan .env (skrip/05 belum pernah dijalankan sampai ke pengubahan .env)."
cadangan=$(cat "$PAKET_DIR/.env-sebelum-pindah")
[ -f "$cadangan" ] || gagal "Berkas cadangan $cadangan tidak ditemukan."

konfirmasi BATALKAN "Aplikasi akan dikembalikan ke Supabase Cloud memakai $cadangan. Data baru yang hanya ada di database lokal TIDAK ikut kembali."

# Simpan juga keadaan .env sekarang, kalau-kalau perlu pindah lagi.
cp -a "$APP_ENV" "$APP_ENV.sesudah-pindah-$(date -u +%Y%m%d-%H%M%S)"
# Cadangan database lokal terakhir sebelum ditinggalkan.
mkdir -p /var/backups/ayotka
berkas="/var/backups/ayotka/sebelum-batal-$(date -u +%Y%m%d-%H%M%S).dump"
if wadah_sehat "$DB_CONTAINER"; then
  docker exec "$DB_CONTAINER" pg_dump -h localhost -U postgres -Fc -n public -n auth postgres > "$berkas" && chmod 600 "$berkas" && ok "Database lokal dicadangkan: $berkas"
fi

cat "$cadangan" > "$APP_ENV"
ok ".env aplikasi dikembalikan."

info "Membangun ulang aplikasi..."
( cd "$APP_DIR" && npm run build ) || gagal "Build gagal. .env sudah dikembalikan; jalankan manual: cd $APP_DIR && npm run build && pm2 reload ayotka-app"
( cd "$APP_DIR" && pm2 reload ayotka-app --update-env )
rm -f "$TANDA_SELESAI" "$PAKET_DIR/.env-sebelum-pindah"
ok "Aplikasi kembali memakai Supabase Cloud. Database dan login lokal tetap berjalan (tidak dipakai); hentikan dengan: docker compose down"
