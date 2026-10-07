import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { precheckSourceGambar, previewImageSrc, resolveSourceImage } from "@/lib/soal-import/media";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>`;

describe("resolveSourceImage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tidak ada gambar -> status none", async () => {
    expect(await resolveSourceImage(null)).toEqual({ status: "none" });
    expect(await resolveSourceImage(undefined)).toEqual({ status: "none" });
  });

  it("perlu_ilustrasi selalu diblokir dengan pesan yang jelas", async () => {
    const r = await resolveSourceImage({ tipe: "perlu_ilustrasi", deskripsi_alt: "x" });
    expect(r).toMatchObject({ status: "blocked" });
    expect((r as { reason: string }).reason).toMatch(/ilustrator/);
  });

  it("svg valid -> ready, mime image/svg+xml, isi persis sama", async () => {
    const r = await resolveSourceImage({ tipe: "svg", svg_content: SVG, deskripsi_alt: "lingkaran" });
    expect(r).toMatchObject({ status: "ready", mime: "image/svg+xml", ext: "svg" });
    expect((r as { bytes: Buffer }).bytes.toString("utf-8")).toBe(SVG);
  });

  it("svg dengan prefix <?xml juga diterima", async () => {
    const withXmlProlog = `<?xml version="1.0"?>${SVG}`;
    const r = await resolveSourceImage({ tipe: "svg", svg_content: withXmlProlog, deskripsi_alt: "" });
    expect(r.status).toBe("ready");
  });

  it("svg kosong atau bukan markup SVG -> diblokir", async () => {
    expect(await resolveSourceImage({ tipe: "svg", svg_content: "", deskripsi_alt: "" })).toMatchObject({ status: "blocked" });
    expect(await resolveSourceImage({ tipe: "svg", svg_content: "bukan svg sama sekali", deskripsi_alt: "" })).toMatchObject({
      status: "blocked",
    });
  });

  it("svg dengan atribut ganda di satu tag -> diblokir (bug nyata ditemukan di soal A11-SMP-MAT-01: <line x=.. y=.. x=.. y=..> alih-alih x1/y1/x2/y2)", async () => {
    const svgRusak = `<svg viewBox='0 0 480 260' width='100%' xmlns='http://www.w3.org/2000/svg'><line x='100' y='200' x='220' y='80' stroke='#475569' stroke-width='2'/></svg>`;
    const r = await resolveSourceImage({ tipe: "svg", svg_content: svgRusak, deskripsi_alt: "" });
    expect(r).toMatchObject({ status: "blocked" });
    expect((r as { reason: string }).reason).toMatch(/atribut "x" ditulis dua kali/);
  });

  it("nama atribut yang sama di tag BERBEDA tidak dianggap masalah (bukan false-positive)", async () => {
    const svgValid = `<svg viewBox='0 0 10 10' xmlns='http://www.w3.org/2000/svg'><circle cx='1' cy='1' r='1'/><circle cx='2' cy='2' r='1'/></svg>`;
    const r = await resolveSourceImage({ tipe: "svg", svg_content: svgValid, deskripsi_alt: "" });
    expect(r.status).toBe("ready");
  });

  it("url valid mengunduh gambar sungguhan lalu mengenali tipenya dari isi (bukan dari nama file)", async () => {
    const fetchMock = vi.fn(async () => new Response(PNG, { status: 200, headers: { "content-type": "image/png" } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveSourceImage({ tipe: "url", url: "https://cdn.soal.ayotka.id/gambar/1.png", deskripsi_alt: "grafik" });
    expect(r).toMatchObject({ status: "ready", mime: "image/png", ext: "png" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("url kosong -> diblokir tanpa memanggil fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveSourceImage({ tipe: "url", deskripsi_alt: "" });
    expect(r).toMatchObject({ status: "blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("url gagal diunduh (status bukan 2xx) -> diblokir dengan status kode disebut", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    const r = await resolveSourceImage({ tipe: "url", url: "https://cdn.soal.ayotka.id/hilang.png", deskripsi_alt: "" });
    expect((r as { reason: string }).reason).toMatch(/404/);
  });

  it("url isinya bukan gambar (mis. halaman HTML) -> diblokir", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>bukan gambar</html>", { status: 200 })));
    const r = await resolveSourceImage({ tipe: "url", url: "https://cdn.soal.ayotka.id/salah.png", deskripsi_alt: "" });
    expect(r).toMatchObject({ status: "blocked" });
  });

  it("url melebihi 5 MB (content-length) -> diblokir tanpa membaca body", async () => {
    const fetchMock = vi.fn(async () => new Response(PNG, { status: 200, headers: { "content-length": String(6 * 1024 * 1024) } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveSourceImage({ tipe: "url", url: "https://cdn.soal.ayotka.id/besar.png", deskripsi_alt: "" });
    expect((r as { reason: string }).reason).toMatch(/5 MB/);
  });

  it("url ke alamat privat/lokal ditolak sebelum sempat fetch (proteksi SSRF)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const bad of ["http://localhost/x.png", "http://127.0.0.1/x.png", "http://192.168.1.5/x.png", "http://10.0.0.1/x.png", "ftp://cdn.soal.ayotka.id/x.png"]) {
      const r = await resolveSourceImage({ tipe: "url", url: bad, deskripsi_alt: "" });
      expect(r.status).toBe("blocked");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirect ke alamat privat ditolak (tidak diikuti)", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveSourceImage({ tipe: "url", url: "https://cdn.soal.ayotka.id/redir", deskripsi_alt: "" });
    expect(r.status).toBe("blocked");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("redirect ke host publik lain diikuti sampai berhasil", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://cdn2.soal.ayotka.id/final.png" } }))
      .mockResolvedValueOnce(new Response(PNG, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveSourceImage({ tipe: "url", url: "https://cdn.soal.ayotka.id/awal", deskripsi_alt: "" });
    expect(r).toMatchObject({ status: "ready", mime: "image/png" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ilustrasi_kontekstual dengan image_data valid -> ready dengan mime dan ext sesuai magic bytes", async () => {
    const jpegDataUri = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=`;
    const r = await resolveSourceImage({
      tipe: "ilustrasi_kontekstual",
      image_data: jpegDataUri,
      deskripsi_alt: "teralis",
    });
    expect(r).toMatchObject({ status: "ready", mime: "image/jpeg", ext: "jpg" });
  });

  it("ilustrasi_kontekstual dengan svg_fallback (tanpa image_data) -> ready memakai SVG", async () => {
    const r = await resolveSourceImage({
      tipe: "ilustrasi_kontekstual",
      svg_fallback: SVG,
      deskripsi_alt: "fallback svg",
    });
    expect(r).toMatchObject({ status: "ready", mime: "image/svg+xml", ext: "svg" });
    expect((r as { bytes: Buffer }).bytes.toString("utf-8")).toBe(SVG);
  });

  it("ilustrasi_kontekstual tanpa image_data dan tanpa svg_fallback -> blocked", async () => {
    const r = await resolveSourceImage({
      tipe: "ilustrasi_kontekstual",
      deskripsi_alt: "kosong",
    });
    expect(r).toMatchObject({ status: "blocked" });
  });
});

