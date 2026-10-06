import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ buatAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: m.buatAdmin }));

import { pathMediaAman, simpanBerkasLokal, urlPublikLokal } from "@/lib/storage/media-lokal";
import { importImagePath, publicImageUrl, uploadImportImages, uploadQuestionImage } from "@/lib/supabase/storage";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

// `induk` milik tes ini sendiri: folder media (`dir`) ada DI DALAMNYA, jadi percobaan keluar folder lewat ".." tetap
// mendarat di folder yang dibersihkan tes, tidak di folder Temp bersama (dan tidak bergantung pada sisa tes lain).
let induk = "";
let dir = "";

beforeEach(async () => {
  vi.resetAllMocks();
  m.buatAdmin.mockImplementation(() => {
    throw new Error("Supabase tidak boleh dipakai saat STORAGE_DRIVER=local");
  });
  induk = await mkdtemp(path.join(tmpdir(), "ayotka-media-"));
  dir = path.join(induk, "media");
  await mkdir(dir);
  process.env.STORAGE_DRIVER = "local";
  process.env.MEDIA_DIR = dir;
  process.env.MEDIA_PUBLIC_BASE_URL = "https://ayotka.test/media/soal-media/"; // garis miring akhir sengaja ada
});

afterEach(async () => {
  delete process.env.STORAGE_DRIVER;
  delete process.env.MEDIA_DIR;
  delete process.env.MEDIA_PUBLIC_BASE_URL;
  await rm(induk, { recursive: true, force: true });
});

describe("pathMediaAman", () => {
  it("menerima path yang dibuat aplikasi (uuid.ext, impor/<hash>.ext)", () => {
    for (const p of ["a.png", "0b7d3c1e-1111-4222-8333-444455556666.jpg", "impor/abc123.png", "x-y_z/0.webp"]) {
      expect(pathMediaAman(p)).toBe(true);
    }
  });

  it("menolak semua upaya keluar dari folder atau berkas tersembunyi", () => {
    for (const p of ["", "../x.png", "/etc/passwd", "a/../b.png", "a/..", "a\\b.png", ".htaccess", "a/.env", "a//b.png", "a/", " a.png", "a b.png", "é.png", "a/./b.png"]) {
      expect(pathMediaAman(p), JSON.stringify(p)).toBe(false);
    }
  });
});

describe("urlPublikLokal", () => {
  it("menggabungkan alamat dasar (garis miring akhir dibuang) dengan path", () => {
    expect(urlPublikLokal("impor/abc.png")).toBe("https://ayotka.test/media/soal-media/impor/abc.png");
  });

  it("menolak path berbahaya dan konfigurasi yang kurang", () => {
    expect(() => urlPublikLokal("../x.png")).toThrow(/tidak valid/);
    delete process.env.MEDIA_PUBLIC_BASE_URL;
    expect(() => urlPublikLokal("a.png")).toThrow(/MEDIA_DIR dan MEDIA_PUBLIC_BASE_URL/);
  });
});

describe("simpanBerkasLokal", () => {
  it("menulis berkas (membuat subfolder) dengan isi persis sama", async () => {
    expect(await simpanBerkasLokal("impor/a.png", PNG, { timpa: false })).toBeNull();
    expect((await readFile(path.join(dir, "impor", "a.png"))).equals(PNG)).toBe(true);
  });

  it("timpa=false menolak berkas yang sudah ada; timpa=true menggantinya tanpa meninggalkan berkas sementara", async () => {
    await simpanBerkasLokal("a.png", PNG, { timpa: false });
    const kedua = await simpanBerkasLokal("a.png", Buffer.from("lain"), { timpa: false });
    expect(kedua?.error).toMatch(/EEXIST|exist/i);
    expect((await readFile(path.join(dir, "a.png"))).equals(PNG)).toBe(true);

    expect(await simpanBerkasLokal("a.png", Buffer.from("baru"), { timpa: true })).toBeNull();
    expect((await readFile(path.join(dir, "a.png"))).toString()).toBe("baru");
    expect(await readdir(dir)).toEqual(["a.png"]);
  });

  it("path berbahaya ditolak tanpa menyentuh disk", async () => {
    const hasil = await simpanBerkasLokal("../keluar.png", PNG, { timpa: true });
    expect(hasil?.error).toMatch(/tidak valid/);
    await expect(stat(path.join(induk, "keluar.png"))).rejects.toThrow();
    expect(await readdir(dir)).toEqual([]);
    expect(await readdir(induk)).toEqual(["media"]); // tidak ada berkas nyasar di folder induk
  });
});

