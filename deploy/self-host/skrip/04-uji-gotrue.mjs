#!/usr/bin/env node
// LANGKAH 4 - menguji mesin login (GoTrue) lokal dengan alur yang SAMA seperti dipakai aplikasi: buat akun lewat API
// admin, masuk dengan kata sandi, baca pengguna, perbarui sesi (termasuk dua pembaruan serentak dengan token yang
// sama), tautan pemulihan & pendaftaran (generateLink + verify), serta penutupan akses (anon bukan admin, pendaftaran
// publik ditutup). Semua akun uji dihapus di akhir, walau ada yang gagal.
//
// Jalankan:
//   node skrip/04-uji-gotrue.mjs            # langsung ke GoTrue lokal (http://127.0.0.1:9999)
//   node skrip/04-uji-gotrue.mjs --publik   # lewat alamat publik nginx (https://ayotka.id/supabase/auth/v1)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PAKET = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PUBLIK = process.argv.includes("--publik");

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
for (const k of ["ANON_KEY", "SERVICE_ROLE_KEY", "JWT_SECRET", "API_EXTERNAL_URL"]) {
  if (!env[k]) {
    console.error(`GAGAL: ${k} tidak ada di ${path.join(PAKET, ".env")} (jalankan skrip/01-siapkan.sh dulu).`);
    process.exit(2);
  }
}
const BASE = PUBLIK ? env.API_EXTERNAL_URL : "http://127.0.0.1:9999";
console.log(`Menguji GoTrue di ${BASE}\n`);

let lulus = 0;
let gagal = 0;
const cek = (nama, ok, rinci = "") => {
  if (ok) lulus++;
  else gagal++;
  console.log(`${ok ? "  LULUS " : "  GAGAL "} ${nama}${rinci ? "  -> " + rinci : ""}`);
  return ok;
};

async function minta(metode, rute, { badan, kunci = env.ANON_KEY, token } = {}) {
  const res = await fetch(`${BASE}${rute}`, {
    method: metode,
    headers: {
      apikey: kunci,
      Authorization: `Bearer ${token ?? kunci}`,
      ...(badan ? { "Content-Type": "application/json" } : {}),
    },
    body: badan ? JSON.stringify(badan) : undefined,
  });
  const teks = await res.text();
  let json = null;
  try {
    json = JSON.parse(teks);
  } catch {
    /* bukan JSON */
  }
  return { status: res.status, json, teks };
}

const dekode = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
const tandatangan = (jwt) => crypto.createHmac("sha256", env.JWT_SECRET).update(jwt.split(".").slice(0, 2).join(".")).digest("base64url");

const cap = Date.now();
const sandi = "UjiGotrue-" + crypto.randomBytes(8).toString("base64url");
const akunDibuat = [];
const emailUji = `qa.gotrue.${cap}@ayotka.id`;

