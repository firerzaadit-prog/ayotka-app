import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";

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
let bangun: (g: unknown) => Hasil;
let nama: (bytes: Buffer, ext: string) => string;

beforeAll(async () => {
  const berkas = path.resolve(__dirname, "../../deploy/self-host/skrip/09-bangun-ulang-gambar-impor.mjs");
  const mod = (await import(/* @vite-ignore */ pathToFileURL(berkas).href)) as {
    bangunGambarSumber: (g: unknown) => Hasil;
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

  it("tipe url (harus diunduh dari luar) dan gambar kosong tidak dibangun skrip", () => {
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
