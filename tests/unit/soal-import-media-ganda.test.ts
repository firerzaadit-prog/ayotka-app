import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { precheckSourceGambar, previewMediaData, resolveAllSourceImages } from "@/lib/soal-import/media";

type Gambar = Parameters<typeof resolveAllSourceImages>[0];
type Siap = Extract<Awaited<ReturnType<typeof resolveAllSourceImages>>, { status: "ready" }>;
type Diblokir = Extract<Awaited<ReturnType<typeof resolveAllSourceImages>>, { status: "blocked" }>;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 7)]);
const JPEG_URI = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>`;
const SVG_RUSAK = `<svg viewBox='0 0 480 260' xmlns='http://www.w3.org/2000/svg'><line x='100' y='200' x='220' y='80'/></svg>`;
const URL_GEN = "https://soal.ayotka.id/soal-images/soal-ai-1790585830926-12-jglj.jpg";

const g = (o: Record<string, unknown>) => ({ deskripsi_alt: "", ...o }) as Gambar;
const siap = (r: Awaited<ReturnType<typeof resolveAllSourceImages>>): Siap => {
  expect(r.status).toBe("ready");
  return r as Siap;
};
const alasan = (r: Awaited<ReturnType<typeof resolveAllSourceImages>>): string => {
  expect(r.status).toBe("blocked");
  return (r as Diblokir).reason;
};

describe("resolveAllSourceImages", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "media-ganda-"));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("tanpa gambar -> none; perlu_ilustrasi -> diblokir dengan pesan ilustrator", async () => {
    expect(await resolveAllSourceImages(null)).toEqual({ status: "none" });
    expect(await resolveAllSourceImages(undefined)).toEqual({ status: "none" });
    expect(alasan(await resolveAllSourceImages(g({ tipe: "perlu_ilustrasi" })))).toMatch(/ilustrator/);
  });

  it("tipe tidak dikenal -> diblokir dengan menyebut tipenya", async () => {
    expect(alasan(await resolveAllSourceImages(g({ tipe: "hologram" })))).toMatch(/hologram/);
  });

  it("svg valid -> satu item diagram dengan svgContent asli, keterangan dari deskripsi_alt (dipangkas)", async () => {
    const r = siap(await resolveAllSourceImages(g({ tipe: "svg", svg_content: SVG, deskripsi_alt: "  Sebuah lingkaran  " })));
    expect(r.caption).toBe("Sebuah lingkaran");
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ tipe: "svg", label: "Diagram Presisi (SVG)", mime: "image/svg+xml", ext: "svg", svgContent: SVG });
    expect(r.items[0]!.bytes.toString("utf-8")).toBe(SVG);
  });

  it("deskripsi_alt kosong/spasi -> keterangan null", async () => {
    expect(siap(await resolveAllSourceImages(g({ tipe: "svg", svg_content: SVG, deskripsi_alt: "   " }))).caption).toBeNull();
  });

  it("svg rusak (atribut ganda) atau kosong -> diblokir dengan alasan spesifik", async () => {
    expect(alasan(await resolveAllSourceImages(g({ tipe: "svg", svg_content: SVG_RUSAK })))).toMatch(/atribut "x" ditulis dua kali/);
    expect(alasan(await resolveAllSourceImages(g({ tipe: "svg", svg_content: "" })))).toMatch(/kosong/);
  });

  it("tipe url -> satu foto, alamat sumber disimpan sebagai fallbackUrl", async () => {
    const fetchMock = vi.fn(async () => new Response(PNG, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = siap(await resolveAllSourceImages(g({ tipe: "url", url: "https://cdn.soal.ayotka.id/a.png", deskripsi_alt: "grafik" })));
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ tipe: "foto", label: "Foto Ilustrasi", mime: "image/png", ext: "png", fallbackUrl: "https://cdn.soal.ayotka.id/a.png" });
    expect(r.caption).toBe("grafik");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tipe url kosong -> diblokir tanpa fetch; unduhan gagal (404) -> diblokir dengan kode status", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(alasan(await resolveAllSourceImages(g({ tipe: "url" })))).toMatch(/url kosong/);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 404 })));
    expect(alasan(await resolveAllSourceImages(g({ tipe: "url", url: "https://cdn.soal.ayotka.id/hilang.png" })))).toMatch(/404/);
  });

  it("alamat lokal/privat ditolak sebelum fetch (SSRF)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(alasan(await resolveAllSourceImages(g({ tipe: "url", url: "http://169.254.169.254/latest/meta-data" })))).toMatch(/tidak diizinkan/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ilustrasi_kontekstual dengan svg_fallback + url -> DUA item berurutan: diagram dulu, lalu foto; tanpa kehilangan keterangan", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(PNG, { status: 200 })));
    const r = siap(
      await resolveAllSourceImages(g({ tipe: "ilustrasi_kontekstual", svg_fallback: SVG, url: URL_GEN, deskripsi_alt: "Dua bangun datar" })),
    );
    expect(r.items.map((i) => i.tipe)).toEqual(["svg", "foto"]);
    expect(r.items[0]).toMatchObject({ svgContent: SVG, mime: "image/svg+xml" });
    expect(r.items[1]).toMatchObject({ mime: "image/png", fallbackUrl: URL_GEN });
    expect(r.caption).toBe("Dua bangun datar");
  });

  it("ilustrasi_kontekstual hanya svg_fallback -> satu diagram, tanpa jaringan", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = siap(await resolveAllSourceImages(g({ tipe: "ilustrasi_kontekstual", svg_fallback: SVG })));
    expect(r.items.map((i) => i.tipe)).toEqual(["svg"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("image_data valid menang atas url (tanpa jaringan) dan tidak punya fallbackUrl", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = siap(await resolveAllSourceImages(g({ tipe: "ilustrasi_kontekstual", image_data: JPEG_URI, url: URL_GEN, svg_fallback: SVG })));
    expect(r.items.map((i) => i.tipe)).toEqual(["svg", "foto"]);
    expect(r.items[1]).toMatchObject({ mime: "image/jpeg", ext: "jpg" });
    expect(r.items[1]!.fallbackUrl).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("url generator dibaca dari DISK bila GENERATOR_IMAGES_DIR diatur - tanpa jaringan", async () => {
    fs.writeFileSync(path.join(dir, "soal-ai-1790585830926-12-jglj.jpg"), JPEG);
    vi.stubEnv("GENERATOR_IMAGES_DIR", dir);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = siap(await resolveAllSourceImages(g({ tipe: "ilustrasi_kontekstual", url: URL_GEN, svg_fallback: SVG })));
    expect(r.items.map((i) => i.tipe)).toEqual(["svg", "foto"]);
    expect(Buffer.compare(r.items[1]!.bytes, JPEG)).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("url ADA tetapi gagal diambil -> DIBLOKIR (bukan diam-diam hanya sketsa svg_fallback)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
    expect(alasan(await resolveAllSourceImages(g({ tipe: "ilustrasi_kontekstual", url: URL_GEN, svg_fallback: SVG })))).toMatch(/tidak bisa diambil.*500/);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("jaringan putus"); }));
    expect(alasan(await resolveAllSourceImages(g({ tipe: "ilustrasi_kontekstual", url: URL_GEN, svg_fallback: SVG })))).toMatch(/jaringan putus/);
  });

  it("svg_fallback rusak + foto valid -> hanya foto (sketsa rusak dilewati)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(PNG, { status: 200 })));
    const r = siap(await resolveAllSourceImages(g({ tipe: "ilustrasi_kontekstual", svg_fallback: SVG_RUSAK, url: URL_GEN })));
    expect(r.items.map((i) => i.tipe)).toEqual(["foto"]);
  });

  it("svg_fallback rusak dan TIDAK ada foto -> diblokir dengan sebab SVG yang spesifik (bukan 'data gambar kosong')", async () => {
    const pesan = alasan(await resolveAllSourceImages(g({ tipe: "ilustrasi_kontekstual", svg_fallback: SVG_RUSAK })));
    expect(pesan).toMatch(/SVG cadangan tidak valid/);
    expect(pesan).toMatch(/atribut "x" ditulis dua kali/);
  });

  it("image_data rusak dan tidak ada sumber lain -> sebab image_data disebut; semuanya kosong -> pesan umum", async () => {
    expect(alasan(await resolveAllSourceImages(g({ tipe: "ilustrasi_kontekstual", image_data: "bukan data uri" })))).toMatch(/image_data/);
    expect(alasan(await resolveAllSourceImages(g({ tipe: "ilustrasi_kontekstual", image_data: "data:image/png;base64,AAAA" })))).toMatch(/bukan gambar/);
    expect(alasan(await resolveAllSourceImages(g({ tipe: "ilustrasi_kontekstual" })))).toMatch(/kosong di sumber/);
  });

  it("image_data rusak + svg_fallback valid -> hanya diagram (tidak diblokir)", async () => {
    const r = siap(await resolveAllSourceImages(g({ tipe: "ilustrasi_kontekstual", image_data: "bukan data uri", svg_fallback: SVG })));
    expect(r.items.map((i) => i.tipe)).toEqual(["svg"]);
  });

  it("image_data melebihi 5 MB -> tidak dipakai; sebabnya disebut bila tidak ada sumber lain", async () => {
    const besar = `data:image/png;base64,${Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]).toString("base64")}`;
    expect(alasan(await resolveAllSourceImages(g({ tipe: "ilustrasi_kontekstual", image_data: besar })))).toMatch(/5 MB/);
  });
});

describe("previewMediaData", () => {
  it("tanpa gambar, perlu_ilustrasi, atau svg rusak -> null", () => {
    expect(previewMediaData(null)).toBeNull();
    expect(previewMediaData(undefined)).toBeNull();
    expect(previewMediaData(g({ tipe: "perlu_ilustrasi" }))).toBeNull();
    expect(previewMediaData(g({ tipe: "svg", svg_content: SVG_RUSAK }))).toBeNull();
    expect(previewMediaData(g({ tipe: "url" }))).toBeNull();
  });

  it("svg -> satu item diagram dengan data URI base64 dan svgContent, keterangan terpangkas", () => {
    const d = previewMediaData(g({ tipe: "svg", svg_content: SVG, deskripsi_alt: " Lingkaran " }));
    expect(d).toMatchObject({ tipe: "single", caption: "Lingkaran" });
    expect(d!.items).toHaveLength(1);
    expect(d!.items[0]).toMatchObject({ tipe: "svg", svgContent: SVG, alt: "Lingkaran" });
    expect(d!.items[0]!.url).toBe(`data:image/svg+xml;base64,${Buffer.from(SVG, "utf-8").toString("base64")}`);
  });

  it("ilustrasi_kontekstual dengan svg_fallback + url -> multi: diagram lalu foto; url tidak diunduh", () => {
    const d = previewMediaData(g({ tipe: "ilustrasi_kontekstual", svg_fallback: SVG, url: URL_GEN, deskripsi_alt: "x" }));
    expect(d!.tipe).toBe("multi");
    expect(d!.items.map((i) => [i.tipe, i.label])).toEqual([
      ["svg", "Diagram Presisi (SVG)"],
      ["foto", "Foto Ilustrasi"],
    ]);
    expect(d!.items[1]!.url).toBe(URL_GEN);
  });

  it("ilustrasi_kontekstual: svg_fallback rusak dilewati; url lokal/privat tidak dipakai", () => {
    expect(previewMediaData(g({ tipe: "ilustrasi_kontekstual", svg_fallback: SVG_RUSAK, url: URL_GEN }))!.items.map((i) => i.tipe)).toEqual(["foto"]);
    expect(previewMediaData(g({ tipe: "ilustrasi_kontekstual", url: "http://127.0.0.1/x.png" }))).toBeNull();
  });

  it("tipe url -> satu foto dengan alamat sumber", () => {
    const d = previewMediaData(g({ tipe: "url", url: "https://cdn.soal.ayotka.id/a.png" }));
    expect(d).toMatchObject({ tipe: "single", caption: null });
    expect(d!.items[0]).toMatchObject({ tipe: "foto", url: "https://cdn.soal.ayotka.id/a.png" });
  });
});

describe("precheckSourceGambar tetap konsisten dengan resolveAllSourceImages untuk kasus yang sama", () => {
  it("svg rusak diblokir di pra-periksa maupun saat eksekusi; svg valid lolos di keduanya", async () => {
    expect(precheckSourceGambar(g({ tipe: "svg", svg_content: SVG_RUSAK }))).toMatch(/atribut "x"/);
    expect((await resolveAllSourceImages(g({ tipe: "svg", svg_content: SVG_RUSAK }))).status).toBe("blocked");
    expect(precheckSourceGambar(g({ tipe: "svg", svg_content: SVG }))).toBeNull();
    expect((await resolveAllSourceImages(g({ tipe: "svg", svg_content: SVG }))).status).toBe("ready");
  });
});