try {
  // 1. kesehatan
  const sehat = await minta("GET", "/health");
  cek("GET /health = 200", sehat.status === 200, `status ${sehat.status} ${sehat.json?.version ?? ""}`);

  // 2. buat akun lewat API admin (persis seperti app/api/admin-pusat/*)
  const buat = await minta("POST", "/admin/users", {
    kunci: env.SERVICE_ROLE_KEY,
    badan: { email: emailUji, password: sandi, email_confirm: true, app_metadata: { role: "siswa" }, user_metadata: { must_change_password: false } },
  });
  const idUji = buat.json?.id;
  if (idUji) akunDibuat.push(idUji);
  cek("admin createUser (kunci service) = 200 dengan app_metadata.role", buat.status === 200 && buat.json?.app_metadata?.role === "siswa", `status ${buat.status} ${buat.status === 200 ? "" : buat.teks.slice(0, 160)}`);
  if (!idUji) throw new Error("akun uji tidak terbuat; pengujian dihentikan");

  // 3. masuk dengan kata sandi
  const masuk = await minta("POST", "/token?grant_type=password", { badan: { email: emailUji, password: sandi } });
  const akses = masuk.json?.access_token;
  cek("masuk dengan kata sandi = 200 dan ada token", masuk.status === 200 && !!akses && !!masuk.json?.refresh_token, `status ${masuk.status}`);
  if (akses) {
    const klaim = dekode(akses);
    cek("token memuat app_metadata.role = siswa (dibaca proxy.ts)", klaim.app_metadata?.role === "siswa");
    cek("klaim role = authenticated, aud = authenticated", klaim.role === "authenticated" && klaim.aud === "authenticated", `role=${klaim.role} aud=${klaim.aud}`);
    cek("tanda tangan token cocok dengan JWT_SECRET paket", tandatangan(akses) === akses.split(".")[2]);
    console.log(`         info: iss token = ${klaim.iss}`);
  }

  // 4. baca pengguna dari token (dipanggil proxy.ts di setiap request)
  const pengguna = await minta("GET", "/user", { token: akses });
  cek("GET /user dengan token = 200, email & role cocok", pengguna.status === 200 && pengguna.json?.email === emailUji && pengguna.json?.app_metadata?.role === "siswa", `status ${pengguna.status}`);

  // 5. kata sandi salah
  const salah = await minta("POST", "/token?grant_type=password", { badan: { email: emailUji, password: sandi + "x" } });
  cek("kata sandi salah = 400 invalid_credentials (bukan 5xx)", salah.status === 400 && salah.json?.error_code === "invalid_credentials", `status ${salah.status} ${salah.json?.error_code ?? ""}`);

  // 6. pembaruan sesi, termasuk dua pembaruan SERENTAK dengan refresh token yang sama (proxy + halaman)
  if (masuk.json?.refresh_token) {
    const rt = masuk.json.refresh_token;
    const [a, b] = await Promise.all([
      minta("POST", "/token?grant_type=refresh_token", { badan: { refresh_token: rt } }),
      minta("POST", "/token?grant_type=refresh_token", { badan: { refresh_token: rt } }),
    ]);
    cek("dua pembaruan serentak dengan token yang sama keduanya 200 (jendela pemakaian ulang aktif)", a.status === 200 && b.status === 200, `status ${a.status} & ${b.status}`);
    const lagi = await minta("POST", "/token?grant_type=refresh_token", { badan: { refresh_token: rt } });
    cek("pemakaian ulang token lama beberapa detik kemudian masih diterima", lagi.status === 200, `status ${lagi.status}`);
  }

  // 7. alur reset kata sandi: generateLink(recovery) -> verify(token_hash)
  const pemulihan = await minta("POST", "/admin/generate_link", { kunci: env.SERVICE_ROLE_KEY, badan: { type: "recovery", email: emailUji } });
  const hashPemulihan = pemulihan.json?.hashed_token ?? pemulihan.json?.properties?.hashed_token;
  cek("generateLink recovery menghasilkan hashed_token", pemulihan.status === 200 && !!hashPemulihan, `status ${pemulihan.status} ${pemulihan.status === 200 ? "" : pemulihan.teks.slice(0, 160)}`);
  if (hashPemulihan) {
    const verif = await minta("POST", "/verify", { badan: { type: "recovery", token_hash: hashPemulihan } });
    cek("verify recovery = 200 dan memberi sesi", verif.status === 200 && !!verif.json?.access_token, `status ${verif.status} ${verif.status === 200 ? "" : verif.teks.slice(0, 160)}`);
    const ulang = await minta("POST", "/verify", { badan: { type: "recovery", token_hash: hashPemulihan } });
    cek("tautan yang sama tidak bisa dipakai dua kali", ulang.status >= 400, `status ${ulang.status}`);
  }

  // 8. alur pendaftaran siswa mandiri: generateLink(signup) -> verify, sementara pendaftaran publik ditutup
  const emailBaru = `qa.gotrue.baru.${cap}@ayotka.id`;
  const daftar = await minta("POST", "/admin/generate_link", {
    kunci: env.SERVICE_ROLE_KEY,
    badan: { type: "signup", email: emailBaru, password: sandi, data: { nama: "QA Gotrue" } },
  });
  const idBaru = daftar.json?.user?.id ?? daftar.json?.id;
  if (idBaru) akunDibuat.push(idBaru);
  const hashDaftar = daftar.json?.hashed_token ?? daftar.json?.properties?.hashed_token;
  cek("generateLink signup tetap jalan walau pendaftaran publik ditutup", daftar.status === 200 && !!hashDaftar, `status ${daftar.status} ${daftar.status === 200 ? "" : daftar.teks.slice(0, 160)}`);
  if (hashDaftar) {
    const konfirm = await minta("POST", "/verify", { badan: { type: "signup", token_hash: hashDaftar } });
    cek("verify signup = 200 (email terkonfirmasi)", konfirm.status === 200 && !!konfirm.json?.access_token, `status ${konfirm.status}`);
  }

  // 9-10. penutupan akses
  const anonAdmin = await minta("POST", "/admin/users", { badan: { email: `qa.gotrue.x.${cap}@ayotka.id`, password: sandi } });
  if (anonAdmin.status === 200 && anonAdmin.json?.id) akunDibuat.push(anonAdmin.json.id);
  cek("kunci anon TIDAK bisa memakai API admin", anonAdmin.status === 401 || anonAdmin.status === 403, `status ${anonAdmin.status}`);
  const pendaftaranPublik = await minta("POST", "/signup", { badan: { email: `qa.gotrue.s.${cap}@ayotka.id`, password: sandi } });
  if (pendaftaranPublik.status === 200) {
    const idS = pendaftaranPublik.json?.user?.id ?? pendaftaranPublik.json?.id;
    if (idS) akunDibuat.push(idS);
  }
  cek("pendaftaran publik (/signup) ditolak", pendaftaranPublik.status >= 400, `status ${pendaftaranPublik.status} ${pendaftaranPublik.json?.error_code ?? ""}`);

  // 11. batas laju: puluhan login berturut-turut dari satu IP tidak boleh kena 429
  let tertahan = 0;
  for (let i = 0; i < 40; i++) {
    const r = await minta("POST", "/token?grant_type=password", { badan: { email: emailUji, password: sandi } });
    if (r.status === 429) tertahan++;
  }
  cek("40 login berturut-turut dari satu IP tidak ada yang kena 429", tertahan === 0, `${tertahan} ditolak`);
} catch (e) {
  cek("pengujian berjalan sampai selesai", false, String(e.message ?? e));
} finally {
  // pembersihan: hapus semua akun uji
  let terhapus = 0;
  for (const id of akunDibuat) {
    const r = await minta("DELETE", `/admin/users/${id}`, { kunci: env.SERVICE_ROLE_KEY }).catch(() => ({ status: 0 }));
    if (r.status === 200) terhapus++;
  }
  cek("akun uji dihapus semua", terhapus === akunDibuat.length, `${terhapus}/${akunDibuat.length}`);
}

console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal.`);
process.exit(gagal === 0 ? 0 : 1);
