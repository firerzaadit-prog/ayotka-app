import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { resolveSourceImage, type SourceGambar } from "@/lib/soal-import/media";
import { importImagePath } from "@/lib/supabase/storage";

/**
 * deploy/self-host/skrip/09-bangun-ulang-gambar-impor.mjs membangun ulang berkas impor/<sha256>.<ekstensi> dari data
 * soal TANPA Supabase Storage. Supaya nama berkasnya sama persis dengan yang dulu diunggah impor, logikanya harus
 * identik dengan lib/soal-import/media.ts (resolveSourceImage) dan penamaan di lib/soal-import/execute.ts. Tes ini
 * mengadu keduanya pada banyak bentuk data.
 */
type Hasil = { bytes: Buffer; ext: string } | null;
let bangun: (g: unknown, opsi?: Record<string, string>) => Hasil;
let nama: (bytes: Buffer, ext: string) => string;

beforeAll(async () => {
  const berkas = path.resolve(__dirname, "../../deploy/self-host/skrip/09-bangun-ulang-gambar-impor.mjs");
  const mod = (await import(/* @vite-ignore */ pathToFileURL(berkas).href)) as {
    bangunGambarSumber: (g: unknown, opsi?: Record<string, string>) => Hasil;
    namaImpor: (b: Buffer, e: string) => string;
  };
  bangun = mod.bangunGambarSumber;
  nama = mod.namaImpor;
});

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 7)]);
const SVG = '  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="10"/></svg>\n ';
const dataUri = (b: Buffer, mime = "image/png") => `data:${mime};base64,${b.toString("base64")}`;

const KASUS: Array<[string, SourceGambar]> = [
  ["svg biasa (spasi/baris baru di tepi di-trim)", { tipe: "svg", svg_content: SVG, deskripsi_alt: "x" }],
  ["svg dengan deklarasi xml", { tipe: "svg", svg_content: '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>', deskripsi_alt: "x" }],
  ["kontekstual PNG", { tipe: "ilustrasi_kontekstual", image_data: dataUri(PNG), deskripsi_alt: "x" }],
  ["kontekstual JPEG (ekstensi jpg)", { tipe: "ilustrasi_kontekstual", image_data: dataUri(JPEG, "image/jpeg"), deskripsi_alt: "x" }],
  ["kontekstual dengan spasi/baris baru di base64", { tipe: "ilustrasi_kontekstual", image_data: dataUri(PNG).replace(/(.{20})/g, "$1\n "), deskripsi_alt: "x" }],
  ["kontekstual isi bukan gambar -> svg_fallback", { tipe: "ilustrasi_kontekstual", image_data: dataUri(Buffer.from("<html>"), "image/png"), svg_fallback: SVG, deskripsi_alt: "x" }],
  ["kontekstual format salah -> svg_fallback", { tipe: "ilustrasi_kontekstual", image_data: "bukan-data-uri", svg_fallback: SVG, deskripsi_alt: "x" }],
  ["kontekstual hanya svg_fallback", { tipe: "ilustrasi_kontekstual", svg_fallback: SVG, deskripsi_alt: "x" }],
  ["kontekstual melebihi 5 MB -> svg_fallback", { tipe: "ilustrasi_kontekstual", image_data: dataUri(Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1)])), svg_fallback: SVG, deskripsi_alt: "x" }],
  ["kontekstual melebihi 5 MB tanpa fallback -> tak bisa", { tipe: "ilustrasi_kontekstual", image_data: dataUri(Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1)])), deskripsi_alt: "x" }],
  ["kontekstual kosong -> tak bisa", { tipe: "ilustrasi_kontekstual", deskripsi_alt: "x" }],
  ["svg kosong -> tak bisa", { tipe: "svg", svg_content: "   ", deskripsi_alt: "x" }],
  ["svg bukan markup svg -> tak bisa", { tipe: "svg", svg_content: "bukan svg", deskripsi_alt: "x" }],
  ["perlu_ilustrasi -> tak bisa", { tipe: "perlu_ilustrasi", deskripsi_alt: "x" }],
];

