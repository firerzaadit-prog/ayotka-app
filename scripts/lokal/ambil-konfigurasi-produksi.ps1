# Merekam konfigurasi SERVER PRODUKSI (tanpa rahasia) ke deploy\lokal\produksi-referensi.json.
# Berkas itu dipakai "npm run lokal:cek" untuk membandingkan komputer ini dengan produksi.
#
#   .\scripts\lokal\ambil-konfigurasi-produksi.ps1
#   .\scripts\lokal\ambil-konfigurasi-produksi.ps1 -Server "pengguna@alamat"
#
# Cara kerja: skrip deploy\self-host\skrip\cetak-konfigurasi.mjs dialirkan lewat SSH ke `node` di server. Tidak ada
# berkas yang ditinggal di server dan tidak ada yang diubah di sana (hanya membaca). Keluarannya JSON yang HANYA memuat
# nilai non-rahasia, panjang, dan sidik-jari (bukan nilai asli) untuk kunci/token. Sebelum disimpan, keluaran diperiksa
# sekali lagi terhadap pola rahasia umum; bila ada yang cocok, tidak disimpan.
# Kata sandi/kunci SSH diminta oleh ssh sendiri.
param(
  [string]$Server = "firerza@187.77.115.29",
  [string]$Keluaran = ""
)

$ErrorActionPreference = "Stop"

$akar = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not $Keluaran) { $Keluaran = Join-Path $akar "deploy\lokal\produksi-referensi.json" }
$skrip = Join-Path $akar "deploy\self-host\skrip\cetak-konfigurasi.mjs"
if (-not (Test-Path -LiteralPath $skrip)) { Write-Error "Tidak menemukan $skrip" }

$isi = Get-Content -Raw -LiteralPath $skrip
if ($isi -match '[^\x00-\x7F]') {
  Write-Error "cetak-konfigurasi.mjs harus ASCII murni (PowerShell merusak karakter lain saat mengalirkan ke ssh)."
}

Write-Host "Menyambung ke $Server dan membaca konfigurasi (hanya membaca) ..."
$hasil = $isi | & ssh -o ServerAliveInterval=30 $Server "node --input-type=module -"
if ($LASTEXITCODE -ne 0) {
  Write-Error ("ssh/node gagal (kode {0}). Pastikan Node ada di server dan kata sandi benar." -f $LASTEXITCODE)
}
$teks = (($hasil | ForEach-Object { "$_" }) -join "`n").Trim()

try { $objek = $teks | ConvertFrom-Json } catch { Write-Error "Keluaran dari server bukan JSON yang valid. Tidak disimpan." }
if (-not $objek.kode -or -not $objek.env) { Write-Error "Keluaran tidak lengkap (bagian kode/env tidak ada). Tidak disimpan." }

# Pengaman terakhir: pola rahasia yang tidak boleh ada di berkas ini.
$pola = @(
  'eyJ[A-Za-z0-9_-]{20,}',                                 # JWT (kunci anon/service)
  'postgres(ql)?://[^:/\s"]+:(?!\*\*\*)[^@\s"]+@',         # alamat database dengan sandi asli
  'AIza[0-9A-Za-z_-]{20,}',                                # kunci Google/Gemini
  're_[A-Za-z0-9]{20,}',                                   # kunci Resend
  '(SB-)?Mid-server-[A-Za-z0-9-]{10,}',                    # kunci server Midtrans
  'Bearer\s+(?!\*\*\*)[A-Za-z0-9._-]{16,}'                 # token Bearer
)
foreach ($p in $pola) {
  if ($teks -match $p) {
    Write-Error ("Keluaran memuat pola yang tampak seperti rahasia ({0}). TIDAK disimpan. Laporkan ini; jangan tempel keluarannya di mana pun." -f $p)
  }
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Keluaran) | Out-Null
[System.IO.File]::WriteAllText($Keluaran, $teks + "`n", (New-Object System.Text.UTF8Encoding($false)))

$node = $objek.server.node
$sha = $objek.kode.sha
$zona = $objek.server.zonaWaktu
$jumlahEnv = ($objek.env.variabel.PSObject.Properties | Measure-Object).Count
Write-Host ""
Write-Host "Tersimpan: $Keluaran"
Write-Host ("  commit di server : {0}" -f $sha)
Write-Host ("  Node di server   : {0}" -f $node)
Write-Host ("  zona waktu       : {0}" -f $zona)
Write-Host ("  variabel dibaca  : {0}" -f $jumlahEnv)
Write-Host ""
Write-Host "Berikutnya jalankan:  npm run lokal:cek"
