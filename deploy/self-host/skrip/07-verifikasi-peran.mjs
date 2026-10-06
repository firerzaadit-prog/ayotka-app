#!/usr/bin/env node
// LANGKAH 7 - verifikasi sesudah pindah: membuat akun SEMENTARA untuk kelima peran (siswa, admin sekolah, mitra,
// dinas pendidikan, admin pusat), lalu menguji lewat alamat publik yang sama seperti dipakai pengguna:
// masuk, membuka halaman beranda peran (nama akun tampil), sesi bertahan, keluar, alur reset kata sandi lewat tautan,
// pembaruan sesi yang sudah kedaluwarsa (penyebab 502 nginx dulu), dan unggah gambar ke penyimpanan lokal.
// Semua akun/data uji dihapus di akhir, walau ada yang gagal.
//
// Jalankan sebagai root dari folder paket:  sudo node skrip/07-verifikasi-peran.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const APP_DIR = process.env.APP_DIR || "/var/www/ayotka-app";

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

const env = bacaEnv(path.join(APP_DIR, ".env"));
const BASE = (process.env.VERIF_BASE || env.NEXT_PUBLIC_APP_URL || "https://ayotka.id").replace(/\/+$/, "");
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY tidak ada di .env aplikasi.");
  process.exit(2);
}
process.env.DATABASE_URL = env.DATABASE_URL;
const require = createRequire(path.join(APP_DIR, "package.json"));
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

console.log(`Aplikasi : ${BASE}`);
console.log(`Login    : ${SB} ${SB.includes("supabase.co") ? "(MASIH Supabase Cloud!)" : "(lokal)"}`);
console.log(`Gambar   : ${env.STORAGE_DRIVER === "local" ? "disk server (" + env.MEDIA_DIR + ")" : "Supabase Storage"}\n`);

let lulus = 0;
let gagal = 0;
const cek = (nama, ok, rinci = "") => {
  if (ok) lulus++;
  else gagal++;
  console.log(`${ok ? "  LULUS " : "  GAGAL "} ${nama}${rinci ? "  -> " + String(rinci).slice(0, 200) : ""}`);
  return ok;
};

// ---------- cookie jar sederhana ----------
function serap(jar, res) {
  for (const c of res.headers.getSetCookie()) {
    const [pasangan] = c.split(";");
    const i = pasangan.indexOf("=");
    const nama = pasangan.slice(0, i).trim();
    const nilai = pasangan.slice(i + 1).trim();
    if (nilai === "" || /max-age=0/i.test(c)) jar.delete(nama);
    else jar.set(nama, nilai);
  }
}
const kepala = (jar) => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
async function minta(jar, metode, url, opsi = {}) {
  const res = await fetch(url.startsWith("http") ? url : BASE + url, {
    method: metode,
    redirect: "manual",
    headers: { ...(jar.size ? { Cookie: kepala(jar) } : {}), ...(opsi.json ? { "Content-Type": "application/json" } : {}), ...(opsi.headers ?? {}) },
    body: opsi.json ? JSON.stringify(opsi.json) : opsi.form,
  });
  serap(jar, res);
  const teks = await res.text();
  return { status: res.status, teks, res };
}

/** Jadikan cookie sesi Supabase kedaluwarsa (bisa terpecah .0 .1 ...), meniru pengguna yang kembali setelah > 1 jam. */
function kedaluwarsakan(jar) {
  const nama = [...jar.keys()].filter((k) => /^sb-.*-auth-token(\.\d+)?$/.test(k)).sort();
  if (!nama.length) throw new Error("cookie sesi sb-* tidak ditemukan: " + [...jar.keys()].join(","));
  const dasar = nama[0].replace(/\.\d+$/, "");
  const gabung = nama.map((k) => jar.get(k)).join("");
  const adaPrefix = gabung.startsWith("base64-");
  const sesi = JSON.parse(adaPrefix ? Buffer.from(gabung.slice(7), "base64url").toString("utf8") : decodeURIComponent(gabung));
  sesi.expires_at = Math.floor(Date.now() / 1000) - 600;
  sesi.expires_in = 0;
  const baru = adaPrefix ? "base64-" + Buffer.from(JSON.stringify(sesi), "utf8").toString("base64url") : encodeURIComponent(JSON.stringify(sesi));
  for (const k of nama) jar.delete(k);
  if (baru.length <= 3180) jar.set(dasar, baru);
  else for (let i = 0, n = 0; i < baru.length; i += 3180, n++) jar.set(`${dasar}.${n}`, baru.slice(i, i + 3180));
}

