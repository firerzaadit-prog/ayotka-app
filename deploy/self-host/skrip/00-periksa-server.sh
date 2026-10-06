#!/usr/bin/env bash
# LANGKAH 0 - pemeriksaan awal. HANYA MEMBACA, tidak mengubah apa pun di server.
# Jalankan:  sudo bash skrip/00-periksa-server.sh
set -uo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
harus_root

masalah=0
tandai() { masalah=$((masalah + 1)); peringatan "$*"; }

echo "=== Sumber daya server"
cpu=$(nproc)
ram_tersedia=$(free -m | awk '/^Mem:/ {print $7}')
disk_kosong=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
info "CPU: ${cpu} inti | RAM tersedia: ${ram_tersedia} MB | Disk kosong: ${disk_kosong} GB"
[ "$ram_tersedia" -ge 2000 ] && ok "RAM cukup" || tandai "RAM tersedia kurang dari 2 GB; Postgres + login + aplikasi + proses build bisa sesak."
[ "$disk_kosong" -ge 10 ] && ok "Disk cukup" || tandai "Disk kosong kurang dari 10 GB."

echo
echo "=== Docker"
if docker info >/dev/null 2>&1; then ok "Docker berjalan ($(docker --version | head -1))"; else tandai "Docker tidak bisa dipakai (pakai sudo? layanan docker aktif?)."; fi
if docker compose version >/dev/null 2>&1; then ok "$(docker compose version | head -1)"; else tandai "Plugin 'docker compose' tidak ada."; fi

echo
echo "=== Port yang akan dipakai harus kosong (5432 database, 9999 login)"
terpakai=$(ss -ltn | awk 'NR>1 {print $4}' | grep -E ':(5432|9999)$' || true)
if [ -z "$terpakai" ]; then ok "Port 5432 dan 9999 kosong"; else
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qE "^($DB_CONTAINER|$AUTH_CONTAINER)$"; then ok "Port dipakai container paket ini sendiri (sudah terpasang)"; else tandai "Port sudah dipakai proses lain: $terpakai"; fi
fi

echo
echo "=== .env aplikasi ($APP_ENV)"
if [ -r "$APP_ENV" ]; then
  ok ".env terbaca"
  for k in DATABASE_URL DIRECT_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_APP_URL; do
    if [ -n "$(baca_env "$APP_ENV" "$k")" ]; then ok "$k terisi"; else tandai "$k KOSONG/tidak ada di .env"; fi
  done
  if [ -n "$(baca_env "$APP_ENV" APP_ENCRYPTION_KEY)" ]; then ok "APP_ENCRYPTION_KEY terisi"; else peringatan "APP_ENCRYPTION_KEY belum diisi (kunci enkripsi memakai SUPABASE_SERVICE_ROLE_KEY - lihat pemeriksaan kunci di bawah)."; fi
else
  tandai "Tidak bisa membaca $APP_ENV"
fi

echo
echo "=== Aplikasi yang berjalan"
pid=$(ss -ltnp 2>/dev/null | grep -E ':3001\b' | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2 || true)
if [ -n "$pid" ]; then ok "Aplikasi di port 3001 (pid $pid, dijalankan oleh: $(ps -o user= -p "$pid" | tr -d ' '))"; else tandai "Tidak ada proses yang mendengarkan port 3001 (aplikasi AyoTKA)."; fi
[ -d "$APP_DIR/.git" ] && ok "Folder aplikasi: $APP_DIR (commit $(git -C "$APP_DIR" log -1 --format=%h 2>/dev/null || echo ?))" || tandai "$APP_DIR bukan repo git."
[ -f "$APP_DIR/lib/storage/media-lokal.ts" ] && ok "Kode baru (penyimpanan lokal) sudah ter-deploy" || peringatan "Kode baru (penyimpanan lokal, status maintenance via Prisma, pesan login) BELUM ter-deploy - wajib sebelum langkah 5."

echo
echo "=== Jangkauan ke database Supabase (hanya uji sambungan TCP)"
if muat_sumber 2>/dev/null; then
  host=$(printf '%s' "$SRC_URL" | sed -E 's#^[a-z]+://[^@]*@([^:/]+).*#\1#')
  port=$(printf '%s' "$SRC_URL" | sed -E 's#^[a-z]+://[^@]*@[^:/]+:([0-9]+).*#\1#')
  if timeout 8 bash -c "exec 3<>/dev/tcp/$host/$port" 2>/dev/null; then ok "Terjangkau: $host:$port"; else tandai "Tidak terjangkau: $host:$port"; fi
else
  tandai "Alamat database sumber tidak terbaca dari .env"
fi

echo
echo "=== nginx"
if command -v nginx >/dev/null 2>&1; then
  if nginx -t >/dev/null 2>&1; then ok "Konfigurasi nginx valid"; else tandai "nginx -t GAGAL (perbaiki dulu)"; fi
  if grep -rqs "ayotka-selfhost.conf" /etc/nginx 2>/dev/null; then ok "Snippet ayotka-selfhost.conf sudah di-include"; else peringatan "Snippet nginx belum dipasang (dilakukan di langkah nginx, lihat README)."; fi
else
  tandai "nginx tidak ditemukan"
fi

echo
echo "=== Firewall"
if command -v ufw >/dev/null 2>&1; then ufw status | head -5 | sed 's/^/    /'; else info "ufw tidak terpasang"; fi

echo
echo "=== Kunci enkripsi pengaturan (hanya memeriksa; tidak mengubah)"
if command -v node >/dev/null 2>&1 && [ -d "$APP_DIR/node_modules/@prisma" ]; then
  node "$PAKET_DIR/skrip/kunci-enkripsi.mjs" || peringatan "Pemeriksaan kunci enkripsi memberi peringatan (kode $?) - baca keterangannya di atas."
else
  peringatan "node atau node_modules aplikasi tidak ada; pemeriksaan kunci enkripsi dilewati."
fi

echo
if [ "$masalah" -eq 0 ]; then ok "Semua pemeriksaan wajib lolos."; else peringatan "$masalah masalah perlu dibereskan sebelum lanjut."; fi
exit $(( masalah > 0 ? 1 : 0 ))
