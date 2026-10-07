#!/usr/bin/env bash
# Cadangan harian database lokal (skema public + auth, dan skema soal bila sudah dipindah ke sini - Langkah 10/11).
# Dipasang otomatis oleh skrip/05-pindah.sh di /etc/cron.d/ayotka-backup (02:30 WIB). Menyimpan 14 hari terakhir di /var/backups/ayotka.
#
# Cadangan di server yang SAMA tidak melindungi dari server rusak/hilang: salin berkala ke tempat lain, mis. dari
# PowerShell di komputermu:   scp "firerza@187.77.115.29:/var/backups/ayotka/db-*.dump" .
# (atau jalankan deploy/self-host/tarik-cadangan.ps1). Folder dan berkasnya tetap tertutup untuk orang lain (700/600)
# tetapi DIMILIKI pemilik folder aplikasi (firerza) supaya scp tanpa sudo bisa membacanya.
set -euo pipefail
TUJUAN="/var/backups/ayotka"
SIMPAN_HARI=14
WADAH="ayotka-db"
PEMILIK=$(stat -c %U /var/www/ayotka-app 2>/dev/null || echo root)
id -u "$PEMILIK" >/dev/null 2>&1 || PEMILIK=root

mkdir -p "$TUJUAN"
chmod 700 "$TUJUAN"
berkas="$TUJUAN/db-$(date -u +%Y%m%d-%H%M%S).dump"
sementara="$berkas.tmp"

# Dijalankan sebagai supabase_admin (superuser): tabel skema soal punya RLS dan dimiliki soal_app, jadi role biasa
# menghasilkan cadangan kosong atau galat. Skema soal baru ikut dicadangkan setelah ada di database ini.
SKEMA="-n public -n auth"
if [ "$(docker exec "$WADAH" psql -h localhost -U supabase_admin -d postgres -Atc "select 1 from pg_namespace where nspname='soal'" 2>/dev/null || true)" = "1" ]; then
  SKEMA="$SKEMA -n soal"
fi
# shellcheck disable=SC2086
docker exec "$WADAH" pg_dump -h localhost -U supabase_admin -Fc $SKEMA postgres > "$sementara"
[ -s "$sementara" ] || { echo "$(date -u +%FT%TZ) GAGAL: cadangan kosong" >&2; rm -f "$sementara"; exit 1; }
docker exec -i "$WADAH" pg_restore --list < "$sementara" >/dev/null || { echo "$(date -u +%FT%TZ) GAGAL: cadangan tidak terbaca" >&2; rm -f "$sementara"; exit 1; }
mv "$sementara" "$berkas"
chmod 600 "$berkas"
find "$TUJUAN" -maxdepth 1 -exec chown "$PEMILIK" {} +
find "$TUJUAN" -maxdepth 1 -name 'db-*.dump' -type f -mtime +"$SIMPAN_HARI" -delete

echo "$(date -u +%FT%TZ) OK $(basename "$berkas") $(du -h "$berkas" | cut -f1); tersimpan: $(find "$TUJUAN" -maxdepth 1 -name 'db-*.dump' | wc -l) berkas"
