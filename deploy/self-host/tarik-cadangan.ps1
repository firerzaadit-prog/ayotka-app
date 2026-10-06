# Menyalin cadangan database harian dari server ke komputer ini. Jalankan dari PowerShell di PC (BUKAN di server):
#   .\deploy\self-host\tarik-cadangan.ps1
#   .\deploy\self-host\tarik-cadangan.ps1 -Tujuan "D:\cadangan-ayotka"
# Butuh OpenSSH (bawaan Windows 10/11) dan akses SSH ke server seperti biasa. Menyalin semua db-*.dump yang ada
# (kecil: hitungan MB); yang sudah ada di PC ditimpa dengan isi yang sama. Berkas di PC tidak pernah dihapus otomatis.
param(
  [string]$Server = "firerza@187.77.115.29",
  [string]$Tujuan = (Join-Path $HOME "cadangan-ayotka")
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $Tujuan | Out-Null

Write-Host "Menyalin cadangan dari $Server ke $Tujuan ..."
& scp "${Server}:/var/backups/ayotka/db-*.dump" $Tujuan
if ($LASTEXITCODE -ne 0) {
  Write-Error "scp gagal (kode $LASTEXITCODE). Jika 'Permission denied': di server jalankan 'sudo bash /opt/ayotka-selfhost/skrip/backup-harian.sh' sekali (lihat README, bagian Perawatan sehari-hari)."
}

$berkas = @(Get-ChildItem -Path $Tujuan -Filter "db-*.dump" | Sort-Object LastWriteTime -Descending)
if ($berkas.Count -eq 0) {
  Write-Error "Tidak ada berkas db-*.dump di $Tujuan setelah menyalin."
}
Write-Host ("Selesai. {0} berkas di {1}; terbaru: {2} ({3:N0} KB)." -f $berkas.Count, $Tujuan, $berkas[0].Name, ($berkas[0].Length / 1KB))
