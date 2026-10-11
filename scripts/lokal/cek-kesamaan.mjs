#!/usr/bin/env node
// Pemeriksa kesamaan komputer lokal dengan PRODUKSI (ayotka.id). Hanya membaca; tidak mengubah apa pun.
//
//   npm run lokal:cek                  kode, runtime, konfigurasi, sambungan, dan perilaku halaman (tanpa menyentuh data)
//   npm run lokal:cek -- --db          + pemeriksaan database produksi (SELECT/GET saja: status migrasi, jumlah baris, format media)
//   npm run lokal:cek -- --lokal=http://localhost:3100   periksa server dev di port lain
//   npm run lokal:cek -- --tanpa-jaringan                lewati GitHub dan perbandingan halaman
//
// Hasil tiap butir: SAMA (identik), WAJAR (beda tetapi memang begitu dan ada alasannya), CEK (perlu dilihat manusia),
// BEDA (harus dibereskan), INFO (keterangan). Kode keluar 1 bila ada BEDA.
// Penjelasan lengkap: deploy/lokal/KESAMAAN-LOKAL-PRODUKSI.md
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const requireDariProyek = createRequire(path.join(AKAR, "package.json"));

const REPO_GITHUB = "firerzaadit-prog/ayotka-app";
const NAMA_WORKFLOW_DEPLOY = "Deploy ayotka.id to VPS";
const URL_PRODUKSI = "https://ayotka.id";
const BERKAS_REFERENSI = path.join(AKAR, "deploy", "lokal", "produksi-referensi.json");

// ---------------------------------------------------------------------------------------------------------------
// Aturan
// ---------------------------------------------------------------------------------------------------------------

/** Variabel yang BOLEH beda dari server, dengan alasannya. Selain ini, beda = BEDA. */
export const PERBEDAAN_WAJAR = {
  NODE_ENV: "komputer lokal menjalankan next dev (development); server menjalankan next start (production)",
  DATABASE_URL: "lokal mencapai database produksi lewat terowongan SSH (127.0.0.1:5433), bukan langsung di server",
  DIRECT_URL: "lokal mencapai database produksi lewat terowongan SSH (127.0.0.1:5433), bukan langsung di server",
  SOAL_SOURCE_DATABASE_URL: "server memakai peran baca-saja ayotka_app_reader; lokal memakai alamat terowongan yang sama dengan DATABASE_URL",
  MEDIA_DIR: "folder media ada di disk server; di komputer lokal tidak ada (unggahan dimatikan oleh penjaga)",
  GENERATOR_IMAGES_DIR: "folder gambar generator ada di disk server; tanpa itu impor mengunduh gambar lewat HTTP dari alamat publiknya",
  PORT: "port server dev berbeda dengan server",
  HOSTNAME: "nama host proses berbeda",
  LANG: "bahasa sistem operasi berbeda",
  NODE_OPTIONS: "opsi proses berbeda",
};

/** Variabel yang memang hanya ada di lokal (alat bantu). */
export const HANYA_LOKAL = new Set(["LOKAL_TERHUBUNG_PRODUKSI", "SUPABASE_ADMIN_TUNNEL_URL", "SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD"]);

/** Nama yang ditemukan di kode tetapi bukan konfigurasi aplikasi. */
const ABAIKAN_NAMA_KODE = new Set(["VITEST", "CI", "NEXT_RUNTIME", "NEXT_PHASE"]);

/** Nilai yang aman dicetak apa adanya (bukan rahasia). Harus sama dengan DAFTAR_AMAN di cetak-konfigurasi.mjs. */
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

const POLA_NAMA_APLIKASI = /^(NODE_ENV|NODE_OPTIONS|TZ|LANG|PORT|HOSTNAME|NEXT_|DATABASE_|DIRECT_URL|SUPABASE_|STORAGE_|MEDIA_|GENERATOR_|AI_|TUTOR_|MIDTRANS_|PAYMENT_|MAINTENANCE_|RESEND_|MAILKETING_|EMAIL_|CRON_|APP_|SOAL_|SEED_|REDIS_|LOGIN_|LOKAL_)/;
const PANJANG_MIN_SIDIK = 20;

/** Berkas yang sengaja berbeda dari produksi karena itulah alat kesamaan ini. Jalur diawali / sama persis. */
export const ALAT_LOKAL = [
  "scripts/lokal/",
  "deploy/lokal/",
  "deploy/self-host/skrip/cetak-konfigurasi.mjs",
  "lib/supabase/admin-terowongan.ts",
  "lib/supabase/admin.ts",
  "lib/storage/media-lokal.ts",
  "tests/unit/admin-terowongan.test.ts",
  "tests/unit/penyimpanan-lokal.test.ts",
  "tests/unit/cetak-konfigurasi.test.ts",
  "tests/unit/cek-kesamaan.test.ts",
  ".env.example",
  "package.json",
];

// ---------------------------------------------------------------------------------------------------------------
// Fungsi murni (diuji di tests/unit/cek-kesamaan.test.ts)
// ---------------------------------------------------------------------------------------------------------------

/** Sidik-jari nilai rahasia: 10 heksadesimal pertama sha256. Harus sama dengan cetak-konfigurasi.mjs. */
export function sidik(nilai) {
  return createHash("sha256").update(nilai).digest("hex").slice(0, 10);
}

/** Alamat dengan kredensial -> tanpa kredensial dan hanya nama parameter (sama dengan sanitasiUrl di cetak-konfigurasi.mjs). */
export function ringkasUrl(v) {
  try {
    const u = new URL(v);
    const q = [...u.searchParams.keys()].join(",");
    return u.protocol + "//" + (u.username ? u.username + ":***@" : "") + u.host + (u.pathname === "/" ? "" : u.pathname) + (q ? "?" + q : "");
  } catch {
    return "(alamat tidak terbaca)";
  }
}

/** Ringkasan sebuah nilai lokal dalam bentuk yang sama dengan keluaran cetak-konfigurasi.mjs. */
export function ringkasNilai(nama, nilai) {
  const r = { panjang: nilai.length };
  if (nilai === "") { r.kosong = true; return r; }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(nilai) && (nilai.includes("@") || !DAFTAR_AMAN.has(nama))) { r.url = ringkasUrl(nilai); return r; }
  if (DAFTAR_AMAN.has(nama)) { r.nilai = nilai; return r; }
  if (/PASS/i.test(nama)) return r;
  if (nilai.length >= PANJANG_MIN_SIDIK) r.sidik = sidik(nilai);
  return r;
}

