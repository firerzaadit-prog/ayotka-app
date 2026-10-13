import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MAKS_BYTE_GAMBAR_PDF,
  adalahSvg,
  alamatGambarLengkap,
  ambilBerkasGambar,
  ambilGambarRaster,
  hostTerlarang,
  normalisasiRaster,
  siapkanMedia,
} from "@/lib/pdf/gambar-pdf";
import { muatkanGambar, potongTeks, ukuranSvg } from "@/lib/pdf/rapor-komponen";
import { pngContoh, SVG_DIAGRAM } from "../helpers/rapor-fixture";

const png = async () => Buffer.from((await pngContoh(80, 50)).split(",")[1]!, "base64");
const jpeg = async () => sharp(await png()).jpeg().toBuffer();
const webp = async () => sharp(await png()).webp().toBuffer();

type Res = { ok: boolean; arrayBuffer(): Promise<ArrayBuffer>; headers?: { get(n: string): string | null } };
const jawab = (bytes: Buffer, o: { ok?: boolean; panjang?: string | null } = {}): Res => ({
  ok: o.ok ?? true,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  headers: { get: (n: string) => (n.toLowerCase() === "content-length" ? (o.panjang ?? null) : null) },
});

describe("alamatGambarLengkap", () => {
  it("http(s) mutlak dan data URI gambar diterima apa adanya", () => {
    expect(alamatGambarLengkap("https://ayotka.id/media/a.png", null)).toBe("https://ayotka.id/media/a.png");
    expect(alamatGambarLengkap("http://ayotka.id/a.png", null)).toBe("http://ayotka.id/a.png");
    expect(alamatGambarLengkap("data:image/png;base64,AAAA", null)).toBe("data:image/png;base64,AAAA");
  });

  it("jalur dari akar situs dilengkapi asal situs; tanpa asal situs null; '//' (protokol relatif) ditolak", () => {
    expect(alamatGambarLengkap("/media/a.png", "https://ayotka.id")).toBe("https://ayotka.id/media/a.png");
    expect(alamatGambarLengkap("/media/a.png", "https://ayotka.id/")).toBe("https://ayotka.id/media/a.png");
    expect(alamatGambarLengkap("/media/a.png", null)).toBeNull();
    expect(alamatGambarLengkap("/media/a.png", "ayotka.id")).toBeNull();
    expect(alamatGambarLengkap("//evil.example/a.png", "https://ayotka.id")).toBeNull();
  });

  it("skema lain (file:, javascript:, data bukan gambar, ftp:) dan teks kosong ditolak", () => {
    for (const s of ["file:///etc/passwd", "javascript:alert(1)", "data:text/html;base64,AAAA", "ftp://x/a.png", "C:/Windows/win.ini", "../a.png", "", "   "]) {
      expect(alamatGambarLengkap(s, "https://ayotka.id"), s).toBeNull();
    }
  });
});