// ---------- data uji ----------
const cap = Date.now();
const state = { akun: [], sekolahId: null, studentId: null, partnerId: null, berkasUnggah: null };

async function buatAuth(peran, role) {
  const email = `qa.verif.${peran}.${cap}@ayotka.id`;
  const password = "QaVerif-" + crypto.randomBytes(9).toString("base64url");
  const r = await fetch(`${SB}/auth/v1/admin/users`, { method: "POST", headers: H, body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { role } }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`buat akun ${peran}: ${r.status} ${JSON.stringify(j).slice(0, 160)}`);
  state.akun.push({ peran, email, password, authId: j.id });
  await prisma.user.create({ data: { id: j.id, email, role, status: "aktif" } });
  return { id: j.id, email, password };
}

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const PERAN = [];

try {
  const kode = "QV" + crypto.randomBytes(3).toString("hex").toUpperCase();
  const sekolah = await prisma.school.create({ data: { nama: "QA-TEST SMP Negeri Verifikasi", jenjang: "SMP", kodeSekolah: kode, status: "aktif" } });
  state.sekolahId = sekolah.id;

  const asek = await buatAuth("sekolah", "admin_sekolah");
  await prisma.schoolUser.create({ data: { userId: asek.id, schoolId: sekolah.id } });
  PERAN.push({ nama: "admin sekolah", akun: asek, home: "/admin-sekolah/dashboard", label: sekolah.nama });

  const siswaU = await buatAuth("siswa", "siswa");
  const namaSiswa = `QA-TEST Siswa Verifikasi ${cap}`;
  const siswa = await prisma.student.create({
    data: { userId: siswaU.id, jenjang: "SMP", nama: namaSiswa, jalur: "B", claimStatus: "sudah_klaim", status: "active", referralCode: `QV${crypto.randomBytes(5).toString("hex")}` },
  });
  state.studentId = siswa.id;
  PERAN.push({ nama: "siswa", akun: siswaU, home: "/siswa/dashboard", label: namaSiswa });

  const mitraU = await buatAuth("mitra", "mitra");
  const mitra = await prisma.partner.create({ data: { userId: mitraU.id, nama: "QA-TEST Mitra Verifikasi", referralCode: `QVM${crypto.randomBytes(4).toString("hex")}` } });
  state.partnerId = mitra.id;
  PERAN.push({ nama: "mitra", akun: mitraU, home: "/mitra/dashboard", label: "QA-TEST Mitra Verifikasi" });

  const dinasU = await buatAuth("dinas", "dinas_pendidikan");
  await prisma.dinasAdmin.create({ data: { userId: dinasU.id, nama: "QA-TEST Penanggung Jawab", instansi: "QA-TEST Dinas Pendidikan Verifikasi", kabupatenKota: "Kota Malang" } });
  PERAN.push({ nama: "dinas pendidikan", akun: dinasU, home: "/dinas-pendidikan/dashboard", label: "QA-TEST Dinas Pendidikan Verifikasi" });

  const pusatU = await buatAuth("pusat", "admin_pusat");
  PERAN.push({ nama: "admin pusat", akun: pusatU, home: "/admin-pusat/dashboard", label: pusatU.email });
  console.log(`Akun sementara dibuat untuk ${PERAN.length} peran.\n`);

  // ---------- masuk + beranda + sesi bertahan + keluar, per peran ----------
  const jarPeran = {};
  for (const p of PERAN) {
    console.log(`== ${p.nama}`);
    const jar = new Map();
    jarPeran[p.nama] = jar;
    const masuk = await minta(jar, "POST", "/api/auth/login", { json: { emailOrNisn: p.akun.email, password: p.akun.password } });
    cek("masuk (POST /api/auth/login) = 200", masuk.status === 200, `status ${masuk.status} ${masuk.status === 200 ? "" : masuk.teks.slice(0, 120)}`);
    if (masuk.status !== 200) continue;
    cek("cookie sesi terpasang", [...jar.keys()].some((k) => /^sb-.*-auth-token/.test(k)));
    const beranda = await minta(jar, "GET", p.home);
    cek(`beranda ${p.home} = 200`, beranda.status === 200, `status ${beranda.status}`);
    cek("nama akun tampil di pojok kanan atas", beranda.teks.includes(p.label), p.label);
    const lagi = await minta(jar, "GET", p.home);
    cek("sesi bertahan di permintaan berikutnya", lagi.status === 200, `status ${lagi.status}`);
  }

  // ---------- keluar ----------
  console.log("\n== keluar");
  {
    const jar = jarPeran["siswa"];
    if (jar) {
      const keluar = await minta(jar, "POST", "/api/auth/logout");
      cek("keluar = 200", keluar.status === 200, `status ${keluar.status}`);
      const sesudah = await minta(jar, "GET", "/siswa/dashboard");
      cek("setelah keluar, beranda dialihkan ke halaman masuk", sesudah.status >= 300 && sesudah.status < 400, `status ${sesudah.status} -> ${sesudah.res.headers.get("location") ?? ""}`);
    }
  }

  // ---------- sesi kedaluwarsa (kasus 502 nginx dulu) ----------
  console.log("\n== sesi kedaluwarsa (pengguna kembali setelah > 1 jam)");
  {
    const jar = new Map();
    const pusat = PERAN.find((p) => p.nama === "admin pusat");
    const masuk = await minta(jar, "POST", "/api/auth/login", { json: { emailOrNisn: pusat.akun.email, password: pusat.akun.password } });
    if (masuk.status === 200) {
      kedaluwarsakan(jar);
      for (const halaman of ["/", "/admin-pusat/dashboard", "/api/admin-pusat/plans"]) {
        const jarSalinan = new Map(jar);
        const r = await minta(jarSalinan, "GET", halaman);
        cek(`GET ${halaman} dengan sesi kedaluwarsa tidak 5xx (sesi diperbarui)`, r.status < 500, `status ${r.status}`);
      }
    } else cek("masuk admin pusat untuk uji sesi kedaluwarsa", false, `status ${masuk.status}`);
  }

  // ---------- reset kata sandi lewat tautan ----------
  console.log("\n== reset kata sandi (generateLink -> /api/auth/confirm)");
  {
    const siswaAkun = PERAN.find((p) => p.nama === "siswa").akun;
    const gl = await fetch(`${SB}/auth/v1/admin/generate_link`, { method: "POST", headers: H, body: JSON.stringify({ type: "recovery", email: siswaAkun.email }) });
    const glj = await gl.json().catch(() => ({}));
    const hash = glj.hashed_token ?? glj.properties?.hashed_token;
    cek("generateLink recovery menghasilkan token", gl.status === 200 && !!hash, `status ${gl.status}`);
    if (hash) {
      const jar = new Map();
      const konfirm = await minta(jar, "POST", "/api/auth/confirm", { json: { token_hash: hash, type: "recovery" } });
      cek("POST /api/auth/confirm (recovery) = 200 dan memasang sesi", konfirm.status === 200 && [...jar.keys()].some((k) => /^sb-.*-auth-token/.test(k)), `status ${konfirm.status} ${konfirm.status === 200 ? "" : konfirm.teks.slice(0, 120)}`);
      const halaman = await minta(jar, "GET", "/reset-password");
      cek("halaman /reset-password terbuka dengan sesi pemulihan", halaman.status === 200, `status ${halaman.status}`);
      const ulang = await minta(new Map(), "POST", "/api/auth/confirm", { json: { token_hash: hash, type: "recovery" } });
      cek("tautan yang sama tidak bisa dipakai dua kali", ulang.status >= 400, `status ${ulang.status}`);
    }
  }

  // ---------- unggah gambar ----------
  console.log("\n== unggah gambar soal (admin pusat)");
  {
    const jar = new Map();
    const pusat = PERAN.find((p) => p.nama === "admin pusat");
    await minta(jar, "POST", "/api/auth/login", { json: { emailOrNisn: pusat.akun.email, password: pusat.akun.password } });
    const form = new FormData();
    form.append("file", new File([PNG], "verifikasi.png", { type: "image/png" }));
    const unggah = await minta(jar, "POST", "/api/uploads", { form });
    let url = null;
    try {
      url = JSON.parse(unggah.teks).url;
    } catch {
      /* bukan JSON */
    }
    cek("POST /api/uploads = 201 dengan URL", unggah.status === 201 && !!url, `status ${unggah.status} ${unggah.status === 201 ? "" : unggah.teks.slice(0, 120)}`);
    if (url) {
      if (env.STORAGE_DRIVER === "local") {
        cek("URL berada di alamat gambar lokal", url.startsWith(env.MEDIA_PUBLIC_BASE_URL), url);
        const nama = url.split("/").pop();
        state.berkasUnggah = path.join(env.MEDIA_DIR, nama);
        cek("berkas tertulis di disk server", fs.existsSync(state.berkasUnggah) && fs.readFileSync(state.berkasUnggah).equals(PNG), state.berkasUnggah);
      }
      const ambil = await fetch(url);
      const isi = Buffer.from(await ambil.arrayBuffer());
      cek("gambar bisa dibuka lewat URL publik (image/png)", ambil.status === 200 && (ambil.headers.get("content-type") ?? "").startsWith("image/png") && isi.equals(PNG), `status ${ambil.status} ${ambil.headers.get("content-type")}`);
    }
  }
} catch (e) {
  cek("verifikasi berjalan sampai selesai", false, e.stack ?? e.message ?? e);
} finally {
  // ---------- pembersihan ----------
  console.log("\n== pembersihan");
  const log = (e) => console.log("  catatan:", String(e.message ?? e).split("\n").filter(Boolean).pop());
  try {
    if (state.berkasUnggah && fs.existsSync(state.berkasUnggah)) fs.unlinkSync(state.berkasUnggah);
    const ids = state.akun.map((a) => a.authId);
    if (state.studentId) {
      await prisma.attempt.deleteMany({ where: { studentId: state.studentId } });
      await prisma.student.delete({ where: { id: state.studentId } }).catch(log);
    }
    if (state.partnerId) await prisma.partner.delete({ where: { id: state.partnerId } }).catch(log);
    await prisma.dinasAdmin.deleteMany({ where: { userId: { in: ids } } });
    await prisma.schoolUser.deleteMany({ where: { userId: { in: ids } } });
    if (state.sekolahId) await prisma.school.delete({ where: { id: state.sekolahId } }).catch(log);
    for (const a of state.akun) {
      await prisma.loginLog?.deleteMany?.({ where: { userId: a.authId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: a.authId } }).catch(log);
      await fetch(`${SB}/auth/v1/admin/users/${a.authId}`, { method: "DELETE", headers: H }).catch(log);
    }
    const sisa = {
      user: await prisma.user.count({ where: { email: { startsWith: "qa.verif." } } }),
      siswa: await prisma.student.count({ where: { nama: { startsWith: "QA-TEST" } } }),
      sekolah: await prisma.school.count({ where: { nama: { startsWith: "QA-TEST" } } }),
      mitra: await prisma.partner.count({ where: { nama: { startsWith: "QA-TEST" } } }),
      dinas: await prisma.dinasAdmin.count({ where: { instansi: { startsWith: "QA-TEST" } } }),
    };
    cek("semua data uji terhapus (sisa nol)", Object.values(sisa).every((v) => v === 0), JSON.stringify(sisa));
  } catch (e) {
    cek("pembersihan data uji", false, `HAPUS MANUAL akun qa.verif.*@ayotka.id: ${e.message}`);
  }
  await prisma.$disconnect();
}

console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal.`);
process.exit(gagal === 0 ? 0 : 1);
