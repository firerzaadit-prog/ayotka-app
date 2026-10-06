#!/usr/bin/env bash
# LANGKAH 5 - PEMINDAHAN: mengalihkan ayotka.id ke database + login lokal.
#
# Yang dilakukan, berurutan (berhenti di langkah pertama yang gagal, dan .env lama tersimpan untuk jalan mundur):
#   1. periksa semua prasyarat (login lokal lulus uji, nginx sudah meneruskan /supabase dan /media, kode baru sudah di-deploy)
#   2. cadangkan .env aplikasi, jeda cron
#   3. ambil data TERBARU dari Supabase lalu pulihkan ke database lokal (ulang langkah 2+3)
#   4. kunci kunci enkripsi pengaturan (supaya kunci API tersimpan tetap terbaca)
#   5. ubah .env aplikasi, bangun ulang, mulai ulang
#   6. cek aplikasi hidup, pasang cadangan harian
#
# Jalankan:  sudo bash skrip/05-pindah.sh
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
harus_root
cd "$PAKET_DIR"
trap lanjut_cron EXIT

[ ! -f "$TANDA_SELESAI" ] || gagal "Pemindahan sudah pernah selesai ($TANDA_SELESAI). Untuk membatalkan: skrip/06-batalkan.sh"

# ---------- 1. prasyarat ----------
info "Memeriksa prasyarat..."
wadah_sehat "$DB_CONTAINER" || gagal "Database lokal tidak sehat."
wadah_sehat "$AUTH_CONTAINER" || gagal "Mesin login tidak sehat."
[ -f "$APP_DIR/lib/storage/media-lokal.ts" ] || gagal "Kode baru belum ter-deploy di $APP_DIR (penyimpanan lokal). Push kode dulu dan tunggu deploy GitHub selesai."
if grep -q 'from("app_settings")' "$APP_DIR/proxy.ts"; then gagal "proxy.ts di server masih memakai REST Supabase (kode lama). Deploy kode terbaru dulu."; fi
[ -s "$PAKET_DIR/backup/terbaru/public.dump" ] || peringatan "Belum ada cadangan sebelumnya; cadangan baru dibuat di langkah 3 nanti."

info "Uji login lokal (langsung)..."
node "$PAKET_DIR/skrip/04-uji-gotrue.mjs" >/dev/null || { node "$PAKET_DIR/skrip/04-uji-gotrue.mjs" || true; gagal "Uji GoTrue lokal gagal."; }
ok "Uji GoTrue lokal lulus."

info "Uji login lewat alamat publik ($URL_PUBLIK/supabase/auth/v1, harus sudah diteruskan nginx)..."
curl -fsS --max-time 20 "$URL_PUBLIK/supabase/auth/v1/health" >/dev/null || gagal "nginx belum meneruskan /supabase/auth/v1/ ke GoTrue. Pasang snippet nginx dulu (README, langkah nginx)."
node "$PAKET_DIR/skrip/04-uji-gotrue.mjs" --publik >/dev/null || { node "$PAKET_DIR/skrip/04-uji-gotrue.mjs" --publik || true; gagal "Uji GoTrue lewat alamat publik gagal."; }
ok "Uji GoTrue lewat nginx lulus."

info "Uji penyajian gambar lewat nginx ($URL_PUBLIK/media/soal-media/)..."
mkdir -p "$MEDIA_DIR_DEFAULT"
chmod 755 "$(dirname "$MEDIA_DIR_DEFAULT")" "$MEDIA_DIR_DEFAULT"
uji_png="$MEDIA_DIR_DEFAULT/_uji-pindah.png"
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' | base64 -d > "$uji_png"
chmod 644 "$uji_png"
tipe=$(curl -fsS --max-time 20 -o /dev/null -w '%{content_type}' "$URL_PUBLIK/media/soal-media/_uji-pindah.png" || true)
rm -f "$uji_png"
[ "$tipe" = "image/png" ] || gagal "nginx belum menyajikan /media/soal-media/ (tipe terbaca: '${tipe:-kosong}'). Pasang snippet nginx dulu."
ok "Gambar dilayani nginx."

# ---------- konfirmasi ----------
konfirmasi PINDAH "Ini akan: menjeda cron; menimpa database LOKAL dengan data terbaru dari Supabase; mengalihkan ayotka.id ke database + login lokal; membangun ulang dan memulai ulang aplikasi (+-5 menit; situs sebentar tidak stabil). Setelah ini data baru hanya tersimpan di server ini."

# ---------- 2. cadangkan .env, jeda cron ----------
cadangan_env="$APP_ENV.sebelum-pindah-$(date -u +%Y%m%d-%H%M%S)"
cp -a "$APP_ENV" "$cadangan_env"
printf '%s\n' "$cadangan_env" > "$PAKET_DIR/.env-sebelum-pindah"
ok ".env aplikasi dicadangkan: $cadangan_env"
jeda_cron