/**
 * Bandingkan satu variabel. `lokal` string | undefined; `ref` ringkasan dari server | undefined.
 * Mengembalikan null bila tidak ada yang perlu dilaporkan (tidak ada di kedua sisi).
 */
export function bandingkanVariabel(nama, lokal, ref) {
  const alasan = PERBEDAAN_WAJAR[nama];
  const beda = (catatan) => ({ status: alasan ? "WAJAR" : "BEDA", catatan: alasan ? `${catatan} - ${alasan}` : catatan });

  if (lokal === undefined && !ref) return null;
  if (lokal !== undefined && !ref) {
    return { status: "INFO", catatan: HANYA_LOKAL.has(nama) ? "alat bantu lokal (tidak ada di server, memang begitu)" : "ada di lokal, tidak ada di server" };
  }
  if (lokal === undefined) return beda("ada di server, tidak ada di lokal");

  const l = ringkasNilai(nama, lokal);
  if (ref.kosong) return l.kosong ? { status: "SAMA", catatan: "kosong di keduanya" } : beda("kosong di server, terisi di lokal");
  if (l.kosong) return beda("terisi di server, kosong di lokal");
  if (ref.nilai !== undefined) {
    return ref.nilai === lokal ? { status: "SAMA", catatan: ref.nilai } : beda(`server: ${ref.nilai} | lokal: ${lokal}`);
  }
  if (ref.url !== undefined) {
    return l.url === ref.url ? { status: "SAMA", catatan: ref.url } : beda(`server: ${ref.url} | lokal: ${l.url ?? "(bukan alamat)"}`);
  }
  if (ref.sidik !== undefined) {
    return l.sidik === ref.sidik ? { status: "SAMA", catatan: "isi sama (sidik-jari cocok)" } : beda("isi BERBEDA (sidik-jari tidak cocok)");
  }
  // Hanya panjang yang tersedia (mis. kata sandi atau nilai pendek).
  return l.panjang === ref.panjang
    ? { status: "CEK", catatan: `panjang sama (${ref.panjang}); isinya sengaja tidak dibandingkan` }
    : beda(`panjang berbeda (server ${ref.panjang}, lokal ${l.panjang})`);
}

/** Satu zona waktu ke bentuk baku supaya "UTC", "Etc/UTC", "GMT" dianggap sama. */
export function normalisasiZona(z) {
  if (!z) return null;
  const s = String(z).trim();
  return /^(utc|etc\/utc|gmt|etc\/gmt|z|universal|etc\/universal|zulu)$/i.test(s) ? "UTC" : s;
}

/**
 * Baris `git status --porcelain` -> { alat: [...], lain: [...] } menurut daftar ALAT_LOKAL.
 * Tahan terhadap baris pertama yang spasi depannya sudah terpotong (" M x" menjadi "M x"): status dan jalur dipisah
 * dengan pola, bukan dengan posisi tetap.
 */
export function kelompokkanPerubahan(barisPorcelain) {
  const alat = [];
  const lain = [];
  for (const baris of barisPorcelain) {
    const m = baris.match(/^\s*(\S{1,2})\s+(.+?)\s*$/);
    if (!m) continue;
    const [, status, sisa] = m;
    let jalur = sisa;
    if (jalur.includes(" -> ")) jalur = jalur.split(" -> ").pop();
    jalur = jalur.replace(/^"|"$/g, "");
    const milikAlat = ALAT_LOKAL.some((a) => (a.endsWith("/") ? jalur.startsWith(a) : jalur === a));
    (milikAlat ? alat : lain).push(`${status} ${jalur}`);
  }
  return { alat, lain };
}

