# Membuka terowongan SSH dari komputer ini ke SERVER PRODUKSI untuk mode "lokal terhubung ke produksi".
# Dua penerusan sekaligus, keduanya hanya bisa dicapai dari komputer ini (terikat ke 127.0.0.1):
#   127.0.0.1:5433   -> server 127.0.0.1:5432   database Postgres produksi        (DATABASE_URL / DIRECT_URL di .env)
#   127.0.0.1:19999  -> server 127.0.0.1:9999   GoTrue (login) langsung, melewati nginx yang menolak API admin dari luar
#                                               (SUPABASE_ADMIN_TUNNEL_URL di .env.local)
# Jendela ini harus dibiarkan terbuka selama bekerja; Ctrl+C menutup terowongan.
#
#   .\scripts\lokal\terowongan.ps1
#   .\scripts\lokal\terowongan.ps1 -Server "pengguna@alamat"
#
# Kata sandi/kunci SSH diminta oleh ssh sendiri; skrip ini tidak menyimpan atau mencetaknya.
param(
  [string]$Server = "firerza@187.77.115.29",
  [int]$PortDb = 5433,
  [int]$PortAdmin = 19999
)

$ErrorActionPreference = "Stop"

function Cari-PemilikPort([int]$port) {
  $sambungan = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $sambungan) { return $null }
  return Get-Process -Id $sambungan.OwningProcess -ErrorAction SilentlyContinue
}

foreach ($port in @($PortDb, $PortAdmin)) {
  $pemilik = Cari-PemilikPort $port
  if ($pemilik) {
    Write-Host ("Port {0} sudah dipakai oleh proses {1} (id {2})." -f $port, $pemilik.ProcessName, $pemilik.Id)
    if ($pemilik.ProcessName -eq "ssh") {
      Write-Host "Itu kemungkinan terowongan SSH lama (hanya satu penerusan). Tutup dulu, lalu jalankan skrip ini lagi:"
      Write-Host ("  Stop-Process -Id {0}" -f $pemilik.Id)
      Write-Host "(Server dev yang sedang jalan akan menyambung ulang sendiri begitu terowongan baru hidup.)"
    }
    exit 1
  }
}

Write-Host "Membuka terowongan ke $Server ..."
Write-Host ("  database  127.0.0.1:{0}  ->  server 127.0.0.1:5432" -f $PortDb)
Write-Host ("  API admin 127.0.0.1:{0} ->  server 127.0.0.1:9999" -f $PortAdmin)
Write-Host "Biarkan jendela ini terbuka. Ctrl+C untuk menutup."

& ssh -N `
  -o ServerAliveInterval=30 `
  -o ServerAliveCountMax=3 `
  -o ExitOnForwardFailure=yes `
  -L ("127.0.0.1:{0}:127.0.0.1:5432" -f $PortDb) `
  -L ("127.0.0.1:{0}:127.0.0.1:9999" -f $PortAdmin) `
  $Server

if ($LASTEXITCODE -ne 0) {
  Write-Error ("ssh berhenti dengan kode {0}. Jika 'Permission denied': periksa kata sandi/kunci SSH." -f $LASTEXITCODE)
}
