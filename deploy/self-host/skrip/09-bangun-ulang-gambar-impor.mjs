#!/usr/bin/env node
// Membangun ulang gambar hasil IMPOR soal.ayotka.id (berkas bernama impor/<sha256>.<ekstensi>) LANGSUNG dari data soal
// di skema `soal`, TANPA memerlukan Supabase Storage. Logika pembuatan bytes sama persis dengan
// lib/soal-import/media.ts (SVG = teks SVG di-trim lalu UTF-8; gambar kontekstual = decode data URI, atau svg_fallback),
// dan nama berkas diturunkan dari hash isinya seperti lib/soal-import/execute.ts - jadi nama hasilnya identik dengan
// yang dulu diunggah ke Storage dan alamat di database langsung cocok.
//
// Hanya berkas yang benar-benar DIRUJUK database yang dibuat. Gambar unggahan manual (nama uuid) dan gambar dari impor
// Excel tidak punya sumber lain selain Storage; itu tugas skrip/08-pindahkan-gambar.sh setelah Storage pulih.
//
// Pemakaian (dari folder paket, sebagai root di server):
//   node skrip/09-bangun-ulang-gambar-impor.mjs            # hanya memeriksa dan melaporkan (tidak menulis apa pun)
//   node skrip/09-bangun-ulang-gambar-impor.mjs --tulis    # menulis berkas ke MEDIA_DIR + mengganti alamat lama di DB
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const APP_DIR = process.env.APP_DIR || "/var/www/ayotka-app";
const PAKET = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TULIS = process.argv.includes("--tulis");
const MAKS_BYTE = 5 * 1024 * 1024;

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

// ---------- logika yang SAMA dengan lib/soal-import/media.ts + lib/soal/gambar-format.ts (dijaga tes) ----------
function sniffGambar(b) {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return { mime: "image/gif", ext: "gif" };
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: "image/webp", ext: "webp" };
  return null;
}

function encodeSvg(svgContent) {
  const content = (svgContent ?? "").trim();
  if (!content) return null;
  if (!/^(<\?xml|<svg)/i.test(content)) return null;
  if (Buffer.byteLength(content, "utf-8") > MAKS_BYTE) return null;
  return { bytes: Buffer.from(content, "utf-8"), ext: "svg" };
}

function decodeDataUri(raw) {
  if (!raw) return null;
  const s = raw.trim();
  const commaIdx = s.indexOf(",");
  if (commaIdx === -1) return null;
  const header = s.slice(0, commaIdx);
  const data = s.slice(commaIdx + 1);
  if (!header.startsWith("data:") || !header.includes(";base64")) return null;
  const bytes = Buffer.from(data.replace(/\s+/g, ""), "base64");
  return bytes.length === 0 ? null : bytes;
}

function encodeIlustrasiKontekstual(gambar) {
  if (gambar.image_data) {
    const bytes = decodeDataUri(gambar.image_data);
    if (bytes) {
      if (bytes.length > MAKS_BYTE) return gambar.svg_fallback ? encodeSvg(gambar.svg_fallback) : null;
      const info = sniffGambar(bytes);
      if (info) return { bytes, ext: info.ext };
    }
    return gambar.svg_fallback ? encodeSvg(gambar.svg_fallback) : null;
  }
  return gambar.svg_fallback ? encodeSvg(gambar.svg_fallback) : null;
}

/** null = tidak bisa dibangun dari data (mis. tipe url yang harus diunduh dari luar, atau data rusak). */
export function bangunGambarSumber(gambar) {
  if (!gambar) return null;
  if (gambar.tipe === "svg") return encodeSvg(gambar.svg_content);
  if (gambar.tipe === "ilustrasi_kontekstual") return encodeIlustrasiKontekstual(gambar);
  return null;
}
export const namaImpor = (bytes, ext) => `impor/${crypto.createHash("sha256").update(bytes).digest("hex")}.${ext}`;

