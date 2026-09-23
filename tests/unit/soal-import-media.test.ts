import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { previewImageSrc, resolveSourceImage } from "@/lib/soal-import/media";

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