/** Skema Prisma tanpa beda spasi/perataan kolom dan akhir baris, untuk dibandingkan dengan salinan di klien yang dibangkitkan. */
export function normalisasiSkema(teks) {
  return teks
    .replace(/\r/g, "")
    .split("\n")
    .map((b) => b.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Deploy BERHASIL terakhir dari daftar proses GitHub Actions (itulah yang berjalan di server). */
export function pilihDeployTerakhir(runs) {
  const daftar = (runs?.workflow_runs ?? [])
    .filter((r) => r.name === NAMA_WORKFLOW_DEPLOY && r.conclusion === "success" && r.head_branch === "main")
    .sort((a, b) => String(b.run_started_at ?? b.created_at).localeCompare(String(a.run_started_at ?? a.created_at)));
  return daftar[0] ?? null;
}

/** Baris perintah ssh -> daftar penerusan port (-L). */
export function parseTerowonganSsh(baris) {
  const hasil = [];
  const pola = /-L\s*(?:(?:\[[^\]]+\]|[^\s:]+):)?(\d+):(\[[^\]]+\]|[^\s:]+):(\d+)/g;
  let m;
  while ((m = pola.exec(baris)) !== null) hasil.push({ portLokal: Number(m[1]), hostTujuan: m[2], portTujuan: Number(m[3]) });
  const server = baris.match(/(?:^|\s)((?:[\w.-]+@)?[\w.-]+\.[\w.-]+|[\w.-]+@[\w.-]+)\s*"?$/)?.[1] ?? null;
  return { penerusan: hasil, server };
}

/** Ringkasan isi halaman HTML untuk dibandingkan antar lingkungan (judul, deskripsi, tautan internal, judul bagian). */
export function ringkasHalaman(html) {
  const bersih = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const judul = (bersih.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  let deskripsi = "";
  for (const m of bersih.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    if (/\bname=["']description["']/i.test(tag)) deskripsi = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? "";
  }
  const tautan = [
    ...new Set(
      [...bersih.matchAll(/<a\b[^>]*?\bhref=["']([^"']+)["']/gi)]
        .map((m) => m[1])
        .filter((h) => h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/_next")),
    ),
  ].sort();
  const bagian = [...bersih.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => m[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return { judul, deskripsi, tautan, bagian };
}

/** Selisih dua ringkasan halaman -> daftar kalimat (kosong = sama). */
export function bandingkanRingkasan(prod, lokal) {
  const beda = [];
  if (prod.judul !== lokal.judul) beda.push(`judul: produksi "${prod.judul}" | lokal "${lokal.judul}"`);
  if (prod.deskripsi !== lokal.deskripsi) beda.push(`deskripsi meta berbeda`);
  const hanyaProd = prod.tautan.filter((t) => !lokal.tautan.includes(t));
  const hanyaLokal = lokal.tautan.filter((t) => !prod.tautan.includes(t));
  if (hanyaProd.length) beda.push(`tautan hanya di produksi: ${hanyaProd.join(", ")}`);
  if (hanyaLokal.length) beda.push(`tautan hanya di lokal: ${hanyaLokal.join(", ")}`);
  const bProd = prod.bagian.join(" | ");
  const bLokal = lokal.bagian.join(" | ");
  if (bProd !== bLokal) {
    const hp = prod.bagian.filter((t) => !lokal.bagian.includes(t));
    const hl = lokal.bagian.filter((t) => !prod.bagian.includes(t));
    beda.push(`judul bagian berbeda${hp.length ? `; hanya di produksi: ${hp.slice(0, 3).join(" / ")}` : ""}${hl.length ? `; hanya di lokal: ${hl.slice(0, 3).join(" / ")}` : ""}`);
  }
  return beda;
}

// ---------------------------------------------------------------------------------------------------------------
// Pengumpul hasil dan pencetak
// ---------------------------------------------------------------------------------------------------------------

const hitung = { SAMA: 0, WAJAR: 0, CEK: 0, BEDA: 0, INFO: 0 };
function lapor(status, judul, detail) {
  hitung[status]++;
  const label = status.padEnd(5);
  console.log(`  [${label}] ${judul}${detail ? `\n           ${String(detail).split("\n").join("\n           ")}` : ""}`);
}
function bagian(nama) {
  console.log(`\n=== ${nama} ===`);
}

// ---------------------------------------------------------------------------------------------------------------
// Pembantu sistem
// ---------------------------------------------------------------------------------------------------------------

function git(...args) {
  return execFileSync("git", ["-C", AKAR, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function gitCoba(...args) {
  try { return git(...args); } catch { return null; }
}
/** Seperti gitCoba tetapi TANPA memangkas spasi (baris pertama `status --porcelain` diawali spasi yang bermakna). */
function gitMentah(...args) {
  try { return execFileSync("git", ["-C", AKAR, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch { return null; }
}

function bukaPort(host, port, ms = 1500) {
  return new Promise((selesai) => {
    const s = net.connect({ host, port });
    const t = setTimeout(() => { s.destroy(); selesai(false); }, ms);
    s.once("connect", () => { clearTimeout(t); s.end(); selesai(true); });
    s.once("error", () => { clearTimeout(t); selesai(false); });
  });
}

async function ambil(url, opsi = {}, ms = 20000) {
  return fetch(url, { redirect: "manual", ...opsi, headers: { "user-agent": "ayotka-lokal-cek", ...(opsi.headers ?? {}) }, signal: AbortSignal.timeout(ms) });
}

function bacaReferensi() {
  try { return JSON.parse(fs.readFileSync(BERKAS_REFERENSI, "utf8")); } catch { return null; }
}

/** Baris perintah semua proses ssh yang sedang jalan. null = daftar proses tidak bisa dibaca (jangan disimpulkan "tidak ada"). */
function barisProsesSsh() {
  try {
    if (process.platform === "win32") {
      // PowerShell di PC yang RAM-nya hampir habis bisa butuh puluhan detik hanya untuk mulai.
      const keluar = execFileSync(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-Command", "Get-CimInstance Win32_Process -Filter \"Name='ssh.exe'\" | Select-Object -ExpandProperty CommandLine"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 90000 },
      );
      return keluar.split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
    }
    const keluar = execFileSync("ps", ["-eo", "args="], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return keluar.split("\n").map((b) => b.trim()).filter((b) => /^(\S*\/)?ssh\s/.test(b));
  } catch {
    return null;
  }
}

/** Env efektif untuk server dev (urutan Next.js; variabel shell menang atas berkas). */
function bacaEnvLokal() {
  const { loadEnvConfig } = requireDariProyek("@next/env");
  const { parsedEnv, loadedEnvFiles } = loadEnvConfig(AKAR, true, { info() {}, error() {} });
  const sumber = {};
  for (const f of loadedEnvFiles) {
    for (const baris of String(f.contents ?? "").split(/\r?\n/)) {
      const m = baris.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (m && !(m[1] in sumber)) sumber[m[1]] = path.basename(f.path);
    }
  }
  const nilai = { ...parsedEnv };
  for (const [k, v] of Object.entries(process.env)) {
    if (POLA_NAMA_APLIKASI.test(k) && v !== undefined && !(k in parsedEnv)) { nilai[k] = v; sumber[k] = "shell"; }
  }
  return { nilai, sumber, berkas: loadedEnvFiles.map((f) => path.basename(f.path)) };
}

function namaEnvDiKode() {
  const nama = new Set();
  const pola = [/process\.env\.([A-Z][A-Z0-9_]+)/g, /\benv\.([A-Z][A-Z0-9_]{3,})/g];
  const telusuri = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const jalur = path.join(dir, e.name);
      if (e.isDirectory()) telusuri(jalur);
      else if (/\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) {
        const teks = fs.readFileSync(jalur, "utf8");
        for (const p of pola) for (const m of teks.matchAll(p)) nama.add(m[1]);
      }
    }
  };
  for (const d of ["app", "components", "lib"]) if (fs.existsSync(path.join(AKAR, d))) telusuri(path.join(AKAR, d));
  for (const f of ["proxy.ts", "next.config.ts"]) {
    const jalur = path.join(AKAR, f);
    if (fs.existsSync(jalur)) { const teks = fs.readFileSync(jalur, "utf8"); for (const p of pola) for (const m of teks.matchAll(p)) nama.add(m[1]); }
  }
  for (const n of ABAIKAN_NAMA_KODE) nama.delete(n);
  return nama;
}

function versiPaket(nama) {
  try { return JSON.parse(fs.readFileSync(path.join(AKAR, "node_modules", nama, "package.json"), "utf8")).version; } catch { return null; }
}

// ---------------------------------------------------------------------------------------------------------------
// Pemeriksaan
// ---------------------------------------------------------------------------------------------------------------

async function periksaKode(opsi, ref) {
  bagian("1. KODE (apa yang dijalankan)");
  const head = gitCoba("rev-parse", "HEAD");
  const cabang = gitCoba("rev-parse", "--abbrev-ref", "HEAD");
  if (!head) { lapor("CEK", "git tidak bisa dibaca di folder ini"); return; }
  lapor("INFO", `Lokal: cabang ${cabang}, commit ${head.slice(0, 7)} (${gitCoba("log", "-1", "--format=%s", "HEAD")})`);

  if (opsi.tanpaJaringan) {
    lapor("CEK", "Deploy terakhir di server tidak dibandingkan (--tanpa-jaringan)");
  } else {
    try {
      const respons = await ambil(`https://api.github.com/repos/${REPO_GITHUB}/actions/runs?branch=main&per_page=50`, { headers: { accept: "application/vnd.github+json" } });
      if (!respons.ok) throw new Error(`GitHub menjawab ${respons.status}`);
      const runs = await respons.json();
      const deploy = pilihDeployTerakhir(runs);
      const terbaru = (runs.workflow_runs ?? []).find((r) => r.name === NAMA_WORKFLOW_DEPLOY);
      if (!deploy) {
        lapor("CEK", "Tidak menemukan deploy yang berhasil di 50 proses terakhir GitHub Actions");
      } else {
        const sha = deploy.head_sha;
        const waktu = new Date(deploy.updated_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
        if (terbaru && terbaru.id !== deploy.id && terbaru.conclusion !== "success") {
          lapor("CEK", `Deploy terbaru di GitHub belum sukses (${terbaru.status}/${terbaru.conclusion ?? "berjalan"}, commit ${terbaru.head_sha.slice(0, 7)}); yang berjalan di server tetap commit ${sha.slice(0, 7)}`);
        }
        if (head === sha) {
          lapor("SAMA", `Commit lokal = commit yang berjalan di server (${sha.slice(0, 7)}, deploy ${waktu} WIB)`);
        } else if (gitCoba("rev-parse", "--verify", "--quiet", `${sha}^{commit}`) === null) {
          lapor("CEK", `Server menjalankan ${sha.slice(0, 7)} yang belum ada di salinan lokal - jalankan: git fetch`);
        } else {
          const lokalDiDepan = gitCoba("rev-list", "--count", `${sha}..HEAD`);
          const serverDiDepan = gitCoba("rev-list", "--count", `HEAD..${sha}`);
          if (serverDiDepan && Number(serverDiDepan) > 0 && Number(lokalDiDepan ?? 0) === 0) {
            lapor("BEDA", `Lokal TERTINGGAL ${serverDiDepan} commit dari server (server ${sha.slice(0, 7)}, lokal ${head.slice(0, 7)})`, "Perbaiki: git pull");
          } else if (Number(lokalDiDepan ?? 0) > 0 && Number(serverDiDepan ?? 0) === 0) {
            const daftar = gitCoba("log", "--format=%h %s", `${sha}..HEAD`) ?? "";
            lapor("BEDA", `Lokal LEBIH MAJU ${lokalDiDepan} commit dari server (belum di-push / belum dideploy)`, daftar);
          } else {
            lapor("BEDA", `Riwayat lokal dan server bercabang (lokal +${lokalDiDepan}, server +${serverDiDepan})`);
          }
        }
        if (ref?.kode?.sha && ref.kode.sha !== sha) {
          lapor("CEK", `Referensi produksi direkam saat server di commit ${ref.kode.sha.slice(0, 7)}, sedangkan deploy terakhir ${sha.slice(0, 7)}: rekam ulang bila perlu`);
        }
      }
    } catch (e) {
      lapor("CEK", `Deploy terakhir di server tidak bisa dibaca dari GitHub (${e.message})`);
    }
  }

  const status = (gitMentah("status", "--porcelain") ?? "").split("\n");
  const { alat, lain } = kelompokkanPerubahan(status);
  if (lain.length) {
    lapor("BEDA", `${lain.length} berkas berubah/baru di folder lokal yang BUKAN alat kesamaan (kode lokal tidak sama dengan commit)`, lain.slice(0, 25).join("\n"));
  } else if (alat.length) {
    lapor("WAJAR", `${alat.length} berkas alat kesamaan belum di-commit (tidak mengubah perilaku aplikasi; inert tanpa env khusus)`, alat.slice(0, 25).join("\n"));
  } else {
    lapor("SAMA", "Folder kerja bersih: tidak ada perubahan yang belum di-commit");
  }
  const cabangWip = (gitCoba("branch", "--list", "wip/*") ?? "").split("\n").map((b) => b.replace("*", "").trim()).filter(Boolean);
  if (cabangWip.length) lapor("INFO", `Cabang cadangan lokal (tidak di-push, tidak ikut berjalan): ${cabangWip.join(", ")}`);
}

function periksaRuntime(env, ref) {
  bagian("2. RUNTIME (Node, paket, skema Prisma)");
  const server = ref?.server;
  const nodeLokal = process.version;
  if (!server?.node) {
    lapor("CEK", `Node lokal ${nodeLokal}; versi Node di server belum direkam`);
  } else if (server.node === nodeLokal) {
    lapor("SAMA", `Node ${nodeLokal}`);
  } else if (server.node.split(".")[0] === nodeLokal.split(".")[0]) {
    lapor("CEK", `Node server ${server.node}, lokal ${nodeLokal} (utama sama; beda minor/patch)`);
  } else {
    lapor("BEDA", `Node server ${server.node}, lokal ${nodeLokal}`, "Beda versi utama bisa mengubah format tanggal/Intl dan perilaku fetch. Samakan (mis. nvm-windows/Volta).");
  }

  const zonaEfektif = normalisasiZona(env.nilai.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const zonaServer = normalisasiZona(server?.tzEnv ?? server?.zonaWaktu);
  if (!zonaServer) {
    lapor("CEK", `Zona waktu server dev: ${zonaEfektif}; zona waktu server produksi belum direkam`);
  } else if (zonaEfektif === zonaServer) {
    lapor("SAMA", `Zona waktu proses Node: ${zonaEfektif}`);
  } else {
    lapor("BEDA", `Zona waktu server ${zonaServer}, lokal ${zonaEfektif}`, `Tanggal/jam yang dihitung di sisi server akan bergeser. Perbaiki: tambahkan TZ=${zonaServer === "UTC" ? "UTC" : zonaServer} di .env.local lalu mulai ulang npm run dev.`);
  }

  const dipantau = ["next", "react", "react-dom", "@prisma/client", "prisma", "@supabase/supabase-js", "@supabase/ssr", "@supabase/auth-js", "zod", "typescript"];
  const beda = [];
  let sama = 0;
  for (const p of dipantau) {
    const lokal = versiPaket(p);
    const srv = server && ref.paket ? ref.paket[p] : undefined;
    if (!srv || typeof srv !== "string") continue;
    if (lokal === srv) sama++;
    else beda.push(`${p}: server ${srv}, lokal ${lokal ?? "tidak terpasang"}`);
  }
  if (!ref?.paket) lapor("CEK", "Versi paket server belum direkam");
  else if (beda.length) lapor("BEDA", `${beda.length} paket berbeda versi dari server`, `${beda.join("\n")}\nPerbaiki: npm ci (atau npm install) di folder ini.`);
  else lapor("SAMA", `${sama} paket utama berversi sama dengan server (next ${versiPaket("next")}, prisma ${versiPaket("prisma")}, supabase-js ${versiPaket("@supabase/supabase-js")})`);

  try {
    const skemaRepo = fs.readFileSync(path.join(AKAR, "prisma", "schema.prisma"), "utf8");
    const jalurKlien = path.join(AKAR, "node_modules", ".prisma", "client", "schema.prisma");
    if (!fs.existsSync(jalurKlien)) lapor("BEDA", "Klien Prisma belum dibangkitkan", "Perbaiki: npx prisma generate");
    else if (normalisasiSkema(skemaRepo) === normalisasiSkema(fs.readFileSync(jalurKlien, "utf8"))) lapor("SAMA", "Klien Prisma yang terpasang cocok dengan prisma/schema.prisma");
    else lapor("BEDA", "Klien Prisma yang terpasang BERBEDA dari prisma/schema.prisma", "Perbaiki: npx prisma generate, lalu mulai ulang npm run dev.");
  } catch (e) {
    lapor("CEK", `Skema Prisma tidak bisa dibandingkan (${e.message})`);
  }

  const migrasi = fs.readdirSync(path.join(AKAR, "prisma", "migrations")).filter((n) => /^\d{14}_/.test(n)).sort();
  const migrasiServer = ref?.kode;
  if (!migrasiServer?.jumlahMigrasi) lapor("INFO", `${migrasi.length} migrasi di folder lokal (jumlah di server belum direkam)`);
  else if (migrasi.length === migrasiServer.jumlahMigrasi && migrasi[migrasi.length - 1] === migrasiServer.migrasiTerakhir) lapor("SAMA", `${migrasi.length} migrasi, terakhir ${migrasi[migrasi.length - 1]}`);
  else lapor("CEK", `Migrasi: lokal ${migrasi.length} (terakhir ${migrasi[migrasi.length - 1]}), server ${migrasiServer.jumlahMigrasi} (terakhir ${migrasiServer.migrasiTerakhir})`, "Beda wajar bila server belum menerima commit terbaru.");
}

function periksaKonfigurasi(env, ref) {
  bagian("3. KONFIGURASI (variabel lingkungan)");
  lapor("INFO", `Berkas env yang dimuat (urutan prioritas): ${env.berkas.join(", ") || "(tidak ada)"}`);
  const nama = new Set([...namaEnvDiKode(), ...Object.keys(env.nilai).filter((k) => POLA_NAMA_APLIKASI.test(k))]);
  const refEnv = ref?.env?.variabel ?? null;
  if (refEnv) for (const k of Object.keys(refEnv)) nama.add(k);

  if (!refEnv) {
    lapor("CEK", "Referensi produksi belum direkam, jadi nilai tidak bisa dibandingkan. Rekam dengan: .\\scripts\\lokal\\ambil-konfigurasi-produksi.ps1");
    const tidakAda = [...namaEnvDiKode()].filter((k) => env.nilai[k] === undefined).sort();
    if (tidakAda.length) lapor("INFO", `Variabel yang dibaca kode tetapi tidak diisi di lokal (${tidakAda.length}): ${tidakAda.join(", ")}`);
    return;
  }
  lapor("INFO", `Referensi server direkam ${ref.dicatatPada} (sumber variabel server: ${ref.env.sumberProses}; berkas: ${ref.env.berkasDibaca.join(", ")})`);

  const sama = [];
  for (const k of [...nama].sort()) {
    const hasil = bandingkanVariabel(k, env.nilai[k], refEnv[k]);
    if (!hasil) continue;
    if (hasil.status === "SAMA") { sama.push(k); continue; }
    lapor(hasil.status, k, hasil.catatan);
  }
  lapor("SAMA", `${sama.length} variabel identik dengan server`, sama.join(", "));
}

async function periksaSambungan(env, ref, opsi) {
  bagian("4. SAMBUNGAN (database, login, media, efek samping)");
  const terhubungProduksi = ["true", "1"].includes(String(env.nilai.LOKAL_TERHUBUNG_PRODUKSI ?? "").trim().toLowerCase());

  // Database
  let urlDb = null;
  try { urlDb = new URL(env.nilai.DATABASE_URL); } catch { /* ditangani di bawah */ }
  if (!urlDb) {
    lapor("BEDA", "DATABASE_URL tidak ada atau tidak terbaca");
  } else {
    const port = Number(urlDb.port || 5432);
    const terbuka = await bukaPort(urlDb.hostname, port);
    const barisSsh = barisProsesSsh();
    const ssh = (barisSsh ?? []).map((b) => ({ baris: b, ...parseTerowonganSsh(b) }));
    const terowongan = ssh.flatMap((s) => s.penerusan.map((p) => ({ ...p, server: s.server }))).find((p) => p.portLokal === port);
    if (["127.0.0.1", "localhost", "::1", "[::1]"].includes(urlDb.hostname)) {
      if (barisSsh === null && terbuka) {
        lapor("CEK", `Database ${urlDb.host} terbuka, tetapi daftar proses ssh tidak bisa dibaca sehingga tidak bisa dipastikan itu terowongan ke server produksi`);
      } else if (terowongan) {
        lapor(terbuka ? "SAMA" : "BEDA", `Database: ${urlDb.host} adalah terowongan SSH ke ${terowongan.hostTujuan}:${terowongan.portTujuan} di ${terowongan.server ?? "server"} ${terbuka ? "(port terbuka)" : "(PORT TERTUTUP)"}`, terbuka ? "Data yang dibaca/ditulis aplikasi lokal = data produksi yang sama persis." : "Terowongan putus: jalankan .\\scripts\\lokal\\terowongan.ps1");
      } else if (terbuka) {
        lapor("BEDA", `Database ${urlDb.host} terbuka tetapi BUKAN terowongan SSH yang dikenali`, "Kemungkinan database lokal terpisah (data berbeda dari produksi).");
      } else {
        lapor("BEDA", `Database ${urlDb.host} tidak terjangkau`, "Terowongan SSH belum jalan: .\\scripts\\lokal\\terowongan.ps1");
      }
    } else {
      lapor("CEK", `Database langsung ke ${urlDb.host}`, terbuka ? "port terbuka" : "port tidak terjangkau");
    }
    if (terowongan && terowongan.hostTujuan && ref?.env?.variabel?.DATABASE_URL?.url) {
      lapor("INFO", `Alamat DATABASE_URL di server: ${ref.env.variabel.DATABASE_URL.url}`);
    }
  }

  // Login (GoTrue)
  const urlSb = env.nilai.NEXT_PUBLIC_SUPABASE_URL;
  const urlSbServer = ref?.env?.variabel?.NEXT_PUBLIC_SUPABASE_URL?.nilai ?? "https://ayotka.id/supabase";
  if (!urlSb) {
    lapor("BEDA", "NEXT_PUBLIC_SUPABASE_URL kosong");
  } else {
    lapor(urlSb === urlSbServer ? "SAMA" : "BEDA", `Alamat login (GoTrue): ${urlSb}${urlSb === urlSbServer ? "" : ` (server: ${urlSbServer})`}`);
    if (!opsi.tanpaJaringan) {
      try {
        const r = await ambil(`${urlSb.replace(/\/+$/, "")}/auth/v1/health`, {}, 15000);
        const j = await r.json().catch(() => ({}));
        const imageGotrue = ref?.docker?.find?.((d) => /gotrue|auth/.test(`${d.nama} ${d.image}`))?.image;
        lapor(r.ok ? "SAMA" : "BEDA", `Login produksi menjawab ${r.status}${j.version ? `, versi GoTrue ${j.version}` : ""}`, imageGotrue ? `Image di server: ${imageGotrue}` : null);
      } catch (e) {
        lapor("BEDA", `Login produksi tidak terjangkau (${e.message})`);
      }
      try {
        const r = await ambil(`${urlSb.replace(/\/+$/, "")}/auth/v1/admin/users?per_page=1`, {}, 15000);
        lapor("INFO", `API admin lewat alamat publik dari komputer ini: ${r.status}${r.status === 403 ? " (diblokir nginx, sama seperti untuk siapa pun di luar server)" : ""}`);
      } catch (e) {
        lapor("CEK", `API admin publik tidak bisa diuji (${e.message})`);
      }
    }
  }

  // Terowongan API admin
  const terowonganAdmin = env.nilai.SUPABASE_ADMIN_TUNNEL_URL?.trim();
  if (!terowonganAdmin) {
    lapor("BEDA", "API admin login tidak dialihkan (SUPABASE_ADMIN_TUNNEL_URL kosong)", "13 rute (buat admin sekolah, reset kata sandi, registrasi, lupa kata sandi, dst.) akan gagal 403 di lokal, padahal berjalan di produksi. Perbaiki: lihat deploy/lokal/KESAMAAN-LOKAL-PRODUKSI.md bagian 'Terowongan kedua'.");
  } else {
    try {
      const u = new URL(terowonganAdmin);
      const terbuka = await bukaPort(u.hostname, Number(u.port || 80));
      if (!terbuka) {
        lapor("BEDA", `Terowongan API admin ${u.host} tidak terjangkau`, "Mulai ulang terowongan dengan dua penerusan: .\\scripts\\lokal\\terowongan.ps1");
      } else {
        const r = await ambil(`${terowonganAdmin.replace(/\/+$/, "")}/health`, {}, 10000);
        const j = await r.json().catch(() => ({}));
        lapor(r.ok ? "SAMA" : "BEDA", `API admin login lewat terowongan ${u.host}: menjawab ${r.status}${j.version ? `, GoTrue ${j.version}` : ""}`);
        if (opsi.db) {
          const kunci = env.nilai.SUPABASE_SERVICE_ROLE_KEY;
          const a = await ambil(`${terowonganAdmin.replace(/\/+$/, "")}/admin/users?per_page=1`, { headers: { authorization: `Bearer ${kunci}`, apikey: kunci } }, 15000);
          lapor(a.ok ? "SAMA" : "BEDA", `Panggilan admin sungguhan (GET /admin/users?per_page=1) lewat terowongan: ${a.status}`, "Hanya status yang dibaca; isinya tidak disimpan atau dicetak.");
        } else {
          lapor("INFO", "Panggilan admin berkunci tidak diuji (tambahkan --db untuk mengujinya)");
        }
      }
    } catch (e) {
      lapor("BEDA", `SUPABASE_ADMIN_TUNNEL_URL tidak valid atau tidak terjangkau (${e.message})`);
    }
  }

  // Media
  const driver = env.nilai.STORAGE_DRIVER;
  lapor(driver === "local" ? "SAMA" : "BEDA", `Penyimpanan gambar: STORAGE_DRIVER=${driver ?? "(kosong)"}`);
  if (env.nilai.MEDIA_PUBLIC_BASE_URL) {
    const base = env.nilai.MEDIA_PUBLIC_BASE_URL.replace(/\/+$/, "");
    const baseServer = ref?.env?.variabel?.MEDIA_PUBLIC_BASE_URL?.nilai?.replace(/\/+$/, "");
    lapor(!baseServer || base === baseServer ? "SAMA" : "BEDA", `Alamat publik gambar: ${base}${baseServer && base !== baseServer ? ` (server: ${baseServer})` : ""}`);
  }
  if (urlDb && ["127.0.0.1", "localhost"].includes(urlDb.hostname) && !terhubungProduksi) {
    lapor("BEDA", "Lokal memakai database produksi tetapi LOKAL_TERHUBUNG_PRODUKSI belum diisi", "Unggah gambar dari lokal akan menyimpan alamat produksi untuk berkas yang hanya ada di komputer ini (gambar rusak untuk semua pengguna). Isi LOKAL_TERHUBUNG_PRODUKSI=true di .env.local.");
  } else if (terhubungProduksi) {
    lapor("WAJAR", "Unggah gambar dimatikan di lokal (LOKAL_TERHUBUNG_PRODUKSI=true)", "Berkasnya tidak mungkin sampai ke disk server; mengunggah lewat https://ayotka.id.");
  }

  // Efek samping nyata
  const layanan = [];
  if (env.nilai.RESEND_API_KEY) layanan.push("email (Resend)");
  if (env.nilai.MAILKETING_API_TOKEN) layanan.push("email cadangan (Mailketing)");
  if (env.nilai.EMAIL_SMTP_HOST) layanan.push("email SMTP");
  if (env.nilai.AI_API_KEY) layanan.push("AI Gemini");
  if (env.nilai.MIDTRANS_SERVER_KEY) layanan.push(`pembayaran Midtrans (${env.nilai.MIDTRANS_IS_PRODUCTION === "true" ? "PRODUKSI" : "sandbox"})`);
  if (layanan.length) lapor("INFO", `Aksi di lokal memakai layanan nyata dengan kunci produksi: ${layanan.join(", ")}`, "Email terkirim ke alamat sungguhan, kuota AI terpakai, dan data produksi ikut berubah.");
  else lapor("INFO", "Tidak ada kunci layanan luar di konfigurasi lokal (email/AI/pembayaran tidak akan berjalan)");
}

async function periksaHalaman(opsi) {
  bagian("5. PERILAKU HALAMAN (produksi vs server dev lokal)");
  if (opsi.tanpaJaringan) { lapor("CEK", "Dilewati (--tanpa-jaringan)"); return; }
  const lokal = opsi.lokal;
  let hidup = false;
  try { await ambil(`${lokal}/robots.txt`, {}, 90000); hidup = true; } catch { /* mati */ }
  if (!hidup) { lapor("CEK", `Server dev tidak menjawab di ${lokal}`, "Jalankan npm run dev, atau pakai --lokal=http://localhost:PORT"); return; }

  // Sengaja ringkas: setiap halaman yang belum pernah dibuka harus dikompilasi dulu oleh server dev (lambat di PC ber-RAM kecil).
  const jalur = ["/", "/login", "/login/mitra", "/registrasi", "/kebijakan-privasi", "/kerangka-asesmen", "/masuk", "/siswa/dashboard", "/admin-pusat", "/robots.txt"];
  const HEADER = ["content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy", "cross-origin-opener-policy"];
  const dasarProd = URL_PRODUKSI;
  const normal = (loc, dasar) => (loc ? loc.replace(dasar, "") : null);
  const ambilSatu = async (dasar, p, ms) => {
    try {
      const r = await ambil(dasar + p, { headers: { accept: "text/html,*/*" } }, ms);
      const tipe = r.headers.get("content-type") ?? "";
      const badan = /html|text|xml|json/.test(tipe) ? await r.text() : "";
      return { status: r.status, lokasi: normal(r.headers.get("location"), dasar), tipe, badan, header: r.headers };
    } catch (e) {
      return { galat: e.message };
    }
  };

  let semuaSama = 0;
  let modeDev = null;
  for (const p of jalur) {
    const prod = await ambilSatu(dasarProd, p, 25000);
    const lok = await ambilSatu(lokal, p, 90000);
    if (prod.galat || lok.galat) { lapor("CEK", `${p}: tidak bisa dibandingkan`, `produksi: ${prod.galat ?? prod.status}; lokal: ${lok.galat ?? lok.status}`); continue; }
    if (p === "/login") modeDev = /hmr-client|_next\/static\/development|turbopack\]_browser_dev/.test(lok.badan);
    const selisih = [];
    if (prod.status !== lok.status) selisih.push(`status: produksi ${prod.status}, lokal ${lok.status}`);
    if ((prod.lokasi ?? "") !== (lok.lokasi ?? "")) selisih.push(`tujuan pengalihan: produksi ${prod.lokasi}, lokal ${lok.lokasi}`);
    if (/html/.test(prod.tipe) && /html/.test(lok.tipe) && prod.status === 200 && lok.status === 200) {
      selisih.push(...bandingkanRingkasan(ringkasHalaman(prod.badan), ringkasHalaman(lok.badan)));
    } else if (p === "/robots.txt" && prod.status === 200 && lok.status === 200 && prod.badan.trim() !== lok.badan.trim()) {
      selisih.push("isi robots.txt berbeda");
    }
    if (p === "/login") {
      for (const h of HEADER) {
        const a = prod.header.get(h) ?? null;
        const b = lok.header.get(h) ?? null;
        if (a !== b) selisih.push(`header ${h}: produksi ${a === null ? "(tidak ada)" : `"${a.slice(0, 80)}"`}, lokal ${b === null ? "(tidak ada)" : `"${b.slice(0, 80)}"`}`);
      }
    }
    if (selisih.length) lapor("BEDA", `${p}`, selisih.join("\n")); else semuaSama++;
  }
  if (semuaSama) lapor("SAMA", `${semuaSama} dari ${jalur.length} halaman/rute berperilaku sama (status, pengalihan, judul, tautan, judul bagian)`);
  if (modeDev === true) lapor("WAJAR", "Server lokal berjalan dalam mode DEVELOPMENT (next dev); produksi memakai build production", "Tampilan dan logika sama; waktu muat, pesan galat, dan cache berbeda. Mode yang sama persis: npm run build lalu npx next start -p 3000 (butuh RAM besar; lihat deploy/lokal/KESAMAAN-LOKAL-PRODUKSI.md bagian 6).");
  else if (modeDev === false) lapor("SAMA", "Server lokal berjalan dalam mode production (next start)");
}

async function periksaDatabase(env) {
  bagian("6. DATABASE PRODUKSI (hanya SELECT)");
  let PrismaClient;
  try { ({ PrismaClient } = requireDariProyek("@prisma/client")); } catch (e) { lapor("CEK", `Prisma tidak bisa dimuat (${e.message})`); return; }
  const prisma = new PrismaClient({ datasources: { db: { url: env.nilai.DATABASE_URL } } });
  try {
    const [info] = await prisma.$queryRawUnsafe("select current_database() as db, current_setting('server_version') as versi, current_setting('TimeZone') as zona");
    lapor("INFO", `Terhubung: database ${info.db}, PostgreSQL ${info.versi}, zona waktu database ${info.zona}`);

    const baris = await prisma.$queryRawUnsafe("select migration_name, finished_at, rolled_back_at from _prisma_migrations order by migration_name");
    const diDb = new Set(baris.filter((b) => b.finished_at && !b.rolled_back_at).map((b) => b.migration_name));
    const gagal = baris.filter((b) => !b.finished_at && !b.rolled_back_at).map((b) => b.migration_name);
    const diKode = fs.readdirSync(path.join(AKAR, "prisma", "migrations")).filter((n) => /^\d{14}_/.test(n));
    const belumDiDb = diKode.filter((n) => !diDb.has(n));
    const hanyaDiDb = [...diDb].filter((n) => !diKode.includes(n));
    if (gagal.length) lapor("BEDA", `Migrasi gagal/menggantung di database: ${gagal.join(", ")}`);
    if (belumDiDb.length) lapor("BEDA", `${belumDiDb.length} migrasi di kode lokal BELUM diterapkan di database produksi`, `${belumDiDb.join("\n")}\nKode lokal lebih baru dari skema produksi; fitur terkait bisa galat.`);
    if (hanyaDiDb.length) lapor("BEDA", `${hanyaDiDb.length} migrasi ada di database tetapi tidak ada di kode lokal`, `${hanyaDiDb.join("\n")}\nKode lokal lebih lama dari produksi (git pull?).`);
    if (!gagal.length && !belumDiDb.length && !hanyaDiDb.length) lapor("SAMA", `Skema database = migrasi di kode lokal (${diKode.length} migrasi, semuanya sukses)`);

    const tabel = [["students", "siswa"], ["users", "pengguna"], ["schools", "sekolah"], ["packages", "paket"], ["questions", "soal"], ["attempts", "percobaan"]];
    const jumlah = [];
    for (const [t, label] of tabel) {
      try { const [r] = await prisma.$queryRawUnsafe(`select count(*)::int as n from public."${t}"`); jumlah.push(`${label} ${r.n}`); } catch { jumlah.push(`${label} ?`); }
    }
    lapor("INFO", `Isi data produksi: ${jumlah.join(", ")}`);

    try {
      const [{ json, uri, total }] = await prisma.$queryRawUnsafe(
        "select count(*) filter (where media like '{%')::int as json, count(*) filter (where media like 'data:%')::int as uri, count(*) filter (where media is not null)::int as total from public.questions",
      );
      if (json > 0) lapor("BEDA", `${json} soal menyimpan media dalam format JSON (diagram+foto+keterangan)`, "Kode produksi (HEAD) menampilkan media soal lewat <img src=...> sehingga soal ini tampil sebagai gambar rusak untuk siswa. Hanya kode di cabang wip/* yang mengenali formatnya.");
      else lapor("SAMA", `Tidak ada media soal berformat JSON (${total} soal bermedia; ${uri} berupa data-URI)`);
    } catch (e) {
      lapor("CEK", `Format media soal tidak bisa diperiksa (${e.message})`);
    }
  } catch (e) {
    lapor("BEDA", `Database produksi tidak bisa dibaca (${String(e.message).split("\n").pop()})`);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

// ---------------------------------------------------------------------------------------------------------------

export async function jalankan(argv = process.argv.slice(2)) {
  const opsi = {
    db: argv.includes("--db"),
    tanpaJaringan: argv.includes("--tanpa-jaringan"),
    lokal: (argv.find((a) => a.startsWith("--lokal="))?.slice(8) ?? process.env.LOKAL_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  };
  console.log("PEMERIKSA KESAMAAN LOKAL <-> PRODUKSI AyoTKA");
  console.log(`Folder: ${AKAR}`);
  console.log(`Waktu : ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`);
  const ref = bacaReferensi();
  if (!ref) console.log(`Referensi server: BELUM ADA (${path.relative(AKAR, BERKAS_REFERENSI)}). Rekam dengan .\\scripts\\lokal\\ambil-konfigurasi-produksi.ps1`);
  else console.log(`Referensi server: direkam ${ref.dicatatPada} (commit ${String(ref.kode?.sha ?? "?").slice(0, 7)}, Node ${ref.server?.node ?? "?"})`);

  const env = bacaEnvLokal();
  await periksaKode(opsi, ref);
  periksaRuntime(env, ref);
  periksaKonfigurasi(env, ref);
  await periksaSambungan(env, ref, opsi);
  await periksaHalaman(opsi);
  if (opsi.db) await periksaDatabase(env);
  else {
    bagian("6. DATABASE PRODUKSI");
    lapor("INFO", "Dilewati. Tambahkan --db untuk memeriksa status migrasi, jumlah data, dan format media (membaca produksi, SELECT saja).");
  }

  console.log(`\nRINGKASAN: ${hitung.SAMA} SAMA, ${hitung.WAJAR} WAJAR, ${hitung.CEK} CEK, ${hitung.BEDA} BEDA, ${hitung.INFO} INFO`);
  console.log(hitung.BEDA === 0 ? "Tidak ada perbedaan yang harus dibereskan." : "Ada perbedaan yang harus dibereskan (lihat butir BEDA di atas).");
  return hitung.BEDA === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  jalankan().then((kode) => process.exit(kode), (e) => { console.error("Pemeriksa gagal:", e); process.exit(2); });
}