// ---------- utama ----------
// Dijalankan sebagai skrip, bukan saat diimpor (tes mengambil fungsi-fungsi di atas lewat teks berkas).
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  const env = bacaEnv(path.join(APP_DIR, ".env"));
  const pgb = (u) => (u.includes(":6543") && !u.includes("pgbouncer=true") ? u + (u.includes("?") ? "&" : "?") + "pgbouncer=true" : u);
  const require = createRequire(path.join(APP_DIR, "package.json"));
  const { PrismaClient } = require("@prisma/client");
  const app = new PrismaClient({ datasources: { db: { url: pgb(env.DATABASE_URL) } } });
  const src = new PrismaClient({ datasources: { db: { url: pgb(env.SOAL_SOURCE_DATABASE_URL) } } });
  const j = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? Number(x) : x)));

  // awalan alamat lama (Supabase Storage) dan baru (disk server)
  let urlLama = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!/supabase\.co/.test(urlLama ?? "")) {
    const penunjuk = path.join(PAKET, ".env-sebelum-pindah");
    if (fs.existsSync(penunjuk)) urlLama = bacaEnv(fs.readFileSync(penunjuk, "utf8").trim()).NEXT_PUBLIC_SUPABASE_URL;
  }
  if (!/supabase\.co/.test(urlLama ?? "")) {
    console.error("Alamat Supabase lama tidak ditemukan (NEXT_PUBLIC_SUPABASE_URL lama / .env-sebelum-pindah).");
    process.exit(2);
  }
  const awalanLama = `${urlLama.replace(/\/+$/, "")}/storage/v1/object/public/soal-media/`;
  const mediaDir = env.MEDIA_DIR;
  const awalanBaru = env.MEDIA_PUBLIC_BASE_URL ? `${env.MEDIA_PUBLIC_BASE_URL.replace(/\/+$/, "")}/` : null;
  if (TULIS && (!mediaDir || !awalanBaru || env.STORAGE_DRIVER !== "local")) {
    console.error("--tulis butuh STORAGE_DRIVER=local, MEDIA_DIR, dan MEDIA_PUBLIC_BASE_URL di .env aplikasi (jalankan setelah Langkah 5).");
    process.exit(2);
  }
  console.log(`Mode: ${TULIS ? "TULIS (membuat berkas + mengganti alamat)" : "PERIKSA saja (tidak menulis apa pun)"}`);

  let kode = 0;
  try {
    // 1. soal sumber yang pernah diimpor
    const log = j(await app.$queryRawUnsafe(`select source_paket_id as id, source_paket_code as kode from soal_import_logs`));
    const ids = log.map((r) => r.id);
    const sumber = j(await src.$queryRawUnsafe(`select q.code, q.payload->'gambar' as gambar from soal.questions q where q.paket_id = any($1::text[]) and jsonb_typeof(q.payload->'gambar') = 'object'`, ids));
    const bisa = new Map(); // nama -> {ext, bytes}
    let tidakBisa = 0;
    for (const s of sumber) {
      const g = bangunGambarSumber(s.gambar);
      if (!g) { tidakBisa++; continue; }
      bisa.set(namaImpor(g.bytes, g.ext), g);
    }
    console.log(`Paket sumber diimpor: ${log.map((r) => r.kode).join(", ")}`);
    console.log(`Soal bergambar di sumber: ${sumber.length}; gambar unik yang bisa dibangun dari data: ${bisa.size}; tidak bisa dibangun dari data: ${tidakBisa}`);

    // 2. nama gambar impor yang DIRUJUK database (alamat lama atau baru)
    const kolom = j(await app.$queryRawUnsafe(`select table_name t, column_name c from information_schema.columns where table_schema='public' and data_type in ('text','character varying') and table_name <> '_prisma_migrations'`));
    const dirujuk = new Set();
    const semuaRujukan = new Set();
    const polaNama = /(?:storage\/v1\/object\/public\/soal-media|media\/soal-media)\/([A-Za-z0-9][A-Za-z0-9._\/-]*)/g;
    for (const { t, c } of kolom) {
      const baris = j(await app.$queryRawUnsafe(`select "${c}" as v from public."${t}" where "${c}" like '%soal-media/%'`));
      for (const { v } of baris) for (const m of String(v).matchAll(polaNama)) { semuaRujukan.add(m[1]); if (m[1].startsWith("impor/")) dirujuk.add(m[1]); }
    }
    const cocok = [...dirujuk].filter((n) => bisa.has(n));
    const belumBisa = [...dirujuk].filter((n) => !bisa.has(n));
    const manual = [...semuaRujukan].filter((n) => !n.startsWith("impor/"));
    console.log(`Gambar yang dirujuk database: ${semuaRujukan.size} (impor/: ${dirujuk.size}, unggahan manual: ${manual.length})`);
    console.log(`  impor/ yang BISA dibangun dari data soal: ${cocok.length}`);
    console.log(`  impor/ yang TIDAK bisa dibangun (sumbernya hanya di Storage, mis. impor Excel): ${belumBisa.length}`);
    console.log(`  unggahan manual (hanya di Storage): ${manual.length}`);

    // dampak: paket mana yang masih punya soal bergambar yang TIDAK bisa dibangun dari data
    const belum = [...belumBisa, ...manual];
    if (belum.length) {
      const terdampak = new Map(); // "status | nama" -> Set id soal
      for (const n of belum) {
        const rows = j(await app.$queryRawUnsafe(`select q.id, p.nama, p.status::text as status from questions q join packages p on p.id=q.package_id where q.deleted_at is null and (q.media like '%' || $1 || '%' or q.teks like '%' || $1 || '%')`, n));
        for (const r of rows) {
          const k = `${r.status} | ${r.nama}`;
          if (!terdampak.has(k)) terdampak.set(k, new Set());
          terdampak.get(k).add(r.id);
        }
      }
      console.log("\nSoal yang gambarnya MASIH menunggu Storage (tidak bisa dibangun dari data):");
      for (const [k, v] of [...terdampak.entries()].sort()) console.log(`  [${k.split(" | ")[0]}] ${k.split(" | ")[1].slice(0, 56)}: ${v.size} soal`);
    }

    if (!TULIS) {
      console.log("\nTidak ada yang ditulis. Jalankan dengan --tulis untuk membangun berkas dan mengganti alamatnya.");
    } else {
      // 3. tulis berkas
      let ditulis = 0, sudahAda = 0;
      for (const n of cocok) {
        const tujuan = path.join(mediaDir, ...n.split("/"));
        const { bytes } = bisa.get(n);
        if (fs.existsSync(tujuan) && fs.readFileSync(tujuan).equals(bytes)) { sudahAda++; continue; }
        fs.mkdirSync(path.dirname(tujuan), { recursive: true });
        const sementara = `${tujuan}.${crypto.randomUUID()}.tmp`;
        fs.writeFileSync(sementara, bytes, { mode: 0o644 });
        fs.renameSync(sementara, tujuan);
        ditulis++;
      }
      console.log(`\nBerkas: ${ditulis} ditulis, ${sudahAda} sudah ada dan identik.`);

      // 4. ganti alamat lama -> baru di semua kolom teks (aman diulang; yang belum ada berkasnya muncul otomatis setelah Langkah 8)
      let diperbarui = 0;
      for (const { t, c } of kolom) {
        const n = await app.$executeRawUnsafe(`update public."${t}" set "${c}" = replace("${c}", $1, $2) where "${c}" like '%' || $1 || '%'`, awalanLama, awalanBaru);
        if (n > 0) { console.log(`  ${t}.${c}: ${n} baris`); diperbarui += n; }
      }
      console.log(`Alamat diganti pada ${diperbarui} baris.`);
      const hilang = [...semuaRujukan].filter((n) => !fs.existsSync(path.join(mediaDir, ...n.split("/"))));
      console.log(`\nGambar yang masih menunggu Langkah 8 (Storage pulih): ${hilang.length}`);
      if (hilang.length) kode = 3;
    }
  } finally {
    await app.$disconnect();
    await src.$disconnect();
  }
  process.exit(kode);
}