describe("ambilBerkasGambar", () => {
  it("data URI base64 dan data URI teks (SVG) terbaca; rusak atau kosong null", async () => {
    const b = await png();
    expect(await ambilBerkasGambar(`data:image/png;base64,${b.toString("base64")}`)).toEqual(b);
    const svg = await ambilBerkasGambar(`data:image/svg+xml;utf8,${encodeURIComponent("<svg/>")}`);
    expect(svg?.toString()).toBe("<svg/>");
    expect(await ambilBerkasGambar("data:image/png;base64,")).toBeNull();
    expect(await ambilBerkasGambar("data:image/png")).toBeNull();
  });

  it("alamat http: berkas diambil lewat pengambil yang diberikan, dengan batas waktu", async () => {
    const b = await png();
    const ambil = vi.fn(async (_u: string, init?: { signal?: AbortSignal }) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return jawab(b);
    });
    expect(await ambilBerkasGambar("https://ayotka.id/a.png", { ambil })).toEqual(b);
    expect(ambil.mock.calls[0]![0]).toBe("https://ayotka.id/a.png");
  });

  it("gagal (status bukan ok, jaringan putus, kosong, terlalu besar) = null, tidak melempar", async () => {
    const b = await png();
    expect(await ambilBerkasGambar("https://x.test/a.png", { ambil: async () => jawab(b, { ok: false }) })).toBeNull();
    expect(await ambilBerkasGambar("https://x.test/a.png", { ambil: async () => { throw new Error("putus"); } })).toBeNull();
    expect(await ambilBerkasGambar("https://x.test/a.png", { ambil: async () => jawab(Buffer.alloc(0)) })).toBeNull();
    // ukuran yang diumumkan server sudah melebihi batas: tidak diunduh sama sekali
    const ambilBesar = vi.fn(async () => jawab(b, { panjang: String(MAKS_BYTE_GAMBAR_PDF + 1) }));
    expect(await ambilBerkasGambar("https://x.test/a.png", { ambil: ambilBesar })).toBeNull();
    // ukuran sebenarnya melebihi batas walau tidak diumumkan
    expect(await ambilBerkasGambar("https://x.test/a.png", { ambil: async () => jawab(Buffer.alloc(MAKS_BYTE_GAMBAR_PDF + 1, 1)) })).toBeNull();
  });

  it("alamat yang tidak diizinkan tidak pernah diambil", async () => {
    const ambil = vi.fn();
    expect(await ambilBerkasGambar("file:///etc/passwd", { ambil: ambil as never })).toBeNull();
    expect(await ambilBerkasGambar("/lokal.png", { ambil: ambil as never })).toBeNull();
    expect(ambil).not.toHaveBeenCalled();
  });
});

describe("hostTerlarang dan pengambilan gambar dari alamat internal (SSRF)", () => {
  it("localhost, jaringan pribadi, loopback, link-local (metadata awan), dan nama internal terlarang", () => {
    for (const h of [
      "localhost", "app.localhost", "printer.local", "db.internal", "router.lan", "nas.home",
      "127.0.0.1", "127.10.20.30", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1",
      "[::1]", "::1", "::", "fd12:3456::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "",
    ]) {
      expect(hostTerlarang(h), h).toBe(true);
    }
  });

  it("host publik (nama maupun IP) diperbolehkan", () => {
    for (const h of ["ayotka.id", "www.affiliate.id", "cdn.example.com", "8.8.8.8", "172.15.0.1", "172.32.0.1", "11.0.0.1", "100.63.0.1", "192.169.0.1", "2001:4860:4860::8888", "localhost.example.com"]) {
      expect(hostTerlarang(h), h).toBe(false);
    }
  });

  it("alamat internal tidak pernah diambil (pengambil tidak dipanggil), termasuk yang ditulis sebagai angka dan IPv6", async () => {
    const ambil = vi.fn();
    for (const u of ["http://localhost/a.png", "http://127.0.0.1:3001/a.png", "http://2130706433/a.png", "http://0x7f000001/a.png", "http://169.254.169.254/latest/meta-data/", "http://10.1.2.3/a.png", "http://[::1]/a.png", "https://db.internal/a.png"]) {
      expect(await ambilBerkasGambar(u, { ambil: ambil as never }), u).toBeNull();
    }
    expect(ambil).not.toHaveBeenCalled();
  });

  it("host situs sendiri tetap boleh walau berupa localhost (pengembangan lokal), tetapi host internal lain tidak", async () => {
    const b = await png();
    const ambil = vi.fn(async () => jawab(b));
    expect(await ambilBerkasGambar("http://localhost:3001/media/a.png", { asalSitus: "http://localhost:3001", ambil })).toEqual(b);
    expect(ambil).toHaveBeenCalledTimes(1);
    // port berbeda pada localhost = bukan situs sendiri
    expect(await ambilBerkasGambar("http://localhost:9999/a.png", { asalSitus: "http://localhost:3001", ambil })).toBeNull();
    expect(await ambilBerkasGambar("http://127.0.0.1:3001/a.png", { asalSitus: "http://localhost:3001", ambil })).toBeNull();
    expect(ambil).toHaveBeenCalledTimes(1);
  });

  it("jalur dari akar situs diambil lewat host situs sendiri", async () => {
    const b = await png();
    const ambil = vi.fn(async () => jawab(b));
    expect(await ambilBerkasGambar("/media/a.png", { asalSitus: "https://ayotka.id", ambil })).toEqual(b);
    expect(ambil).toHaveBeenCalledWith("https://ayotka.id/media/a.png", expect.anything());
  });

  it("alamat yang tidak bisa diurai tidak melempar", async () => {
    expect(await ambilBerkasGambar("http://", { ambil: vi.fn() as never })).toBeNull();
    expect(await ambilBerkasGambar("https://[bukan-ip", { ambil: vi.fn() as never })).toBeNull();
  });
});