describe("uploadQuestionImage (mode lokal)", () => {
  it("menyimpan gambar valid ke disk dan mengembalikan URL publik; Supabase tidak disentuh", async () => {
    const file = new File([PNG], "x.png", { type: "image/png" });
    const hasil = await uploadQuestionImage(file);
    expect("url" in hasil).toBe(true);
    if (!("url" in hasil)) return;
    expect(hasil.url).toMatch(/^https:\/\/ayotka\.test\/media\/soal-media\/[0-9a-f-]{36}\.png$/);
    const nama = hasil.url.split("/").pop()!;
    expect((await readFile(path.join(dir, nama))).equals(PNG)).toBe(true);
    expect(m.buatAdmin).not.toHaveBeenCalled();
  });

  it("menolak berkas berlabel gambar yang isinya bukan gambar, tipe terlarang, dan terlalu besar", async () => {
    const html = new File(["<html>login</html>"], "x.png", { type: "image/png" });
    expect(await uploadQuestionImage(html)).toEqual({ error: expect.stringMatching(/bukan gambar/) });
    const pdf = new File([PNG], "x.pdf", { type: "application/pdf" });
    expect(await uploadQuestionImage(pdf)).toEqual({ error: expect.stringMatching(/hanya file gambar/i) });
    const besar = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "x.png", { type: "image/png" });
    expect(await uploadQuestionImage(besar)).toEqual({ error: expect.stringMatching(/5 MB/) });
    expect(await readdir(dir)).toEqual([]);
  });
});

describe("publicImageUrl dan uploadImportImages (mode lokal)", () => {
  it("URL dihitung lokal, bentuk path impor tidak berubah", () => {
    const p = importImagePath("abc123", "png");
    expect(p).toBe("impor/abc123.png");
    expect(publicImageUrl(p)).toBe("https://ayotka.test/media/soal-media/impor/abc123.png");
  });

  it("menyimpan semua gambar impor, aman diulang (menimpa), dan melaporkan galat path", async () => {
    const items = [
      { path: "impor/a1.png", bytes: PNG, mime: "image/png" },
      { path: "impor/b2.png", bytes: Buffer.concat([PNG, Buffer.from([0])]), mime: "image/png" },
    ];
    expect(await uploadImportImages(items)).toBeNull();
    expect(await uploadImportImages(items)).toBeNull();
    expect((await readdir(path.join(dir, "impor"))).sort()).toEqual(["a1.png", "b2.png"]);

    const gagal = await uploadImportImages([{ path: "../x.png", bytes: PNG, mime: "image/png" }]);
    expect(gagal?.error).toMatch(/tidak valid/);
    expect(await uploadImportImages([])).toBeNull();
  });
});

describe("tanpa STORAGE_DRIVER=local tetap memakai Supabase Storage (tidak ada perubahan perilaku)", () => {
  it("publicImageUrl dan uploadImportImages mendelegasikan ke klien admin Supabase", async () => {
    delete process.env.STORAGE_DRIVER;
    const unggah = vi.fn(async () => ({ error: null }));
    m.buatAdmin.mockImplementation(() => ({
      storage: {
        listBuckets: async () => ({ data: [{ name: "soal-media" }] }),
        from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://sb.test/${p}` } }), upload: unggah }),
      },
    }));
    expect(publicImageUrl("impor/a.png")).toBe("https://sb.test/impor/a.png");
    expect(await uploadImportImages([{ path: "impor/a.png", bytes: PNG, mime: "image/png" }])).toBeNull();
    expect(unggah).toHaveBeenCalledTimes(1);
    expect(await readdir(dir)).toEqual([]); // tidak ada yang ditulis ke disk
  });
});
