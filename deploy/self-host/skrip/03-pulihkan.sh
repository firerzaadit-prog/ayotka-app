#!/usr/bin/env bash
# LANGKAH 3 - memulihkan cadangan ke database lokal: skema public + akun login (hash kata sandi ikut, jadi tidak ada
# yang perlu reset). Supabase TIDAK diubah. Aman diulang SEBELUM pemindahan selesai (menimpa isi database lokal).
# Sesudah langkah 5 selesai, skrip ini menolak jalan (supaya data baru di server ini tidak tertimpa).
#
# Jalankan:  sudo bash skrip/03-pulihkan.sh [--dari <folder-cadangan>] [--ya]
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
harus_root
cd "$PAKET_DIR"

DARI="$PAKET_DIR/backup/terbaru"
YA=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dari) DARI="$2"; shift ;;
    --ya) YA=1 ;;
    *) gagal "Argumen tidak dikenal: $1" ;;
  esac
  shift
done

[ ! -f "$TANDA_SELESAI" ] || gagal "Pemindahan sudah selesai - skrip ini menimpa isi database lokal dan TIDAK boleh dijalankan lagi."
wadah_sehat "$DB_CONTAINER" || gagal "Database lokal belum berjalan (jalankan skrip/01-siapkan.sh)."
wadah_sehat "$AUTH_CONTAINER" || gagal "Mesin login belum sehat (docker compose logs auth)."
DARI="$(cd "$DARI" 2>/dev/null && pwd)" || gagal "Folder cadangan tidak ditemukan. Jalankan skrip/02-cadangkan-supabase.sh dulu."
for b in public.dump SHA256SUMS hitung-sumber.txt; do [ -s "$DARI/$b" ] || gagal "Berkas $b tidak ada di $DARI"; done
muat_sumber || exit 1

info "Memeriksa keutuhan berkas cadangan..."
( cd "$DARI" && sha256sum -c SHA256SUMS >/dev/null ) || gagal "Checksum cadangan tidak cocok - berkas rusak."
ok "Cadangan utuh: $DARI"

if [ "$YA" -ne 1 ]; then
  konfirmasi PULIHKAN "Isi skema public dan akun login di database LOKAL akan diganti dengan cadangan di atas. Supabase tidak disentuh."
fi

# ---------- 1. skema public ----------
info "Mengosongkan skema public lokal dan memulihkan cadangan..."
psql_lokal -c "drop schema if exists public cascade" -c "create schema public" \
  -c "grant all on schema public to postgres" -c "grant usage on schema public to anon, authenticated, service_role" >/dev/null
log="$DARI/pulihkan-public.log"
docker exec -i "$DB_CONTAINER" pg_restore -h localhost -U postgres -d postgres --no-owner --no-privileges < "$DARI/public.dump" 2> "$log" || true
galat=$(grep -c '^pg_restore: error:' "$log" || true)
jinak=$(grep -c 'schema "public" already exists' "$log" || true)
if [ "$galat" -gt "$jinak" ]; then
  peringatan "Ada galat saat memulihkan (selain 'schema public sudah ada'). Cuplikan dari $log:"
  grep -A2 '^pg_restore: error:' "$log" | grep -v 'schema "public" already exists' | head -20 >&2
  gagal "Pemulihan skema public tidak bersih."
fi
ok "Skema public dipulihkan."

# ---------- 2. akun login ----------
# Hanya kolom yang ada di KEDUA sisi (dan bukan kolom turunan/generated) yang disalin, supaya perbedaan versi skema
# GoTrue antara Supabase Cloud dan image lokal tidak menggagalkan penyalinan.
kolom_bersama() { # tabel
  local t="$1" kueri a b
  kueri="select column_name from information_schema.columns where table_schema='auth' and table_name='$t' and is_generated='NEVER' order by column_name"
  a=$(psql_lokal -Atc "$kueri")
  b=$(psql_sumber -Atc "$kueri")
  comm -12 <(printf '%s\n' "$a" | sort) <(printf '%s\n' "$b" | sort) | sed 's/.*/"&"/' | paste -sd,
}

info "Menyalin akun login dari Supabase (kata sandi dalam bentuk hash, tidak pernah terbaca)..."
psql_admin -c "truncate auth.users cascade" >/dev/null
for tabel in users identities; do
  cols=$(kolom_bersama "$tabel")
  [ -n "$cols" ] || gagal "Tidak ada kolom bersama untuk auth.$tabel."
  docker exec -e SRC_URL "$DB_CONTAINER" sh -c 'psql "$SRC_URL" -v ON_ERROR_STOP=1 -c "$1"' sh "\\copy (select $cols from auth.$tabel) to stdout" \
    | psql_admin -c "\\copy auth.$tabel($cols) from stdin"
  ok "auth.$tabel disalin ($(psql_lokal -Atc "select count(*) from auth.$tabel") baris)"
done

# ---------- 3. verifikasi ----------
info "Membandingkan jumlah baris setiap tabel dengan Supabase..."
hitung_baris lokal > "$DARI/hitung-lokal.txt"
hitung_baris sumber > "$DARI/hitung-sumber-sekarang.txt"
if diff <(sort "$DARI/hitung-lokal.txt") <(sort "$DARI/hitung-sumber-sekarang.txt") > "$DARI/selisih.txt"; then
  ok "SEMUA tabel sama persis dengan Supabase ($(wc -l < "$DARI/hitung-lokal.txt") tabel dibandingkan)."
else
  peringatan "Ada tabel yang jumlah barisnya berbeda dari Supabase (< = lokal, > = Supabase):"
  cat "$DARI/selisih.txt" >&2
  if diff <(sort "$DARI/hitung-lokal.txt") <(sort "$DARI/hitung-sumber.txt") >/dev/null; then
    gagal "Data lokal sama dengan cadangan, tetapi Supabase BERUBAH sejak dicadangkan. Jalankan ulang skrip/02 lalu skrip/03."
  fi
  gagal "Pemulihan tidak sama dengan cadangan - jangan lanjut. Kirim isi $DARI/selisih.txt dan $log."
fi

psql_lokal -c "analyze" >/dev/null
echo
ok "Langkah 3 selesai. Berikutnya: node skrip/04-uji-gotrue.mjs"