describe("normalisasiRaster dan ambilGambarRaster", () => {
  it("PNG dan JPEG dipakai apa adanya (tanpa konversi)", async () => {
    const p = await png();
    const j = await jpeg();
    expect(await normalisasiRaster(p)).toBe(p);
    expect(await normalisasiRaster(j)).toBe(j);
  });

  it("WebP diubah ke PNG; isi bukan gambar null", async () => {
    const hasil = await normalisasiRaster(await webp());
    expect(hasil).not.toBeNull();
    expect(hasil!.subarray(1, 4).toString()).toBe("PNG");
    expect(await normalisasiRaster(Buffer.from("bukan gambar sama sekali"))).toBeNull();
    expect(await normalisasiRaster(Buffer.alloc(0))).toBeNull();
  });

  it("ambilGambarRaster: SVG lewat alamat bukan raster (null); gambar raster lolos", async () => {
    expect(await ambilGambarRaster("data:image/svg+xml;utf8," + encodeURIComponent(SVG_DIAGRAM))).toBeNull();
    const hasil = await ambilGambarRaster(`data:image/png;base64,${(await png()).toString("base64")}`);
    expect(hasil).not.toBeNull();
  });
});

describe("adalahSvg", () => {
  it("mengenali SVG dari isinya (huruf besar kecil dan prolog xml)", () => {
    expect(adalahSvg(Buffer.from('<?xml version="1.0"?><SVG xmlns="http://www.w3.org/2000/svg"></SVG>'))).toBe(true);
    expect(adalahSvg(Buffer.from(SVG_DIAGRAM))).toBe(true);
    expect(adalahSvg(Buffer.from("<html></html>"))).toBe(false);
  });
});

