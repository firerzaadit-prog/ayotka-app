#!/usr/bin/env node
// Mengatur atau membuat kata sandi akun di GoTrue lokal
// Penggunaan:
//   node skrip/atur-kata-sandi.mjs <email> <kata_sandi_baru> [peran]
// Contoh:
//   sudo node skrip/atur-kata-sandi.mjs review.midtrans@ayotka.id Password123! siswa
import fs from "node:fs";
import path from "node:path";

const email = process.argv[2];
const sandi = process.argv[3];
const peran = process.argv[4] || "siswa";

if (!email || !sandi) {
  console.log("Penggunaan: sudo node skrip/atur-kata-sandi.mjs <email> <kata_sandi_baru> [peran]");
  console.log("Contoh:     sudo node skrip/atur-kata-sandi.mjs review.midtrans@ayotka.id Password123! siswa");
  process.exit(1);
}

const PAKET = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
function bacaEnv(berkas) {
  const hasil = {};
  for (const baris of fs.readFileSync(berkas, "utf8").split(/\r?\n/)) {
    const m = baris.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    hasil[m[1]] = v;
  }
  return hasil;
}

const env = bacaEnv(path.join(PAKET, ".env"));
const KEY = env.SERVICE_ROLE_KEY;
if (!KEY) {
  console.error("SERVICE_ROLE_KEY tidak ditemukan di .env paket.");
  process.exit(2);
}

const BASE = "http://127.0.0.1:9999";
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function main() {
  console.log(`Memeriksa akun: ${email}...`);
  // 1. Cari user di GoTrue
  const cariRes = await fetch(`${BASE}/admin/users?page=1&per_page=1000`, { headers: H });
  const cariData = await cariRes.json();
  const users = cariData.users || [];
  const existing = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    console.log(`Pengguna ditemukan (ID: ${existing.id}). Memperbarui kata sandi...`);
    const updateRes = await fetch(`${BASE}/admin/users/${existing.id}`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        password: sandi,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata || {}), must_change_password: false },
      }),
    });
    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.error("Gagal memperbarui kata sandi:", updateRes.status, err);
      process.exit(1);
    }
    console.log(`[BERHASIL] Kata sandi akun ${email} berhasil diperbarui.`);
  } else {
    console.log(`Pengguna belum ada di GoTrue. Membuat akun baru...`);
    const createRes = await fetch(`${BASE}/admin/users`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        email,
        password: sandi,
        email_confirm: true,
        app_metadata: { role: peran },
        user_metadata: { must_change_password: false },
      }),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      console.error("Gagal membuat akun:", createRes.status, err);
      process.exit(1);
    }
    console.log(`[BERHASIL] Akun ${email} berhasil dibuat dengan peran: ${peran}.`);
  }

  console.log(`\nSilakan coba masuk sekarang di: https://ayotka.id/login`);
  console.log(`Email    : ${email}`);
  console.log(`Password : ${sandi}\n`);
}

main().catch((err) => {
  console.error("Galat:", err);
  process.exit(1);
});
