#!/usr/bin/env node
// Memeriksa kunci enkripsi pengaturan (tabel app_settings) dan, bila diminta, MENGUNCINYA ke APP_ENCRYPTION_KEY.
//
// Latar belakang (lib/security/crypto.ts): kunci enkripsi = APP_ENCRYPTION_KEY, dan KALAU KOSONG dipakai
// SUPABASE_SERVICE_ROLE_KEY. Saat pindah server, SUPABASE_SERVICE_ROLE_KEY berganti. Kalau APP_ENCRYPTION_KEY belum
// diisi, semua kunci API tersimpan (Gemini, Midtrans, Resend, SMTP, Mailketing) mendadak tidak terbaca (decryptSecret
// diam-diam mengembalikan string kosong). Skrip ini mencegah itu.
//
// Pemakaian (dari folder paket, sebagai root agar bisa membaca .env aplikasi):
//   node skrip/kunci-enkripsi.mjs                 # hanya periksa, tidak mengubah apa pun
//   node skrip/kunci-enkripsi.mjs --kunci         # periksa lalu isi APP_ENCRYPTION_KEY di .env bila perlu & aman
// Tidak pernah mencetak nilai rahasia - hanya status OK / TIDAK TERBACA.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const APP_DIR = process.env.APP_DIR || "/var/www/ayotka-app";
const ENV_FILE = process.env.APP_ENV || path.join(APP_DIR, ".env");
const KUNCI = process.argv.includes("--kunci");
const SALT = "ayotka-settings-salt-2026";
const KOLOM = [
  "gemini_api_key_encrypted",
  "midtrans_server_key_encrypted",
  "resend_api_key_encrypted",
  "smtp_pass_encrypted",
  "mailketing_api_token_encrypted",
];

/** Baca .env sederhana: KEY=VALUE, nilai boleh diapit tanda kutip. */
function bacaEnv(berkas) {
  const hasil = {};
  for (const baris of fs.readFileSync(berkas, "utf8").split(/\r?\n/)) {
    const m = baris.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let nilai = m[2];
    if ((nilai.startsWith('"') && nilai.endsWith('"')) || (nilai.startsWith("'") && nilai.endsWith("'"))) nilai = nilai.slice(1, -1);
    hasil[m[1]] = nilai;
  }
  return hasil;
}

function coba(rahasia, teksSandi) {
  const bagian = teksSandi.trim().split(":");
  if (bagian.length !== 3) return "plaintext"; // nilai lama yang belum dienkripsi tetap terbaca apa adanya
  try {
    const kunci = crypto.scryptSync(rahasia, SALT, 32);
    const d = crypto.createDecipheriv("aes-256-gcm", kunci, Buffer.from(bagian[0], "hex"));
    d.setAuthTag(Buffer.from(bagian[1], "hex"));
    d.update(bagian[2], "hex", "utf8");
    d.final("utf8");
    return "ok";
  } catch {
    return "gagal";
  }
}

const env = bacaEnv(ENV_FILE);
const calon = [
  ["APP_ENCRYPTION_KEY", env.APP_ENCRYPTION_KEY],
  ["SUPABASE_SERVICE_ROLE_KEY (cadangan bawaan kode)", env.SUPABASE_SERVICE_ROLE_KEY],
].filter(([, v]) => v);
if (calon.length === 0) {
  console.error("Tidak ada APP_ENCRYPTION_KEY maupun SUPABASE_SERVICE_ROLE_KEY di", ENV_FILE);
  process.exit(2);
}

const require = createRequire(path.join(APP_DIR, "package.json"));
process.env.DATABASE_URL = env.DIRECT_URL || env.DATABASE_URL;
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } });

let kode = 0;
try {
  const baris = (await prisma.$queryRawUnsafe(`select ${KOLOM.join(", ")} from app_settings where id = 'global'`))[0];
  if (!baris) {
    console.log("Tabel app_settings belum punya baris 'global' - tidak ada kunci tersimpan yang perlu dijaga.");
  } else {
    const terisi = KOLOM.filter((k) => baris[k] && String(baris[k]).trim());
    console.log(`Kunci tersimpan terenkripsi: ${terisi.length} dari ${KOLOM.length} kolom`);
    const cocok = new Map(calon.map(([nama]) => [nama, 0]));
    let tanpaEnkripsi = 0;
    for (const k of terisi) {
      const hasil = calon.map(([nama, rahasia]) => [nama, coba(rahasia, String(baris[k]))]);
      if (hasil.every(([, h]) => h === "plaintext")) tanpaEnkripsi++;
      const berhasil = hasil.filter(([, h]) => h === "ok").map(([nama]) => nama);
      for (const nama of berhasil) cocok.set(nama, cocok.get(nama) + 1);
      console.log(`  ${k.padEnd(34)} ${berhasil.length ? "terbaca dengan " + berhasil.join(" & ") : tanpaEnkripsi && hasil.every(([, h]) => h === "plaintext") ? "tersimpan polos (tanpa enkripsi)" : "TIDAK TERBACA dengan kunci mana pun di .env"}`);
    }
    const perluDibaca = terisi.length - tanpaEnkripsi;
    const [namaTerbaik, jumlahTerbaik] = [...cocok.entries()].sort((a, b) => b[1] - a[1])[0];
    const appTerisi = Boolean(env.APP_ENCRYPTION_KEY);

    /** Menulis APP_ENCRYPTION_KEY ke .env (cadangan .env dibuat dulu). Nilainya TIDAK pernah dicetak. */
    const tulisAppKey = (nilai, keterangan) => {
      const isi = fs.readFileSync(ENV_FILE, "utf8");
      const baru = /^\s*APP_ENCRYPTION_KEY\s*=/m.test(isi)
        ? isi.replace(/^\s*APP_ENCRYPTION_KEY\s*=.*$/m, `APP_ENCRYPTION_KEY="${nilai}"`)
        : `${isi.replace(/\s*$/, "")}\nAPP_ENCRYPTION_KEY="${nilai}"\n`;
      const cadangan = `${ENV_FILE}.sebelum-kunci-${Date.now()}`;
      fs.copyFileSync(ENV_FILE, cadangan);
      fs.writeFileSync(ENV_FILE, baru);
      console.log(`APP_ENCRYPTION_KEY diisi: ${keterangan} (cadangan .env: ${path.basename(cadangan)}). Nilainya tidak dicetak.`);
    };
    const kunciAcak = () => crypto.randomBytes(32).toString("hex");
    // Tanpa APP_ENCRYPTION_KEY, kunci enkripsi ikut SUPABASE_SERVICE_ROLE_KEY: kunci API yang disimpan di Admin Pusat
    // SETELAH pindah pun akan tak terbaca begitu kunci service diganti lagi. Karena itu, dengan --kunci, kunci khusus
    // selalu diisi bila belum ada.
    const kunciKhususBelumAda = (alasan) => {
      if (appTerisi) return;
      if (KUNCI) tulisAppKey(kunciAcak(), alasan);
      else console.log("APP_ENCRYPTION_KEY belum diisi. Jalankan dengan --kunci supaya kunci enkripsi tidak ikut berganti saat SUPABASE_SERVICE_ROLE_KEY diganti.");
    };

    if (perluDibaca === 0) {
      console.log("Tidak ada nilai terenkripsi yang perlu dibaca.");
      kunciKhususBelumAda("kunci acak baru untuk kunci API yang akan disimpan nanti");
    } else if (jumlahTerbaik < perluDibaca) {
      console.error(`\nPERINGATAN: hanya ${jumlahTerbaik} dari ${perluDibaca} nilai yang terbaca. Ada kunci yang sudah tidak terbaca SEBELUM pindah.`);
      console.error("Ini bukan akibat pemindahan. Nilai yang tidak terbaca perlu diisi ulang lewat Admin Pusat > Pengaturan setelah login pulih.");
      kunciKhususBelumAda("kunci acak baru; nilai lama yang tidak terbaca diisi ulang lewat Admin Pusat");
      kode = 3;
    } else if (namaTerbaik.startsWith("APP_ENCRYPTION_KEY")) {
      console.log("\nAMAN: semua nilai terbaca dengan APP_ENCRYPTION_KEY. Mengganti SUPABASE_SERVICE_ROLE_KEY tidak berpengaruh.");
    } else {
      console.log("\nPERLU DIKUNCI: nilai terbaca dengan SUPABASE_SERVICE_ROLE_KEY (cadangan bawaan), bukan APP_ENCRYPTION_KEY.");
      console.log("Kalau SUPABASE_SERVICE_ROLE_KEY diganti tanpa mengunci ini dulu, semua kunci API tersimpan tidak terbaca.");
      if (KUNCI) {
        tulisAppKey(env.SUPABASE_SERVICE_ROLE_KEY, "nilai kunci lama, supaya nilai tersimpan tetap terbaca");
      } else {
        console.log("Jalankan ulang dengan --kunci untuk mengisinya otomatis (cadangan .env dibuat dulu).");
        kode = 4;
      }
    }
  }
} finally {
  await prisma.$disconnect();
}
process.exit(kode);
