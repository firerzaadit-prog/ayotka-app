import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/home/route";

const ROOT = process.cwd();
const html = () => readFileSync(path.join(ROOT, "content", "landing", "home.html"), "utf8");

describe("GET /home (landing iklan Meta Ads)", () => {
  it("menyajikan HTML apa adanya: 200, text/html UTF-8, cache pendek, isinya halaman AyoTKA", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toContain("max-age=60");
    const badan = await res.text();
    expect(badan).toBe(html());
    expect(badan.startsWith("<!doctype html>")).toBe(true);
    expect(badan).toContain('<html lang="id">');
    expect(badan).toContain("<title>AyoTKA – Tryout TKA SD & SMP dengan Rapor per Materi</title>");
  });

  it("berkas HTML tidak ada: 503 yang sopan (bukan 500 berisi jejak galat)", async () => {
    vi.resetModules();
    vi.doMock("node:fs/promises", () => ({ readFile: vi.fn().mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" })) }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET: GETTanpaBerkas } = await import("@/app/home/route");
    const res = await GETTanpaBerkas();
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).not.toContain("ENOENT");
    vi.doUnmock("node:fs/promises");
    vi.restoreAllMocks();
  });
});

describe("isi halaman /home", () => {
  it("harga dan paket sama dengan beranda (Rp39.000 bulanan, Rp149.000 semester) dan pilihan Paket Semester jadi tombol utama", () => {
    const h = html();
    expect(h).toContain("Rp39.000");
    expect(h).toContain("Rp149.000");
    expect(h).toContain('href="https://ayotka.id/registrasi?paket=semester"');
    expect(h).toContain('href="https://ayotka.id/registrasi?paket=bulanan"');
    // hemat 6 x 39.000 - 149.000 = 85.000
    expect(6 * 39_000 - 149_000).toBe(85_000);
    expect(h).toContain("Hemat Rp85.000");
  });

  it("setiap tautan ke ayotka.id menuju halaman yang ada di aplikasi", () => {
    const tujuan = [...html().matchAll(/href="https:\/\/ayotka\.id(\/[^"?#]*)/g)].map((m) => m[1]!);
    expect(tujuan.length).toBeGreaterThan(5);
    const polaBerkas: Record<string, string[]> = {
      "/registrasi": ["app/(auth)/registrasi/page.tsx"],
      "/registrasi/mitra": ["app/(auth)/registrasi/mitra/page.tsx"],
      "/kerangka-asesmen": ["app/(public)/kerangka-asesmen/page.tsx"],
      "/kebijakan-privasi": ["app/(public)/kebijakan-privasi/page.tsx"],
      "/syarat-ketentuan": ["app/(public)/syarat-ketentuan/page.tsx"],
    };
    for (const t of new Set(tujuan)) {
      const calon = polaBerkas[t];
      expect(calon, `tautan ${t} belum dipetakan di tes ini`).toBeDefined();
      expect(calon!.some((f) => existsSync(path.join(ROOT, f))), `halaman untuk ${t}`).toBe(true);
    }
    expect(existsSync(path.join(ROOT, "app", "opengraph-image.tsx"))).toBe(true); // og:image
  });

  it("jangkar menu (#cara-kerja, #harga, #sekolah) punya tujuan dan tidak ada id ganda", () => {
    const h = html();
    const ids = [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
    expect(new Set(ids).size).toBe(ids.length);
    for (const j of new Set([...h.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]!))) expect(ids, `#${j}`).toContain(j);
  });

  it("logo sematan adalah PNG sah (CRC tiap bagian cocok) - bukan hasil salinan yang terpotong", () => {
    const m = /data:image\/png;base64,([A-Za-z0-9+/=]+)/.exec(html());
    expect(m).not.toBeNull();
    const b = Buffer.from(m![1]!, "base64");
    expect(b.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    let i = 8;
    const bagian: string[] = [];
    // CRC32 sederhana (tanpa zlib.crc32 agar jalan di semua versi Node)
    const tabel = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
    const crc = (d: Buffer) => {
      let c = 0xffffffff;
      for (const x of d) c = tabel[(c ^ x) & 0xff]! ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
    while (i < b.length) {
      const n = b.readUInt32BE(i);
      const tipe = b.subarray(i + 4, i + 8);
      expect(i + 12 + n, `bagian ${tipe.toString()} melebihi data`).toBeLessThanOrEqual(b.length);
      expect(b.readUInt32BE(i + 8 + n), `CRC ${tipe.toString()}`).toBe(crc(b.subarray(i + 4, i + 8 + n)));
      bagian.push(tipe.toString());
      i += 12 + n;
    }
    expect(bagian[0]).toBe("IHDR");
    expect(bagian.at(-1)).toBe("IEND");
  });

  it("Meta Pixel belum diisi (PIXEL_ID kosong) sehingga tidak ada skrip pihak ketiga yang aktif; font Google memang dimuat", () => {
    const h = html();
    expect(h).toMatch(/var PIXEL_ID = "";/);
    expect(h).toContain("fonts.googleapis.com");
    expect(h).not.toContain("<script src=");
  });

  it("tanda 'tidak ada' dan teks pudar memenuhi kontras AA (abu-abu #6B7488 di atas putih, 4,69:1)", () => {
    const h = html();
    expect(h).toContain(".plan li.x{color:#6B7488}");
    expect(h).toContain(".cmp .no{color:#6B7488}");
    expect(h).toContain("background:#FDECEA;color:#C5362B");
  });
});
