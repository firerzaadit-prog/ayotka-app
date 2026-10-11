// Mencetak konfigurasi aplikasi di SERVER PRODUKSI sebagai JSON, TANPA rahasia. Hanya membaca; tidak menulis apa pun.
// Dipakai untuk menyamakan komputer lokal dengan produksi (lihat deploy/lokal/KESAMAAN-LOKAL-PRODUKSI.md).
//
// Dari komputer (satu perintah; skrip dialirkan lewat SSH, tidak ada berkas yang ditinggal di server):
//   .\scripts\lokal\ambil-konfigurasi-produksi.ps1
// Atau langsung di server:   node deploy/self-host/skrip/cetak-konfigurasi.mjs
//
// Aturan keamanan keluaran:
//  - Nilai variabel hanya dicetak untuk nama pada DAFTAR_AMAN (bukan rahasia). Alamat database dicetak tanpa sandi.
//  - Selain itu hanya: ada/kosong, panjang, dan sidik-jari (10 heksadesimal pertama sha256) untuk nilai >= 20 karakter
//    yang namanya bukan kata sandi. Sidik-jari tidak bisa dibalik jadi nilainya; fungsinya hanya membandingkan
//    "nilai di komputer lokal sama dengan di server?".
//  - Berkas ini sengaja ASCII murni (dialirkan lewat PowerShell yang bisa merusak karakter lain).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

const FOLDER_APP = process.env.APP_DIR || "/var/www/ayotka-app";
const NAMA_PM2 = "ayotka-app";
const PANJANG_MIN_SIDIK = 20;

const DAFTAR_AMAN = new Set([
  "NODE_ENV", "PORT", "HOSTNAME", "TZ", "LANG", "NODE_OPTIONS", "NEXT_TELEMETRY_DISABLED",
  "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_APP_NAME", "NEXT_PUBLIC_SUPABASE_URL",
  "STORAGE_DRIVER", "MEDIA_DIR", "MEDIA_PUBLIC_BASE_URL", "GENERATOR_IMAGES_DIR", "GENERATOR_IMAGES_URL_PREFIX",
  "TUTOR_AI_URL", "TUTOR_AI_BATAS_HARIAN", "AI_MODEL", "DATABASE_CONNECTION_LIMIT",
  "PAYMENT_MODE", "MAINTENANCE_MODE", "MIDTRANS_IS_PRODUCTION",
  "RESEND_FROM_EMAIL", "MAILKETING_FROM_EMAIL", "EMAIL_SMTP_HOST", "EMAIL_SMTP_PORT",
  "AI_QUEUE_MAX_CONCURRENT", "AI_QUEUE_RATE_PER_SECOND",
  "LOGIN_FAIL_LIMIT_PER_IP", "LOGIN_FAIL_LIMIT_PER_ACCOUNT", "LOGIN_MAX_PER_IP",
  "LOKAL_TERHUBUNG_PRODUKSI", "SUPABASE_ADMIN_TUNNEL_URL",
]);

// Variabel proses yang relevan untuk aplikasi (sisanya, mis. PATH/HOME/LS_COLORS, tidak dilaporkan sama sekali).
const POLA_NAMA_APLIKASI = /^(NODE_ENV|NODE_OPTIONS|TZ|LANG|PORT|HOSTNAME|NEXT_|DATABASE_|DIRECT_URL|SUPABASE_|STORAGE_|MEDIA_|GENERATOR_|AI_|TUTOR_|MIDTRANS_|PAYMENT_|MAINTENANCE_|RESEND_|MAILKETING_|EMAIL_|CRON_|APP_|SOAL_|SEED_|REDIS_|LOGIN_|LOKAL_)/;

function sidik(nilai) {
  return createHash("sha256").update(nilai).digest("hex").slice(0, 10);
}

/** Alamat dengan kredensial (scheme://user:sandi@host/db?x=1) -> tanpa kredensial dan hanya nama parameter. */
function sanitasiUrl(v) {
  try {
    const u = new URL(v);
    const q = [...u.searchParams.keys()].join(",");
    return u.protocol + "//" + (u.username ? u.username + ":***@" : "") + u.host + (u.pathname === "/" ? "" : u.pathname) + (q ? "?" + q : "");
  } catch {
    return "(alamat tidak terbaca)";
  }
}

function ringkasNilai(nama, nilai) {
  const r = { panjang: nilai.length };
  if (nilai === "") { r.kosong = true; return r; }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(nilai) && (nilai.includes("@") || !DAFTAR_AMAN.has(nama))) { r.url = sanitasiUrl(nilai); return r; }
  if (DAFTAR_AMAN.has(nama)) { r.nilai = nilai; return r; }
  if (/PASS/i.test(nama)) return r;
  if (nilai.length >= PANJANG_MIN_SIDIK) r.sidik = sidik(nilai);
  return r;
}