describe("skrip 09 membangun berkas yang sama persis dengan impor aplikasi", () => {
  for (const [judul, gambar] of KASUS) {
    it(judul, async () => {
      const aplikasi = await resolveSourceImage(gambar);
      const skrip = bangun(gambar);
      if (aplikasi.status === "ready") {
        expect(skrip).not.toBeNull();
        expect(Buffer.compare(skrip!.bytes, aplikasi.bytes)).toBe(0);
        expect(skrip!.ext).toBe(aplikasi.ext);
        // nama berkas = penamaan execute.ts: sha256 isi + ekstensi, lewat importImagePath
        const hash = crypto.createHash("sha256").update(aplikasi.bytes).digest("hex");
        expect(nama(skrip!.bytes, skrip!.ext)).toBe(importImagePath(hash, aplikasi.ext));
      } else {
        // diblokir/tak ada di aplikasi => skrip tidak boleh mengarang berkas
        expect(skrip).toBeNull();
      }
    });
  }

  it("tipe url di luar generator (harus diunduh dari luar) dan gambar kosong tidak dibangun skrip", () => {
    expect(bangun({ tipe: "url", url: "https://contoh.test/a.png", deskripsi_alt: "x" })).toBeNull();
    expect(bangun(null)).toBeNull();
    expect(bangun(undefined)).toBeNull();
  });

  it("gambar yang sama selalu menghasilkan nama yang sama, isi berbeda nama berbeda", () => {
    const a = bangun({ tipe: "svg", svg_content: SVG })!;
    const b = bangun({ tipe: "svg", svg_content: SVG.trim() })!;
    const c = bangun({ tipe: "svg", svg_content: SVG.replace("r=\"10\"", "r=\"11\"") })!;
    expect(nama(a.bytes, a.ext)).toBe(nama(b.bytes, b.ext));
    expect(nama(a.bytes, a.ext)).not.toBe(nama(c.bytes, c.ext));
    expect(nama(a.bytes, a.ext)).toMatch(/^impor\/[0-9a-f]{64}\.svg$/);
  });
});

/**
 * Sejak 6 Okt 2026 generator menaruh gambar ilustrasinya di disk server dan payload hanya memuat `url`. Skrip membaca
 * berkas yang sama dari GENERATOR_IMAGES_DIR; hasilnya harus identik dengan resolveSourceImage (yang dipakai impor
 * sungguhan), termasuk kapan KEDUANYA menolak membuat gambar (aplikasi: diblokir; skrip: tidak dibangun).
 */
