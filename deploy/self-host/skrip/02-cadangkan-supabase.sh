#!/usr/bin/env bash
# LANGKAH 2 - mencadangkan data dari Supabase Cloud ke server ini. HANYA MEMBACA dari Supabase.
# Isi cadangan: skema public (seluruh data ayotka.id) + akun login (auth.users, auth.identities) + hitungan baris.
# Opsi --dengan-soal: sekaligus mencadangkan skema soal (data generator soal.ayotka.id, +-600 MB), sebagai asuransi.
# Jalankan:  sudo bash skrip/02-cadangkan-supabase.sh [--dengan-soal]
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
harus_root
cd "$PAKET_DIR"

DENGAN_SOAL=0
[ "${1:-}" = "--dengan-soal" ] && DENGAN_SOAL=1

wadah_sehat "$DB_CONTAINER" || gagal "Database lokal belum berjalan. Jalankan dulu: sudo bash skrip/01-siapkan.sh"
muat_sumber || exit 1

info "Menguji sambungan ke Supabase..."
jumlah_akun=$(psql_sumber -Atc "select count(*) from auth.users") || gagal "Tidak bisa terhubung ke database Supabase (cek DIRECT_URL di $APP_ENV)."
ok "Tersambung. Akun login di Supabase: $jumlah_akun"

tujuan="$PAKET_DIR/backup/$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$tujuan"
chmod 700 "$tujuan"

dump() { # nama_berkas argumen_pg_dump...
  local berkas="$1"
  shift
  docker exec -e SRC_URL "$DB_CONTAINER" sh -c 'pg_dump "$SRC_URL" "$@"' sh "$@" > "$tujuan/$berkas"
  [ -s "$tujuan/$berkas" ] || gagal "Cadangan $berkas kosong."
  docker exec -i "$DB_CONTAINER" pg_restore --list < "$tujuan/$berkas" >/dev/null || gagal "Cadangan $berkas tidak terbaca (rusak)."
  ok "$berkas ($(du -h "$tujuan/$berkas" | cut -f1)) - terbaca utuh"
}

info "Mencadangkan skema public (data ayotka.id)..."
dump public.dump -Fc -n public --no-owner --no-privileges --no-publication --no-subscriptions

info "Mencadangkan akun login (auth.users, auth.identities)..."
dump auth-akun.dump -Fc --data-only -t auth.users -t auth.identities

if [ "$DENGAN_SOAL" -eq 1 ]; then
  info "Mencadangkan skema soal (data generator; agak besar, beberapa menit)..."
  dump soal.dump -Fc -n soal --no-owner --no-privileges --no-publication --no-subscriptions
fi

info "Menghitung baris tiap tabel di Supabase (untuk pembanding setelah dipulihkan)..."
hitung_baris sumber > "$tujuan/hitung-sumber.txt"
ok "$(wc -l < "$tujuan/hitung-sumber.txt") baris hitungan tersimpan (hitung-sumber.txt)"

( cd "$tujuan" && sha256sum ./*.dump > SHA256SUMS )
ln -sfn "$tujuan" "$PAKET_DIR/backup/terbaru"
echo
ok "Cadangan tersimpan di: $tujuan"
info "Saran: salin ke komputermu sebagai arsip luar server, mis. dari PowerShell di komputermu:"
echo "    scp -r firerza@187.77.115.29:$tujuan ."
echo "    (jika ditolak izin: sudo chown -R firerza $tujuan dulu di server)"
echo
ok "Langkah 2 selesai. Berikutnya: sudo bash skrip/03-pulihkan.sh"
