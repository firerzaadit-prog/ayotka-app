#!/usr/bin/env bash
# LANGKAH 8 (SETELAH pembatasan Supabase dicabut) - memindahkan berkas gambar dari Supabase Storage ke disk server dan
# menulis ulang alamat gambar di database lokal.
#
# Kenapa terpisah: berkas gambar baru bisa diunduh setelah Supabase Storage berfungsi lagi (sekarang HTTP 402). Sampai
# saat itu, gambar soal lama tidak tampil (sama seperti sebelum pindah); gambar baru yang diunggah sudah masuk disk.
#
# Yang dilakukan:
#   1. daftar semua berkas bucket soal-media dari Supabase (lewat database), unduh ke MEDIA_DIR, periksa isinya gambar
#   2. cadangkan database lokal, lalu ganti awalan alamat lama -> alamat baru di SEMUA kolom teks skema public
#   3. (opsional lewat --bukti-transfer) salin bucket privat bukti-transfer ke /var/backups/ayotka/bukti-transfer
#
# Jalankan:  sudo bash skrip/08-pindahkan-gambar.sh [--bukti-transfer]
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
harus_root
cd "$PAKET_DIR"

BUKTI=0
[ "${1:-}" = "--bukti-transfer" ] && BUKTI=1

[ -f "$TANDA_SELESAI" ] || gagal "Pemindahan (langkah 5) belum selesai."
[ -f "$PAKET_DIR/.env-sebelum-pindah" ] || gagal "Catatan .env lama tidak ada (.env-sebelum-pindah)."
ENV_LAMA=$(cat "$PAKET_DIR/.env-sebelum-pindah")
[ -r "$ENV_LAMA" ] || gagal "Berkas .env lama tidak terbaca: $ENV_LAMA"
muat_sumber "$ENV_LAMA" || exit 1

url_lama=$(baca_env "$ENV_LAMA" NEXT_PUBLIC_SUPABASE_URL)
kunci_lama=$(baca_env "$ENV_LAMA" SUPABASE_SERVICE_ROLE_KEY)
[ -n "$url_lama" ] && [ -n "$kunci_lama" ] || gagal "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY lama tidak ada di $ENV_LAMA"
media_dir=$(baca_env "$APP_ENV" MEDIA_DIR)
media_url=$(baca_env "$APP_ENV" MEDIA_PUBLIC_BASE_URL)
[ -n "$media_dir" ] && [ -n "$media_url" ] || gagal "MEDIA_DIR/MEDIA_PUBLIC_BASE_URL belum ada di .env aplikasi."
awalan_lama="${url_lama%/}/storage/v1/object/public/soal-media/"
awalan_baru="${media_url%/}/"

# ---------- 1. unduh ----------
info "Daftar berkas bucket soal-media di Supabase..."
daftar=$(psql_sumber -Atc "select name from storage.objects where bucket_id='soal-media' and name !~ '/\$' order by name") || gagal "Tidak bisa membaca daftar berkas."
jumlah=$(printf '%s\n' "$daftar" | grep -c . || true)
ok "$jumlah berkas ditemukan."

pertama=$(printf '%s\n' "$daftar" | head -1)
if [ -n "$pertama" ]; then
  kode=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "${awalan_lama}${pertama}" || true)
  [ "$kode" = "200" ] || gagal "Supabase Storage masih belum bisa dipakai (HTTP $kode untuk berkas contoh). Cabut pembatasannya dulu (billing), lalu ulangi."
fi