describe("siapkanMedia", () => {
  it("diagram SVG dari svgContent: siap digambar sebagai vektor", async () => {
    const hasil = await siapkanMedia({ tipe: "svg", label: "Diagram", svgContent: SVG_DIAGRAM });
    expect(hasil).toMatchObject({ jenis: "svg", label: "Diagram" });
  });

  it("diagram SVG berupa alamat (.svg): isinya diambil; alamat yang ternyata raster dipakai sebagai raster", async () => {
    const ambilSvg = async () => jawab(Buffer.from(SVG_DIAGRAM));
    expect(await siapkanMedia({ tipe: "svg", label: "D", url: "https://x.test/d.svg" }, { ambil: ambilSvg })).toMatchObject({ jenis: "svg" });
    const b = await png();
    expect(await siapkanMedia({ tipe: "svg", label: "D", url: "https://x.test/d.png" }, { ambil: async () => jawab(b) })).toMatchObject({ jenis: "raster" });
  });

  it("SVG tidak sah (kosong, bukan SVG, atribut ganda, terlalu besar) = gagal", async () => {
    for (const svg of ["", "   ", "<html/>", '<svg xmlns="http://www.w3.org/2000/svg"><line x="1" x="2"/></svg>', `<svg xmlns="http://www.w3.org/2000/svg">${"a".repeat(1024 * 1024 + 10)}</svg>`]) {
      expect(await siapkanMedia({ tipe: "svg", label: "D", svgContent: svg }), svg.slice(0, 30)).toEqual({ jenis: "gagal", label: "D" });
    }
    expect(await siapkanMedia({ tipe: "svg", label: "D" })).toEqual({ jenis: "gagal", label: "D" });
  });

  it("foto: raster lolos, WebP diubah, alamat gagal atau isi bukan gambar = gagal, tanpa alamat = gagal", async () => {
    const b = await png();
    expect(await siapkanMedia({ tipe: "foto", label: "F", url: "https://x.test/f.png" }, { ambil: async () => jawab(b) })).toMatchObject({ jenis: "raster" });
    const w = await webp();
    expect(await siapkanMedia({ tipe: "foto", label: "F", url: "https://x.test/f.webp" }, { ambil: async () => jawab(w) })).toMatchObject({ jenis: "raster" });
    expect(await siapkanMedia({ tipe: "foto", label: "F", url: "https://x.test/f.png" }, { ambil: async () => jawab(b, { ok: false }) })).toEqual({ jenis: "gagal", label: "F" });
    expect(await siapkanMedia({ tipe: "foto", label: "F", url: "https://x.test/f.png" }, { ambil: async () => jawab(Buffer.from("teks biasa")) })).toEqual({ jenis: "gagal", label: "F" });
    expect(await siapkanMedia({ tipe: "foto", label: "F" })).toEqual({ jenis: "gagal", label: "F" });
  });

  it("foto yang ternyata SVG diperlakukan sebagai diagram", async () => {
    expect(await siapkanMedia({ tipe: "foto", label: "F", url: "https://x.test/f" }, { ambil: async () => jawab(Buffer.from(SVG_DIAGRAM)) })).toMatchObject({ jenis: "svg" });
  });
});

describe("ukuranSvg", () => {
  it("dari viewBox (didahulukan), dari width/height, dan bawaan 300x200", () => {
    expect(ukuranSvg('<svg viewBox="0 0 400 250" width="10" height="10">')).toEqual({ lebar: 400, tinggi: 250 });
    expect(ukuranSvg('<svg viewBox="0,0,120.5,80">')).toEqual({ lebar: 120.5, tinggi: 80 });
    expect(ukuranSvg('<svg width="320" height="200">')).toEqual({ lebar: 320, tinggi: 200 });
    expect(ukuranSvg("<svg>")).toEqual({ lebar: 300, tinggi: 200 });
    expect(ukuranSvg("bukan svg")).toEqual({ lebar: 300, tinggi: 200 });
    expect(ukuranSvg('<svg viewBox="0 0 0 0" width="50" height="40">')).toEqual({ lebar: 50, tinggi: 40 });
  });
});

describe("muatkanGambar", () => {
  it("diperkecil agar muat di kotak, dengan perbandingan tetap", () => {
    const { w, h } = muatkanGambar(800, 400, 300, 190);
    expect(w).toBeLessThanOrEqual(300);
    expect(h).toBeLessThanOrEqual(190);
    expect(w / h).toBeCloseTo(2, 5);
  });

  it("gambar kecil diperbesar paling banyak 1,25x", () => {
    expect(muatkanGambar(100, 60, 300, 190)).toEqual({ w: 125, h: 75 });
  });

  it("ukuran tidak sah memakai kotak maksimum, bukan NaN", () => {
    expect(muatkanGambar(0, 0, 300, 190)).toEqual({ w: 300, h: 190 });
    expect(muatkanGambar(Number.NaN, 50, 300, 190)).toEqual({ w: 300, h: 190 });
  });
});

describe("potongTeks", () => {
  it("merapikan spasi dan memotong dengan elipsis", () => {
    expect(potongTeks("  a   b \n c ", 20)).toBe("a b c");
    expect(potongTeks("abcdefghij", 5)).toBe("abcd…");
    expect(potongTeks("abcde", 5)).toBe("abcde");
  });
});
