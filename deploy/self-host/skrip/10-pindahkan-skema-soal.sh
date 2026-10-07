#!/usr/bin/env bash
# LANGKAH 10 - menyalin skema `soal` (data generator soal.ayotka.id: soal, paket, pengguna generator, log) dari Supabase
# Cloud ke database LOKAL di server ini, lengkap dengan peran (role) dan hak aksesnya, lalu MEMBUKTIKAN salinannya identik
# (jumlah baris DAN isi tiap tabel). HANYA MEMBACA dari Supabase. Tidak mengubah .env aplikasi dan tidak menyentuh
# generator - pengalihan dilakukan skrip/11 setelah salinan terbukti identik.
#
# Dua cara memakainya:
#   sudo bash skrip/10-pindahkan-skema-soal.sh            LATIHAN: boleh kapan saja, aman diulang. Generator masih
#                                                         berjalan, jadi sedikit selisih dengan Supabase itu wajar.
#   sudo bash skrip/10-pindahkan-skema-soal.sh --final    SALINAN AKHIR (generator HARUS sudah dihentikan): selisih
#                                                         sekecil apa pun = gagal. Hanya salinan akhir yang boleh
#                                                         dialihkan oleh skrip/11.
# Opsi tambahan: --ya (lewati pertanyaan konfirmasi pada --final).
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
harus_root
cd "$PAKET_DIR"

FINAL=0
YA=0
while [ $# -gt 0 ]; do
  case "$1" in
    --final) FINAL=1 ;;
    --ya) YA=1 ;;
    *) gagal "Argumen tidak dikenal: $1" ;;
  esac
  shift
done

[ -f "$TANDA_SELESAI" ] || gagal "Pemindahan database ayotka.id (Langkah 5) belum selesai; skema soal dipindah sesudahnya."
[ ! -f "$TANDA_SOAL_DIALIHKAN" ] || gagal "Skema soal SUDAH dialihkan ke database lokal (generator menulis ke sana). Menyalin lagi dari Supabase akan menimpa data baru dengan data LAMA - dihentikan."
wadah_sehat "$DB_CONTAINER" || gagal "Database lokal belum sehat (docker compose ps)."
command -v openssl >/dev/null || gagal "openssl tidak ada di server."
muat_sumber_lama || exit 1

# ---------- 1. sumber ----------
info "Menguji sambungan ke Supabase dan membaca daftar tabel skema soal..."
daftar_sumber=$(psql_sumber -Atc "select tablename from pg_tables where schemaname='soal' order by 1") \
  || gagal "Tidak bisa terhubung ke database Supabase (cek alamatnya di .env lama)."
[ -n "$daftar_sumber" ] || gagal "Skema soal tidak ditemukan di Supabase."
for wajib in questions question_packages stimulus; do
  printf '%s\n' "$daftar_sumber" | grep -qx "$wajib" || gagal "Tabel soal.$wajib tidak ada di Supabase - skema tidak seperti yang diharapkan."
done
jumlah_tabel=$(printf '%s\n' "$daftar_sumber" | wc -l)
jumlah_policy_sumber=$(psql_sumber -Atc "select count(*) from pg_policies where schemaname='soal'")
ok "Skema soal di Supabase: $jumlah_tabel tabel, $jumlah_policy_sumber kebijakan akses baris."

# ---------- 2. salinan akhir: pastikan tidak ada yang masih menulis ----------
if [ "$FINAL" -eq 1 ]; then
  if [ "$YA" -ne 1 ]; then
    konfirmasi SALIN "Ini SALINAN AKHIR. Generator soal.ayotka.id HARUS sudah dihentikan lebih dulu (pm2 stop generator-soal-tka), kalau tidak salinan ini ditolak oleh pemeriksaan di bawah."
  fi
  info "Memeriksa apakah masih ada yang menulis ke skema soal di Supabase (dua pengambilan, selang 10 dtk)..."
  a=$(sidik_soal sumber)
  sleep 10
  b=$(sidik_soal sumber)
  if [ "$a" != "$b" ]; then
    diff <(printf '%s\n' "$a") <(printf '%s\n' "$b") >&2 || true
    gagal "Isi skema soal di Supabase BERUBAH dalam 10 detik: generator tampaknya masih berjalan. Hentikan dulu (pm2 stop generator-soal-tka), lalu ulangi."
  fi
  ok "Tidak ada perubahan selama 10 detik."
fi

# ---------- 3. cadangan dari sumber ----------
rm -f "$TANDA_SOAL_FINAL" # salinan lokal akan diganti: tanda "salinan akhir" lama tidak berlaku lagi
tujuan="$PAKET_DIR/backup/soal-$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$tujuan"
chmod 700 "$tujuan"
berkas="$tujuan/soal.dump"
info "Mengunduh skema soal dari Supabase..."
docker exec -e SRC_URL "$DB_CONTAINER" sh -c 'pg_dump "$SRC_URL" "$@"' sh -Fc -n soal --no-owner --no-privileges --no-publication --no-subscriptions > "$berkas"
[ -s "$berkas" ] || gagal "Cadangan kosong."
docker exec -i "$DB_CONTAINER" pg_restore --list < "$berkas" >/dev/null || gagal "Cadangan tidak terbaca (rusak)."
( cd "$tujuan" && sha256sum soal.dump > SHA256SUMS )
chmod 600 "$berkas"
ok "soal.dump ($(du -h "$berkas" | cut -f1)) tersimpan dan terbaca utuh di $tujuan"