mkdir -p "$media_dir"
unduh=0; lewati=0; rusak=0
while IFS= read -r nama; do
  [ -n "$nama" ] || continue
  case "$nama" in *..*|/*|*\\*) peringatan "Nama berkas mencurigakan dilewati: $nama"; continue ;; esac
  tujuan="$media_dir/$nama"
  if [ -s "$tujuan" ]; then lewati=$((lewati + 1)); continue; fi
  mkdir -p "$(dirname "$tujuan")"
  sementara="$tujuan.unduh"
  if ! curl -fsS --max-time 120 -o "$sementara" "${awalan_lama}${nama}"; then rusak=$((rusak + 1)); peringatan "Gagal mengunduh: $nama"; rm -f "$sementara"; continue; fi
  # Hanya gambar: periksa byte awal (PNG, JPEG, GIF, WEBP).
  awal=$(head -c 12 "$sementara" | od -An -tx1 | tr -d ' \n')
  case "$awal" in
    89504e47*|ffd8ff*|47494638*|52494646????????57454250*) ;;
    *) peringatan "Bukan gambar, dilewati: $nama"; rm -f "$sementara"; rusak=$((rusak + 1)); continue ;;
  esac
  mv "$sementara" "$tujuan"
  chmod 644 "$tujuan"
  unduh=$((unduh + 1))
done <<< "$daftar"
ok "Gambar: $unduh diunduh, $lewati sudah ada, $rusak bermasalah."
[ "$rusak" -eq 0 ] || gagal "Ada berkas yang bermasalah - alamat di database TIDAK diubah. Periksa pesan di atas."

# ---------- 2. tulis ulang alamat di database ----------
info "Mencadangkan database lokal sebelum mengubah alamat..."
bash "$PAKET_DIR/skrip/backup-harian.sh"

info "Mencari kolom teks yang memuat alamat lama..."
kolom=$(psql_lokal -Atc "select table_name || '.' || column_name from information_schema.columns where table_schema='public' and data_type in ('text','character varying') and table_name <> '_prisma_migrations' order by 1")
total=0
for tk in $kolom; do
  t="${tk%%.*}"; k="${tk#*.}"
  n=$(psql_lokal -Atc "select count(*) from public.\"$t\" where \"$k\" like '%' || \$\$${awalan_lama}\$\$ || '%'")
  if [ "$n" -gt 0 ]; then
    psql_lokal -c "update public.\"$t\" set \"$k\" = replace(\"$k\", \$\$${awalan_lama}\$\$, \$\$${awalan_baru}\$\$) where \"$k\" like '%' || \$\$${awalan_lama}\$\$ || '%'" >/dev/null
    ok "$t.$k: $n baris diperbarui"
    total=$((total + n))
  fi
done
sisa=0
for tk in $kolom; do
  t="${tk%%.*}"; k="${tk#*.}"
  n=$(psql_lokal -Atc "select count(*) from public.\"$t\" where \"$k\" like '%supabase.co/storage/%'")
  sisa=$((sisa + n))
done
ok "Total $total baris diperbarui; sisa alamat Supabase Storage di kolom teks: $sisa"
[ "$sisa" -eq 0 ] || peringatan "Masih ada $sisa baris dengan alamat supabase.co/storage (mungkin dari project lain atau bucket lain) - periksa manual."

# ---------- 3. bukti transfer (opsional) ----------
if [ "$BUKTI" -eq 1 ]; then
  info "Menyalin bucket privat bukti-transfer ke /var/backups/ayotka/bukti-transfer ..."
  mkdir -p /var/backups/ayotka/bukti-transfer
  chmod 700 /var/backups/ayotka /var/backups/ayotka/bukti-transfer
  psql_sumber -Atc "select name from storage.objects where bucket_id='bukti-transfer' and name !~ '/\$' order by name" | while IFS= read -r nama; do
    [ -n "$nama" ] || continue
    case "$nama" in *..*|/*|*\\*) continue ;; esac
    mkdir -p "$(dirname "/var/backups/ayotka/bukti-transfer/$nama")"
    curl -fsS --max-time 120 -H "Authorization: Bearer $kunci_lama" -H "apikey: $kunci_lama" -o "/var/backups/ayotka/bukti-transfer/$nama" "${url_lama%/}/storage/v1/object/bukti-transfer/$nama" && echo "    $nama" || peringatan "Gagal: $nama"
  done
  ok "Bukti transfer tersalin (tidak dilayani nginx; hanya arsip)."
fi

echo
ok "Langkah 8 selesai. Cek satu soal bergambar di Bank Soal admin pusat untuk memastikan gambar tampil."
