#!/usr/bin/env bash
# Cadangan harian database lokal (skema public + auth). Dipasang otomatis oleh skrip/05-pindah.sh di
# /etc/cron.d/ayotka-backup (02:30 WIB). Menyimpan 14 hari terakhir di /var/backups/ayotka.
#
# Cadangan di server yang SAMA tidak melindungi dari server rusak/hilang: salin berkala ke tempat lain, mis. dari
# PowerShell di komputermu:   scp "firerza@187.77.115.29:/var/backups/ayotka/db-*.dump" .
set -euo pipefail
TUJUAN="/var/backups/ayotka"
SIMPAN_HARI=14
WADAH="ayotka-db"

mkdir -p "$TUJUAN"
chmod 700 "$TUJUAN"
berkas="$TUJUAN/db-$(date -u +%Y%m%d-%H%M%S).dump"
sementara="$berkas.tmp"

docker exec "$WADAH" pg_dump -h localhost -U postgres -Fc -n public -n auth postgres > "$sementara"
[ -s "$sementara" ] || { echo "$(date -u +%FT%TZ) GAGAL: cadangan kosong" >&2; rm -f "$sementara"; exit 1; }
docker exec -i "$WADAH" pg_restore --list < "$sementara" >/dev/null || { echo "$(date -u +%FT%TZ) GAGAL: cadangan tidak terbaca" >&2; rm -f "$sementara"; exit 1; }
mv "$sementara" "$berkas"
chmod 600 "$berkas"
find "$TUJUAN" -maxdepth 1 -name 'db-*.dump' -type f -mtime +"$SIMPAN_HARI" -delete

echo "$(date -u +%FT%TZ) OK $(basename "$berkas") $(du -h "$berkas" | cut -f1); tersimpan: $(find "$TUJUAN" -maxdepth 1 -name 'db-*.dump' | wc -l) berkas"