describe("skrip 09 membaca gambar generator dari disk sama seperti impor aplikasi", () => {
  const URL_BASE = "https://soal.ayotka.id/soal-images/";
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "skrip09-gen-"));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function bandingkan(gambar: SourceGambar, { denganFolder = true } = {}) {
    vi.stubEnv("GENERATOR_IMAGES_DIR", denganFolder ? dir : "");
    // Jaringan sengaja gagal: bukti bahwa hasil "ready" berasal dari disk, dan "blocked" berarti aplikasi tak punya jalan lain.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("tidak ada", { status: 404 })));
    const aplikasi = await resolveSourceImage(gambar);
    const skrip = bangun(gambar, denganFolder ? { GENERATOR_IMAGES_DIR: dir } : {});
    if (aplikasi.status === "ready") {
      expect(skrip).not.toBeNull();
      expect(Buffer.compare(skrip!.bytes, aplikasi.bytes)).toBe(0);
      expect(skrip!.ext).toBe(aplikasi.ext);
      const hash = crypto.createHash("sha256").update(aplikasi.bytes).digest("hex");
      expect(nama(skrip!.bytes, skrip!.ext)).toBe(importImagePath(hash, aplikasi.ext));
    } else {
      expect(skrip).toBeNull();
    }
    return aplikasi;
  }

  const kontekstual = (t: Partial<SourceGambar>) => ({ tipe: "ilustrasi_kontekstual", deskripsi_alt: "x", ...t }) as SourceGambar;

  it("ilustrasi kontekstual dengan url + berkas JPEG di disk (+ svg_fallback) -> JPEG itu, bukan sketsa", async () => {
    fs.writeFileSync(path.join(dir, "soal-ai-1-a.jpg"), JPEG);
    const r = await bandingkan(kontekstual({ url: `${URL_BASE}soal-ai-1-a.jpg`, svg_fallback: SVG }));
    expect(r).toMatchObject({ status: "ready", ext: "jpg" });
  });

  it("nama berkas impor dari berkas di disk = sha256 isi + ekstensi dari isi (bukan dari nama berkas)", async () => {
    fs.writeFileSync(path.join(dir, "ekstensi-salah.png"), JPEG);
    const g = kontekstual({ url: `${URL_BASE}ekstensi-salah.png` });
    await bandingkan(g);
    const hash = crypto.createHash("sha256").update(JPEG).digest("hex");
    expect(nama(bangun(g, { GENERATOR_IMAGES_DIR: dir })!.bytes, bangun(g, { GENERATOR_IMAGES_DIR: dir })!.ext)).toBe(`impor/${hash}.jpg`);
  });

  it("berkas tidak ada di disk + ada svg_fallback -> TIDAK memakai sketsa (aplikasi diblokir, skrip tak membangun)", async () => {
    const r = await bandingkan(kontekstual({ url: `${URL_BASE}tidak-ada.jpg`, svg_fallback: SVG }));
    expect(r.status).toBe("blocked");
  });

  it("image_data valid menang atas url", async () => {
    fs.writeFileSync(path.join(dir, "x.jpg"), JPEG);
    const r = await bandingkan(kontekstual({ image_data: dataUri(PNG), url: `${URL_BASE}x.jpg` }));
    expect(r).toMatchObject({ status: "ready", ext: "png" });
  });

  it("image_data rusak + url dengan berkas di disk -> berkas di disk", async () => {
    fs.writeFileSync(path.join(dir, "x.jpg"), JPEG);
    const r = await bandingkan(kontekstual({ image_data: "bukan-data-uri", url: `${URL_BASE}x.jpg`, svg_fallback: SVG }));
    expect(r).toMatchObject({ status: "ready", ext: "jpg" });
  });

  it("url alamat lokal (tak boleh dipakai) + svg_fallback -> svg_fallback, sama di keduanya", async () => {
    const r = await bandingkan(kontekstual({ url: "http://127.0.0.1/x.jpg", svg_fallback: SVG }));
    expect(r).toMatchObject({ status: "ready", ext: "svg" });
  });

  it("berkas di disk bukan gambar -> keduanya menolak", async () => {
    fs.writeFileSync(path.join(dir, "html.jpg"), "<html>bukan gambar</html>");
    const r = await bandingkan(kontekstual({ url: `${URL_BASE}html.jpg`, svg_fallback: SVG }));
    expect(r.status).toBe("blocked");
  });

  it("berkas di disk melebihi 5 MB -> keduanya menolak", async () => {
    fs.writeFileSync(path.join(dir, "besar.png"), Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1)]));
    const r = await bandingkan(kontekstual({ url: `${URL_BASE}besar.png` }));
    expect(r.status).toBe("blocked");
  });

  it("nama berkas tak aman (path traversal) tidak pernah dibaca dari disk oleh keduanya", async () => {
    fs.writeFileSync(path.join(path.dirname(dir), "rahasia-skrip09.jpg"), JPEG);
    try {
      for (const u of [`${URL_BASE}..%2Frahasia-skrip09.jpg`, `${URL_BASE}../rahasia-skrip09.jpg`, `${URL_BASE}sub/x.jpg`]) {
        const r = await bandingkan(kontekstual({ url: u }));
        expect(r.status, u).toBe("blocked");
      }
    } finally {
      fs.rmSync(path.join(path.dirname(dir), "rahasia-skrip09.jpg"), { force: true });
    }
  });

  it("berkas bernama aneh yang BENAR-BENAR ada di folder (diawali titik, mengandung %) tidak dibaca oleh keduanya", async () => {
    fs.writeFileSync(path.join(dir, ".tersembunyi.jpg"), JPEG);
    fs.writeFileSync(path.join(dir, "a%20b.jpg"), JPEG);
    for (const u of [`${URL_BASE}.tersembunyi.jpg`, `${URL_BASE}a%20b.jpg`, `${URL_BASE}a b.jpg`]) {
      const r = await bandingkan(kontekstual({ url: u, svg_fallback: SVG }));
      expect(r.status, u).toBe("blocked");
    }
  });
  it("folder tidak diatur -> url generator tidak dibaca dari disk (aplikasi mencoba HTTP, skrip tak membangun)", async () => {
    fs.writeFileSync(path.join(dir, "x.jpg"), JPEG);
    const r = await bandingkan(kontekstual({ url: `${URL_BASE}x.jpg`, svg_fallback: SVG }), { denganFolder: false });
    expect(r.status).toBe("blocked");
  });

  it("tipe url yang menunjuk berkas generator di disk -> dibaca keduanya; url luar -> tidak", async () => {
    fs.writeFileSync(path.join(dir, "u.jpg"), JPEG);
    expect(await bandingkan({ tipe: "url", url: `${URL_BASE}u.jpg`, deskripsi_alt: "x" })).toMatchObject({ status: "ready", ext: "jpg" });
    expect((await bandingkan({ tipe: "url", url: "https://contoh.test/a.png", deskripsi_alt: "x" })).status).toBe("blocked");
  });

  it("awalan URL kustom (GENERATOR_IMAGES_URL_PREFIX) dipatuhi sama oleh keduanya", async () => {
    fs.writeFileSync(path.join(dir, "k.jpg"), JPEG);
    vi.stubEnv("GENERATOR_IMAGES_URL_PREFIX", "https://gen.contoh.test/gambar");
    vi.stubEnv("GENERATOR_IMAGES_DIR", dir);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 404 })));
    const g = kontekstual({ url: "https://gen.contoh.test/gambar/k.jpg" });
    const aplikasi = await resolveSourceImage(g);
    const skrip = bangun(g, { GENERATOR_IMAGES_DIR: dir, GENERATOR_IMAGES_URL_PREFIX: "https://gen.contoh.test/gambar" });
    expect(aplikasi.status).toBe("ready");
    expect(skrip).not.toBeNull();
    expect(Buffer.compare(skrip!.bytes, (aplikasi as { bytes: Buffer }).bytes)).toBe(0);
    // awalan lain (soal.ayotka.id) tidak lagi dikenali
    expect(bangun(kontekstual({ url: `${URL_BASE}k.jpg` }), { GENERATOR_IMAGES_DIR: dir, GENERATOR_IMAGES_URL_PREFIX: "https://gen.contoh.test/gambar" })).toBeNull();
  });
});