describe("ilustrasi_kontekstual dengan url (bentuk baru generator sejak 6 Okt 2026: gambar di disk server)", () => {
  const URL_GEN = "https://soal.ayotka.id/soal-images/soal-ai-1790585830926-12-jglj.jpg";
  const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 7)]);
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "media-gen-"));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const kontekstual = (tambahan: Record<string, string>) =>
    ({ tipe: "ilustrasi_kontekstual", deskripsi_alt: "x", ...tambahan }) as Parameters<typeof resolveSourceImage>[0];

  it("url generator dibaca dari DISK bila GENERATOR_IMAGES_DIR diatur - tanpa jaringan sama sekali", async () => {
    fs.writeFileSync(path.join(dir, "soal-ai-1790585830926-12-jglj.jpg"), JPEG);
    vi.stubEnv("GENERATOR_IMAGES_DIR", dir);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveSourceImage(kontekstual({ url: URL_GEN, svg_fallback: SVG }));
    expect(r).toMatchObject({ status: "ready", mime: "image/jpeg", ext: "jpg" });
    expect(Buffer.compare((r as { bytes: Buffer }).bytes, JPEG)).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GENERATOR_IMAGES_DIR belum diatur -> gambar diunduh lewat HTTP (bukan sketsa svg_fallback)", async () => {
    const fetchMock = vi.fn(async () => new Response(PNG, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveSourceImage(kontekstual({ url: URL_GEN, svg_fallback: SVG }));
    expect(r).toMatchObject({ status: "ready", mime: "image/png", ext: "png" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("berkas tidak ada di disk -> jatuh ke unduhan HTTP", async () => {
    vi.stubEnv("GENERATOR_IMAGES_DIR", dir);
    const fetchMock = vi.fn(async () => new Response(PNG, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveSourceImage(kontekstual({ url: URL_GEN }));
    expect(r).toMatchObject({ status: "ready", ext: "png" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("url ADA tetapi gagal diambil -> DIBLOKIR dengan alasan; TIDAK diam-diam memakai sketsa svg_fallback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("tidak ada", { status: 404 })));
    const r = await resolveSourceImage(kontekstual({ url: URL_GEN, svg_fallback: SVG }));
    expect(r).toMatchObject({ status: "blocked" });
    expect((r as { reason: string }).reason).toMatch(/tidak bisa diambil/);
    expect((r as { reason: string }).reason).toMatch(/404/);
  });

  it("jaringan putus saat mengambil url -> diblokir (bukan sketsa)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET"); }));
    const r = await resolveSourceImage(kontekstual({ url: URL_GEN, svg_fallback: SVG }));
    expect(r).toMatchObject({ status: "blocked" });
  });

  it("image_data valid menang atas url (tidak ada panggilan jaringan)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const dataUri = `data:image/png;base64,${PNG.toString("base64")}`;
    const r = await resolveSourceImage(kontekstual({ image_data: dataUri, url: URL_GEN, svg_fallback: SVG }));
    expect(r).toMatchObject({ status: "ready", mime: "image/png" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("image_data rusak + url valid -> url dipakai (bukan sketsa)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(PNG, { status: 200 })));
    const r = await resolveSourceImage(kontekstual({ image_data: "bukan-data-uri", url: URL_GEN, svg_fallback: SVG }));
    expect(r).toMatchObject({ status: "ready", ext: "png" });
  });

  it("url tidak boleh dipakai (alamat lokal) + ada svg_fallback -> svg_fallback dipakai, tanpa jaringan", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveSourceImage(kontekstual({ url: "http://127.0.0.1/x.jpg", svg_fallback: SVG }));
    expect(r).toMatchObject({ status: "ready", mime: "image/svg+xml" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("url tidak boleh dipakai + tanpa svg_fallback -> diblokir", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const r = await resolveSourceImage(kontekstual({ url: "ftp://x/y.jpg" }));
    expect(r).toMatchObject({ status: "blocked" });
  });

  it("url kosong/spasi dianggap tidak ada", async () => {
    const r = await resolveSourceImage(kontekstual({ url: "   ", svg_fallback: SVG }));
    expect(r).toMatchObject({ status: "ready", mime: "image/svg+xml" });
  });

  it("berkas di disk bukan gambar -> diblokir (tidak mencoba HTTP yang akan menyajikan berkas sama)", async () => {
    fs.writeFileSync(path.join(dir, "soal-ai-1790585830926-12-jglj.jpg"), "<html>");
    vi.stubEnv("GENERATOR_IMAGES_DIR", dir);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveSourceImage(kontekstual({ url: URL_GEN, svg_fallback: SVG }));
    expect(r).toMatchObject({ status: "blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tipe url yang menunjuk gambar generator juga dibaca dari disk", async () => {
    fs.writeFileSync(path.join(dir, "soal-ai-1790585830926-12-jglj.jpg"), JPEG);
    vi.stubEnv("GENERATOR_IMAGES_DIR", dir);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await resolveSourceImage({ tipe: "url", url: URL_GEN, deskripsi_alt: "" });
    expect(r).toMatchObject({ status: "ready", ext: "jpg" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pra-periksa (tanpa jaringan): url yang bisa dipakai lolos walau image_data rusak; tanpa apa pun -> pesan", () => {
    expect(precheckSourceGambar(kontekstual({ url: URL_GEN }))).toBeNull();
    expect(precheckSourceGambar(kontekstual({ image_data: "rusak", url: URL_GEN }))).toBeNull();
    expect(precheckSourceGambar(kontekstual({ image_data: "rusak" }))).toMatch(/Format image_data/);
    expect(precheckSourceGambar(kontekstual({ image_data: "rusak", svg_fallback: SVG }))).toBeNull();
    expect(precheckSourceGambar(kontekstual({ url: "http://localhost/x.jpg" }))).toMatch(/kosong di sumber/);
    expect(precheckSourceGambar(kontekstual({}))).toMatch(/kosong di sumber/);
  });

  it("pratinjau memuat url generator langsung (lebih baik daripada sketsa), dan image_data tetap didahulukan", () => {
    expect(previewImageSrc(kontekstual({ url: URL_GEN, svg_fallback: SVG }))).toBe(URL_GEN);
    expect(previewImageSrc(kontekstual({ image_data: "data:image/png;base64,abc", url: URL_GEN }))).toBe("data:image/png;base64,abc");
    expect(previewImageSrc(kontekstual({ url: "http://127.0.0.1/x.jpg", svg_fallback: SVG }))).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});

describe("previewImageSrc", () => {
  it("tipe url -> url sumber apa adanya (dimuat langsung oleh browser admin)", () => {
    expect(previewImageSrc({ tipe: "url", url: "https://cdn.soal.ayotka.id/a.png", deskripsi_alt: "" })).toBe(
      "https://cdn.soal.ayotka.id/a.png",
    );
  });

  it("tipe svg -> data URI base64 (bukan HTML mentah)", () => {
    const src = previewImageSrc({ tipe: "svg", svg_content: SVG, deskripsi_alt: "" });
    expect(src).toMatch(/^data:image\/svg\+xml;base64,/);
    const decoded = Buffer.from(src!.split(",")[1]!, "base64").toString("utf-8");
    expect(decoded).toBe(SVG);
  });

  it("tipe ilustrasi_kontekstual -> langsung kembalikan image_data", () => {
    const jpegDataUri = "data:image/jpeg;base64,abc123";
    expect(previewImageSrc({ tipe: "ilustrasi_kontekstual", image_data: jpegDataUri, deskripsi_alt: "" })).toBe(
      jpegDataUri,
    );
  });

  it("tipe ilustrasi_kontekstual tanpa image_data -> gunakan svg_fallback", () => {
    const src = previewImageSrc({ tipe: "ilustrasi_kontekstual", svg_fallback: SVG, deskripsi_alt: "" });
    expect(src).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("perlu_ilustrasi atau kosong -> null (tidak ada yang bisa ditampilkan)", () => {
    expect(previewImageSrc({ tipe: "perlu_ilustrasi", deskripsi_alt: "" })).toBeNull();
    expect(previewImageSrc(null)).toBeNull();
    expect(previewImageSrc(undefined)).toBeNull();
  });

  it("svg yang tidak valid (atribut ganda) -> null, bukan data-URI yang dijamin gagal dirender", () => {
    const svgRusak = `<svg viewBox='0 0 480 260' xmlns='http://www.w3.org/2000/svg'><line x='100' y='200' x='220' y='80'/></svg>`;
    expect(previewImageSrc({ tipe: "svg", svg_content: svgRusak, deskripsi_alt: "" })).toBeNull();
  });
});