# ---------- 3. data terbaru ----------
info "Mengambil data terbaru dari Supabase..."
bash "$PAKET_DIR/skrip/02-cadangkan-supabase.sh"
bash "$PAKET_DIR/skrip/03-pulihkan.sh" --ya

# ---------- 4. kunci enkripsi ----------
info "Memeriksa dan mengunci kunci enkripsi pengaturan..."
set +e
node "$PAKET_DIR/skrip/kunci-enkripsi.mjs" --kunci
kode_kunci=$?
set -e
case "$kode_kunci" in
  0) ok "Kunci enkripsi aman." ;;
  3) peringatan "Sebagian kunci API tersimpan sudah tidak terbaca SEBELUM pindah (bukan akibat pemindahan). Isi ulang di Admin Pusat > Pengaturan setelah selesai." ;;
  *) gagal "Pemeriksaan kunci enkripsi gagal (kode $kode_kunci). .env lama aman di $cadangan_env." ;;
esac

# ---------- 5. alihkan aplikasi ----------
pw=$(baca_env "$ENV_PAKET" POSTGRES_PASSWORD)
[ -n "$pw" ] || gagal "POSTGRES_PASSWORD tidak terbaca dari $ENV_PAKET"
info "Mengubah .env aplikasi..."
set_env "$APP_ENV" DATABASE_URL "postgresql://postgres:${pw}@127.0.0.1:5432/postgres?schema=public&connection_limit=10"
set_env "$APP_ENV" DIRECT_URL "postgresql://postgres:${pw}@127.0.0.1:5432/postgres?schema=public"
set_env "$APP_ENV" NEXT_PUBLIC_SUPABASE_URL "$URL_PUBLIK/supabase"
set_env "$APP_ENV" NEXT_PUBLIC_SUPABASE_ANON_KEY "$(baca_env "$ENV_PAKET" ANON_KEY)"
set_env "$APP_ENV" SUPABASE_SERVICE_ROLE_KEY "$(baca_env "$ENV_PAKET" SERVICE_ROLE_KEY)"
set_env "$APP_ENV" STORAGE_DRIVER "local"
set_env "$APP_ENV" MEDIA_DIR "$MEDIA_DIR_DEFAULT"
set_env "$APP_ENV" MEDIA_PUBLIC_BASE_URL "$URL_PUBLIK/media/soal-media"
ok ".env aplikasi diubah (SOAL_SOURCE_DATABASE_URL sengaja tetap ke Supabase: data generator belum dipindah)."

kembalikan_env() {
  cat "$cadangan_env" > "$APP_ENV"
  peringatan ".env aplikasi dikembalikan ke keadaan sebelum pindah ($cadangan_env)."
}

info "Membangun ulang aplikasi (3-6 menit; NEXT_PUBLIC_* ditanam saat build)..."
if ! ( cd "$APP_DIR" && npm run build ); then
  kembalikan_env
  gagal "Build GAGAL. Aplikasi yang berjalan belum disentuh. Kirim 30 baris terakhir keluaran di atas."
fi
( cd "$APP_DIR" && pm2 reload ayotka-app --update-env )
ok "Aplikasi dimulai ulang."

# ---------- 6. cek hidup ----------
info "Memeriksa aplikasi..."
hidup=0
for _ in $(seq 1 30); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$URL_PUBLIK/login" || true)" = "200" ]; then hidup=1; break; fi
  sleep 3
done
[ "$hidup" -eq 1 ] || { kembalikan_env; gagal "Aplikasi tidak menjawab /login. .env dikembalikan; jalankan: cd $APP_DIR && npm run build && pm2 reload ayotka-app"; }
ok "/login menjawab 200."

kode_login=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 -X POST -H 'Content-Type: application/json' \
  -d '{"emailOrNisn":"tidak.ada@example.com","password":"salah-salah"}' "$URL_PUBLIK/api/auth/login" || true)
if [ "$kode_login" = "401" ]; then ok "Login palsu dijawab 401 'password salah' (login lokal bekerja)."; else
  peringatan "Login palsu dijawab $kode_login (diharapkan 401). Periksa: docker compose logs auth --tail 50  dan  pm2 logs ayotka-app --lines 50"
fi

touch "$TANDA_SELESAI"

# cadangan harian database lokal
cat > /etc/cron.d/ayotka-backup <<EOF
# Cadangan harian database AyoTKA (pg_dump skema public + auth), disimpan 14 hari di /var/backups/ayotka.
# 19:30 UTC = 02:30 WIB.
30 19 * * * root $PAKET_DIR/skrip/backup-harian.sh >> /var/log/ayotka-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/ayotka-backup
ok "Cadangan harian dipasang (02:30 WIB, /var/backups/ayotka)."

echo
ok "PEMINDAHAN SELESAI. Cron dilanjutkan otomatis."
echo "Berikutnya (uji semua peran dengan akun sementara yang dihapus otomatis):"
echo "    sudo node $PAKET_DIR/skrip/07-verifikasi-peran.mjs"
