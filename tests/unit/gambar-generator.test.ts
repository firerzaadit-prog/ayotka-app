import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AWALAN_URL_GENERATOR_BAWAAN,
  bacaGambarGeneratorLokal,
  bacaKonfigGambarGenerator,
  pathBerkasGenerator,
} from "@/lib/soal-import/gambar-generator";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 7)]);
const MAKS = 5 * 1024 * 1024;

function bisaBuatSymlink(): boolean {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gen-sym-"));
  try {
    fs.writeFileSync(path.join(d, "a"), "x");
    fs.symlinkSync(path.join(d, "a"), path.join(d, "b"));
    return true;
  } catch {
    return false;
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
}

let induk: string;
let dir: string;
beforeEach(() => {
  // Folder induk milik tes: berkas "di luar folder gambar" dibuat di sini, bukan di folder Temp bersama.
  induk = fs.mkdtempSync(path.join(os.tmpdir(), "gen-img-"));
  dir = path.join(induk, "soal-images");
  fs.mkdirSync(dir);
});
afterEach(() => {
  fs.rmSync(induk, { recursive: true, force: true });
});

const konfig = () => bacaKonfigGambarGenerator({ GENERATOR_IMAGES_DIR: dir })!;
const url = (nama: string) => `${AWALAN_URL_GENERATOR_BAWAAN}${nama}`;

describe("bacaKonfigGambarGenerator", () => {
  it("GENERATOR_IMAGES_DIR kosong/tidak ada -> null (pembacaan disk tidak aktif)", () => {
    expect(bacaKonfigGambarGenerator({})).toBeNull();
    expect(bacaKonfigGambarGenerator({ GENERATOR_IMAGES_DIR: "   " })).toBeNull();
  });

  it("awalan bawaan https://soal.ayotka.id/soal-images/ dan folder dijadikan jalur absolut", () => {
    const k = bacaKonfigGambarGenerator({ GENERATOR_IMAGES_DIR: dir })!;
    expect(k.awalan).toBe("https://soal.ayotka.id/soal-images/");
    expect(k.dir).toBe(path.resolve(dir));
  });

  it("awalan kustom dinormalkan: garis miring akhir ditambahkan, host huruf kecil, port bawaan dibuang", () => {
    const k = bacaKonfigGambarGenerator({ GENERATOR_IMAGES_DIR: dir, GENERATOR_IMAGES_URL_PREFIX: "https://SOAL.example.id:443/img" })!;
    expect(k.awalan).toBe("https://soal.example.id/img/");
    const k2 = bacaKonfigGambarGenerator({ GENERATOR_IMAGES_DIR: dir, GENERATOR_IMAGES_URL_PREFIX: "https://soal.example.id/img///" })!;
    expect(k2.awalan).toBe("https://soal.example.id/img/");
  });

  it("awalan bukan URL http(s) -> null daripada membaca dengan awalan yang aneh", () => {
    expect(bacaKonfigGambarGenerator({ GENERATOR_IMAGES_DIR: dir, GENERATOR_IMAGES_URL_PREFIX: "bukan url" })).toBeNull();
    expect(bacaKonfigGambarGenerator({ GENERATOR_IMAGES_DIR: dir, GENERATOR_IMAGES_URL_PREFIX: "file:///etc/" })).toBeNull();
  });
});

describe("pathBerkasGenerator", () => {
  it("URL gambar generator -> jalur berkas di folder", () => {
    expect(pathBerkasGenerator(url("soal-ai-1790585830926-12-jglj.jpg"), konfig())).toBe(
      path.join(path.resolve(dir), "soal-ai-1790585830926-12-jglj.jpg"),
    );
  });

  it("query dan hash diabaikan; spasi di tepi dibuang", () => {
    const k = konfig();
    const hasil = path.join(path.resolve(dir), "a.png");
    expect(pathBerkasGenerator(`${url("a.png")}?v=2`, k)).toBe(hasil);
    expect(pathBerkasGenerator(`${url("a.png")}#x`, k)).toBe(hasil);
    expect(pathBerkasGenerator(`  ${url("a.png")}  `, k)).toBe(hasil);
  });

  it("host, awalan jalur, atau protokol yang berbeda -> null (bukan gambar generator)", () => {
    const k = konfig();
    expect(pathBerkasGenerator("https://lain.example.id/soal-images/a.png", k)).toBeNull();
    expect(pathBerkasGenerator("https://soal.ayotka.id/lain/a.png", k)).toBeNull();
    expect(pathBerkasGenerator("https://soal.ayotka.id/soal-images-x/a.png", k)).toBeNull();
    expect(pathBerkasGenerator("http://soal.ayotka.id/soal-images/a.png", k)).toBeNull();
    expect(pathBerkasGenerator("bukan url", k)).toBeNull();
    expect(pathBerkasGenerator("", k)).toBeNull();
  });

  it("path traversal dan nama tak aman ditolak", () => {
    const k = konfig();
    for (const nama of [
      "../rahasia.png",
      "..%2Frahasia.png",
      "%2e%2e/rahasia.png",
      "sub/a.png",
      "sub%2Fa.png",
      ".tersembunyi.png",
      "a b.png",
      "a%20b.png",
      "a\\b.png",
      "..",
      ".",
      "",
      "a".repeat(201),
    ]) {
      expect(pathBerkasGenerator(url(nama), k), nama).toBeNull();
    }
    // URL yang dinormalkan oleh parser URL (../ dihapus di tingkat jalur) tidak boleh lolos ke folder induk.
    expect(pathBerkasGenerator("https://soal.ayotka.id/soal-images/../x.png", k)).toBeNull();
  });
});

describe("bacaGambarGeneratorLokal", () => {
  it("tanpa konfigurasi -> null (pemanggil jatuh ke unduhan HTTP)", async () => {
    fs.writeFileSync(path.join(dir, "a.png"), PNG);
    expect(await bacaGambarGeneratorLokal(url("a.png"), MAKS, null)).toBeNull();
  });

  it("PNG dan JPEG dikenali dari ISI berkas (bukan ekstensi): ext & mime sesuai magic bytes", async () => {
    fs.writeFileSync(path.join(dir, "salah-ekstensi.png"), JPEG);
    fs.writeFileSync(path.join(dir, "b.jpg"), PNG);
    const a = await bacaGambarGeneratorLokal(url("salah-ekstensi.png"), MAKS, konfig());
    expect(a).toMatchObject({ status: "ready", mime: "image/jpeg", ext: "jpg" });
    expect(Buffer.compare((a as { bytes: Buffer }).bytes, JPEG)).toBe(0);
    const b = await bacaGambarGeneratorLokal(url("b.jpg"), MAKS, konfig());
    expect(b).toMatchObject({ status: "ready", mime: "image/png", ext: "png" });
  });

  it("berkas tidak ada -> null (bukan blocked): HTTP masih boleh mencoba", async () => {
    expect(await bacaGambarGeneratorLokal(url("tidak-ada.png"), MAKS, konfig())).toBeNull();
  });

  it("berkas ada tetapi bukan gambar -> blocked", async () => {
    fs.writeFileSync(path.join(dir, "html.png"), "<html>bukan gambar</html>");
    const r = await bacaGambarGeneratorLokal(url("html.png"), MAKS, konfig());
    expect(r).toMatchObject({ status: "blocked" });
    expect((r as { reason: string }).reason).toMatch(/bukan gambar/);
  });

  it("berkas melebihi batas -> blocked tanpa membaca isinya", async () => {
    fs.writeFileSync(path.join(dir, "besar.png"), Buffer.concat([PNG, Buffer.alloc(2000)]));
    const r = await bacaGambarGeneratorLokal(url("besar.png"), 1000, konfig());
    expect(r).toMatchObject({ status: "blocked" });
    expect((r as { reason: string }).reason).toMatch(/5 MB/);
  });

  it("nama berkas yang cocok tetapi berupa FOLDER -> null", async () => {
    fs.mkdirSync(path.join(dir, "folder.png"));
    expect(await bacaGambarGeneratorLokal(url("folder.png"), MAKS, konfig())).toBeNull();
  });

  // Windows tanpa izin khusus menolak pembuatan symlink (EPERM): tes ini dilewati di sana dan berjalan di CI Linux.
  it.skipIf(!bisaBuatSymlink())("symlink di folder yang menunjuk ke luar folder tidak diikuti", async () => {
    fs.writeFileSync(path.join(induk, "rahasia.png"), PNG);
    fs.symlinkSync(path.join(induk, "rahasia.png"), path.join(dir, "tautan.png"));
    expect(await bacaGambarGeneratorLokal(url("tautan.png"), MAKS, konfig())).toBeNull();
  });

  it("berkas bernama aneh yang BENAR-BENAR ada di folder (diawali titik, mengandung %) tetap tidak dibaca", async () => {
    fs.writeFileSync(path.join(dir, ".tersembunyi.png"), PNG);
    fs.writeFileSync(path.join(dir, "a%20b.png"), PNG);
    expect(await bacaGambarGeneratorLokal(url(".tersembunyi.png"), MAKS, konfig())).toBeNull();
    expect(await bacaGambarGeneratorLokal(url("a%20b.png"), MAKS, konfig())).toBeNull();
    expect(await bacaGambarGeneratorLokal(url("a b.png"), MAKS, konfig())).toBeNull();
  });

  it("URL bukan milik generator -> null walau berkas bernama sama ada di folder", async () => {
    fs.writeFileSync(path.join(dir, "a.png"), PNG);
    expect(await bacaGambarGeneratorLokal("https://lain.example.id/soal-images/a.png", MAKS, konfig())).toBeNull();
  });
});