function coba(fn) {
  try { return fn(); } catch (e) { return { galat: String(e && e.message ? e.message : e).split("\n")[0].slice(0, 160) }; }
}

function jalankan(cmd, args, opsi = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000, ...opsi }).trim();
}

/** KEY=VALUE sederhana (tanda kutip pembungkus dibuang). Perluasan ${VAR} tidak dijalankan; ditandai saja. */
function bacaBerkasEnv(jalur) {
  const hasil = {};
  const teks = fs.readFileSync(jalur, "utf8");
  for (const baris of teks.split(/\r?\n/)) {
    const m = baris.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    hasil[m[1]] = v;
  }
  return hasil;
}

function bacaPaket(nama) {
  const jalur = FOLDER_APP + "/node_modules/" + nama + "/package.json";
  return JSON.parse(fs.readFileSync(jalur, "utf8")).version;
}

function maskaBaris(b) {
  return b
    .replace(/(Bearer\s+)\S+/gi, "$1***")
    .replace(/((?:SECRET|TOKEN|KEY|PASS\w*|AUTH\w*)\s*[=:]\s*)[^\s"']+/gi, "$1***")
    .replace(/(-H\s+["']?Authorization:\s*)[^"'\n]+/gi, "$1***");
}

const keluaran = { dicatatPada: new Date().toISOString(), versiSkrip: 1 };

// --- Server dan runtime Node ---
keluaran.server = coba(() => ({
  os: os.type() + " " + os.release() + " " + os.arch(),
  node: process.version,
  v8: process.versions.v8,
  icu: process.versions.icu,
  unicode: process.versions.unicode,
  basisDataZonaWaktuNode: process.versions.tz,
  zonaWaktu: Intl.DateTimeFormat().resolvedOptions().timeZone,
  selisihUtcMenit: new Date().getTimezoneOffset(),
  tzEnv: process.env.TZ || null,
  bahasaIntl: Intl.DateTimeFormat().resolvedOptions().locale,
  ramMB: Math.round(os.totalmem() / 1048576),
  cpu: os.cpus().length,
  npm: coba(() => jalankan("npm", ["-v"])),
  pm2: coba(() => jalankan("pm2", ["-v"])),
  nginx: coba(() => {
    try { return jalankan("nginx", ["-v"]); } catch (e) { return String((e.stderr || e.message || "")).trim().split("\n")[0]; }
  }),
}));

// --- Kode ---
keluaran.kode = coba(() => {
  const git = (...a) => jalankan("git", ["-C", FOLDER_APP, ...a]);
  const folderMigrasi = FOLDER_APP + "/prisma/migrations";
  const migrasi = fs.readdirSync(folderMigrasi).filter((n) => /^\d{14}_/.test(n)).sort();
  const buildId = coba(() => fs.readFileSync(FOLDER_APP + "/.next/BUILD_ID", "utf8").trim());
  const waktuBuild = coba(() => fs.statSync(FOLDER_APP + "/.next/BUILD_ID").mtime.toISOString());
  return {
    folder: FOLDER_APP,
    sha: git("rev-parse", "HEAD"),
    cabang: git("rev-parse", "--abbrev-ref", "HEAD"),
    tanggalCommit: git("log", "-1", "--format=%cI"),
    berkasBerubahDiServer: git("status", "--porcelain").split("\n").filter(Boolean).slice(0, 20),
    jumlahMigrasi: migrasi.length,
    migrasiTerakhir: migrasi[migrasi.length - 1] || null,
    buildId,
    waktuBuild,
  };
});

keluaran.paket = {};
for (const p of ["next", "react", "react-dom", "@prisma/client", "prisma", "@supabase/supabase-js", "@supabase/ssr", "@supabase/auth-js", "zod", "typescript"]) {
  keluaran.paket[p] = coba(() => bacaPaket(p));
}

// --- Proses pm2 ---
let pidAplikasi = null;
keluaran.pm2 = coba(() => {
  const daftar = JSON.parse(jalankan("pm2", ["jlist"], { maxBuffer: 20 * 1024 * 1024 }));
  return daftar.map((p) => {
    const e = p.pm2_env || {};
    if (p.name === NAMA_PM2) pidAplikasi = p.pid;
    return {
      nama: p.name,
      status: e.status,
      mode: e.exec_mode,
      instance: e.instances,
      nodeDipakai: e.node_version,
      folder: e.pm_cwd,
      skrip: e.pm_exec_path,
      argumen: e.args,
      restart: e.restart_time,
      mulai: e.pm_uptime ? new Date(e.pm_uptime).toISOString() : null,
      memoriMB: p.monit ? Math.round(p.monit.memory / 1048576) : null,
    };
  });
});

// --- Variabel lingkungan efektif: awal proses (pm2/shell) menang atas berkas .env, seperti Next.js ---
keluaran.env = coba(() => {
  // Urutan Next.js untuk NODE_ENV=production; yang lebih awal menang.
  const urutan = [".env.production.local", ".env.local", ".env.production", ".env"];
  const dariBerkas = {};
  const berkasTerbaca = [];
  for (const nama of urutan) {
    const jalur = FOLDER_APP + "/" + nama;
    if (!fs.existsSync(jalur)) continue;
    berkasTerbaca.push(nama);
    const isi = bacaBerkasEnv(jalur);
    for (const [k, v] of Object.entries(isi)) if (!(k in dariBerkas)) dariBerkas[k] = { v, sumber: nama };
  }
  let awal = {};
  let sumberAwal = "tidak terbaca";
  if (pidAplikasi) {
    const hasilProc = coba(() => {
      const mentah = fs.readFileSync("/proc/" + pidAplikasi + "/environ", "utf8");
      const o = {};
      for (const pasang of mentah.split("\0")) {
        const i = pasang.indexOf("=");
        if (i > 0) o[pasang.slice(0, i)] = pasang.slice(i + 1);
      }
      return o;
    });
    if (!hasilProc.galat) { awal = hasilProc; sumberAwal = "proses pm2 (pid " + pidAplikasi + ")"; }
    else sumberAwal = "proses pm2 tidak terbaca: " + hasilProc.galat;
  }
  const efektif = {};
  const nama = new Set([...Object.keys(dariBerkas), ...Object.keys(awal).filter((k) => POLA_NAMA_APLIKASI.test(k))]);
  for (const k of [...nama].sort()) {
    if (k in awal && POLA_NAMA_APLIKASI.test(k)) efektif[k] = { sumber: "proses", ...ringkasNilai(k, awal[k]) };
    else efektif[k] = { sumber: dariBerkas[k].sumber, ...ringkasNilai(k, dariBerkas[k].v) };
    if (k in dariBerkas && /\$\{/.test(dariBerkas[k].v)) efektif[k].memakaiRujukan = true;
  }
  return { berkasDibaca: berkasTerbaca, sumberProses: sumberAwal, variabel: efektif };
});

// --- Cron (hanya baris perintah; token disamarkan) ---
keluaran.cron = {};
for (const berkas of ["/etc/cron.d/ayotka", "/etc/cron.d/ayotka-backup"]) {
  keluaran.cron[berkas] = coba(() =>
    fs.readFileSync(berkas, "utf8").split(/\r?\n/).map((b) => b.trim()).filter((b) => b && !b.startsWith("#")).map(maskaBaris),
  );
}

// --- Nginx untuk ayotka.id: hanya arahan yang memengaruhi perilaku aplikasi ---
keluaran.nginx = coba(() => {
  const kandidat = ["/etc/nginx/sites-enabled/ayotka.id", "/etc/nginx/snippets/ayotka-selfhost.conf"];
  const arahan = /^(server_name|listen|client_max_body_size|gzip\w*|proxy_read_timeout|proxy_send_timeout|proxy_connect_timeout|keepalive_timeout|add_header|expires|allow|deny|location|proxy_pass|proxy_set_header|return|rewrite|http2|ssl_protocols|limit_req\w*|limit_conn\w*)\b/;
  const hasil = {};
  for (const jalur of kandidat) {
    hasil[jalur] = coba(() =>
      fs.readFileSync(jalur, "utf8").split(/\r?\n/).map((b) => b.trim()).filter((b) => arahan.test(b) && !/secret|token|passw|api_?key/i.test(b)).slice(0, 80),
    );
  }
  return hasil;
});

// --- Wadah Docker (hanya nama dan image; sering butuh izin grup docker) ---
keluaran.docker = coba(() => {
  const baris = jalankan("docker", ["ps", "--format", "{{.Names}}|{{.Image}}|{{.Status}}"]).split("\n").filter(Boolean);
  return baris.map((b) => { const [nama, image, status] = b.split("|"); return { nama, image, status }; });
});

process.stdout.write(JSON.stringify(keluaran, null, 2) + "\n");