# ---------- 4. peran (role) lokal ----------
# ayotka_app_reader: dipakai ayotka.id (impor soal) - hanya MEMBACA tiga tabel, sama seperti di Supabase.
# soal_app: dipakai generator - pemilik skema soal saja; tidak punya akses ke data ayotka.id (public/auth).
sandi_reader=$(sandi_role SOAL_READER_PASSWORD)
sandi_app=$(sandi_role SOAL_APP_PASSWORD)
info "Menyiapkan peran ayotka_app_reader dan soal_app di database lokal..."
psql_admin -q <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ayotka_app_reader') THEN
    CREATE ROLE ayotka_app_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 20;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'soal_app') THEN
    CREATE ROLE soal_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 30;
  END IF;
END
\$\$;
ALTER ROLE ayotka_app_reader PASSWORD '$sandi_reader';
ALTER ROLE soal_app PASSWORD '$sandi_app';
SQL
ok "Peran siap."

# ---------- 5. pulihkan ke database lokal (satu transaksi: berhasil seluruhnya atau skema lama tetap utuh) ----------
info "Memulihkan skema soal ke database lokal (menggantikan salinan lokal sebelumnya, bila ada)..."
log="$tujuan/pulihkan.log"
if ! docker exec -i "$DB_CONTAINER" pg_restore -h localhost -U supabase_admin -d postgres \
  --clean --if-exists --no-owner --no-privileges --exit-on-error --single-transaction < "$berkas" > /dev/null 2> "$log"; then
  peringatan "Pemulihan gagal; skema lokal tidak berubah. Cuplikan dari $log:"
  grep -i 'error' "$log" | head -15 >&2 || tail -15 "$log" >&2
  gagal "Pemulihan skema soal gagal."
fi

info "Mengatur pemilik dan hak akses..."
psql_admin -q <<'SQL'
ALTER SCHEMA soal OWNER TO soal_app;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'soal' LOOP
    EXECUTE format('ALTER TABLE soal.%I OWNER TO soal_app', r.tablename);
  END LOOP;
END
$$;
REVOKE ALL ON SCHEMA soal FROM PUBLIC;
GRANT USAGE ON SCHEMA soal TO ayotka_app_reader;
GRANT SELECT ON soal.questions, soal.stimulus, soal.question_packages TO ayotka_app_reader;
ANALYZE;
SQL
ok "Pemilik dan hak akses diatur."

# ---------- 6. bukti salinan identik ----------
info "Membandingkan isi tiap tabel dengan Supabase (jumlah baris + sidik-jari seluruh isi)..."
s_sumber=$(sidik_soal sumber)
s_lokal=$(sidik_soal lokal)
policy_lokal=$(psql_lokal -Atc "select count(*) from pg_policies where schemaname='soal'")
tabel_lokal=$(psql_lokal -Atc "select count(*) from pg_tables where schemaname='soal'")
echo "$s_lokal" | awk -F'|' '{ printf "    %-20s %s baris\n", $1, $2 }'

identik=1
[ "$tabel_lokal" = "$jumlah_tabel" ] || { peringatan "Jumlah tabel berbeda: lokal $tabel_lokal, Supabase $jumlah_tabel."; identik=0; }
[ "$policy_lokal" = "$jumlah_policy_sumber" ] || { peringatan "Jumlah kebijakan akses berbeda: lokal $policy_lokal, Supabase $jumlah_policy_sumber."; identik=0; }
if [ "$s_sumber" != "$s_lokal" ]; then
  peringatan "Tabel yang isinya berbeda dari Supabase (< = lokal, > = Supabase):"
  diff <(printf '%s\n' "$s_lokal") <(printf '%s\n' "$s_sumber") | grep '^[<>]' | awk -F'|' '{ print "    " $1 " (" $2 " baris)" }' >&2 || true
  identik=0
fi

if [ "$identik" -eq 1 ]; then
  ok "SEMUA $jumlah_tabel tabel IDENTIK dengan Supabase (jumlah baris dan isi), $policy_lokal kebijakan akses sama."
  if [ "$FINAL" -eq 1 ]; then
    date -u +%FT%TZ > "$TANDA_SOAL_FINAL"
    ok "Salinan AKHIR tercatat. Berikutnya (dalam 30 menit): sudo bash skrip/11-alihkan-soal.sh"
  else
    ok "Latihan berhasil. Belum ada yang diubah di aplikasi. Saat hari pengalihan: hentikan generator, lalu jalankan skrip ini dengan --final."
  fi
else
  if [ "$FINAL" -eq 1 ]; then
    gagal "Salinan akhir TIDAK identik dengan Supabase - jangan dialihkan. Kirim keluaran di atas dan $log."
  fi
  peringatan "Tidak identik. Untuk LATIHAN ini wajar bila generator sedang menulis; untuk salinan akhir hentikan generator dulu dan jalankan dengan --final."
fi
