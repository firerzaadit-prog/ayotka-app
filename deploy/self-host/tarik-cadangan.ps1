# Menyalin cadangan database harian dari server ke komputer ini, lalu membersihkan salinan lama di komputer ini.
# Jalankan dari PowerShell di PC (BUKAN di server):
#   .\deploy\self-host\tarik-cadangan.ps1
#   .\deploy\self-host\tarik-cadangan.ps1 -Tujuan "D:\cadangan-ayotka"
#   .\deploy\self-host\tarik-cadangan.ps1 -HanyaBersihkan -Simulasi   # lihat apa yang akan dihapus (tanpa SSH, tanpa menghapus)
#   .\deploy\self-host\tarik-cadangan.ps1 -HanyaBersihkan             # hanya membersihkan, tanpa menyalin
# Butuh OpenSSH (bawaan Windows 10/11) dan akses SSH ke server seperti biasa. Menyalin semua db-*.dump yang ada
# (kecil: hitungan MB); yang sudah ada di PC ditimpa dengan isi yang sama.
#
# Pembersihan: dump di PC yang lebih tua dari -SimpanHari hari (bawaan 14, sama dengan lama simpan di server dan di
# Kebijakan Privasi) dihapus, KECUALI -MinimalSisa (bawaan 3) dump TERBARU yang selalu disimpan: kalau penarikan
# berhenti berminggu-minggu, cadangan terakhir tidak ikut habis. Umur dibaca dari tanggal pada NAMA berkas
# (db-YYYYMMDD-HHMMSS.dump), bukan dari waktu salin (scp menimpanya tiap kali). Berkas lain di folder itu tidak disentuh.
# Pembersihan hanya berjalan setelah penyalinan berhasil (kecuali -HanyaBersihkan).
param(
  [string]$Server = "firerza@187.77.115.29",
  [string]$Tujuan = (Join-Path $HOME "cadangan-ayotka"),
  [int]$SimpanHari = 14,
  [int]$MinimalSisa = 3,
  [switch]$HanyaBersihkan,
  [switch]$Simulasi
)

$ErrorActionPreference = "Stop"

function Hapus-CadanganLama {
  param(
    [string]$Folder,
    [int]$SimpanHari,
    [int]$MinimalSisa,
    [bool]$Simulasi,
    [datetime]$Sekarang = (Get-Date)
  )
  $dump = @()
  foreach ($f in @(Get-ChildItem -Path $Folder -Filter "db-*.dump" -File)) {
    if ($f.Name -match '^db-(\d{8})-(\d{6})\.dump$') {
      $waktu = [datetime]::ParseExact(($Matches[1] + $Matches[2]), "yyyyMMddHHmmss", [System.Globalization.CultureInfo]::InvariantCulture)
      $dump += [pscustomobject]@{ Berkas = $f; Waktu = $waktu }
    }
  }
  $urut = @($dump | Sort-Object Waktu -Descending)
  $batas = $Sekarang.AddDays(-$SimpanHari)
  $dihapus = 0
  for ($i = 0; $i -lt $urut.Count; $i++) {
    if ($i -lt $MinimalSisa) { continue }
    if ($urut[$i].Waktu -ge $batas) { continue }
    if ($Simulasi) {
      Write-Host ("[simulasi] akan dihapus: {0}" -f $urut[$i].Berkas.Name)
    } else {
      Remove-Item -LiteralPath $urut[$i].Berkas.FullName -Force
      Write-Host ("dihapus: {0}" -f $urut[$i].Berkas.Name)
    }
    $dihapus++
  }
  return $dihapus
}

if ($SimpanHari -lt 1) { Write-Error "-SimpanHari minimal 1." }
if ($MinimalSisa -lt 1) { Write-Error "-MinimalSisa minimal 1 (cadangan terbaru selalu disisakan)." }
New-Item -ItemType Directory -Force -Path $Tujuan | Out-Null

if (-not $HanyaBersihkan) {
  Write-Host "Menyalin cadangan dari $Server ke $Tujuan ..."
  & scp "${Server}:/var/backups/ayotka/db-*.dump" $Tujuan
  if ($LASTEXITCODE -ne 0) {
    Write-Error "scp gagal (kode $LASTEXITCODE). Jika 'Permission denied': di server jalankan 'sudo bash /opt/ayotka-selfhost/skrip/backup-harian.sh' sekali (lihat README, bagian Perawatan sehari-hari)."
  }
}

$berkas = @(Get-ChildItem -Path $Tujuan -Filter "db-*.dump")
if ($berkas.Count -eq 0) {
  Write-Error "Tidak ada berkas db-*.dump di $Tujuan."
}

$dihapus = Hapus-CadanganLama -Folder $Tujuan -SimpanHari $SimpanHari -MinimalSisa $MinimalSisa -Simulasi ([bool]$Simulasi)
if ($Simulasi) {
  Write-Host ("Simulasi: {0} berkas lebih tua dari {1} hari AKAN dihapus ({2} terbaru selalu disimpan). Tidak ada yang dihapus." -f $dihapus, $SimpanHari, $MinimalSisa)
} else {
  Write-Host ("Pembersihan: {0} berkas lebih tua dari {1} hari dihapus ({2} terbaru selalu disimpan)." -f $dihapus, $SimpanHari, $MinimalSisa)
}

# Nama berkas memuat tanggal, jadi urutan nama = urutan waktu cadangan (waktu salin selalu berganti karena scp menimpa).
$sisa = @(Get-ChildItem -Path $Tujuan -Filter "db-*.dump" | Sort-Object Name -Descending)
Write-Host ("Selesai. {0} berkas di {1}; terbaru: {2} ({3:N0} KB)." -f $sisa.Count, $Tujuan, $sisa[0].Name, ($sisa[0].Length / 1KB))
