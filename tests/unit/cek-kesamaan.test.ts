import { beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PEMERIKSA = path.resolve(import.meta.dirname, "../../scripts/lokal/cek-kesamaan.mjs");

type Ringkasan = { panjang: number; kosong?: boolean; nilai?: string; url?: string; sidik?: string };
type Hasil = { status: string; catatan: string } | null;
type Halaman = { judul: string; deskripsi: string; tautan: string[]; bagian: string[] };
type Modul = {
  sidik(v: string): string;
  ringkasUrl(v: string): string;
  ringkasNilai(nama: string, v: string): Ringkasan;
  bandingkanVariabel(nama: string, lokal: string | undefined, ref: Ringkasan | undefined): Hasil;
  normalisasiZona(z: string | null | undefined): string | null;
  kelompokkanPerubahan(baris: string[]): { alat: string[]; lain: string[] };
  normalisasiSkema(teks: string): string;
  pilihDeployTerakhir(runs: unknown): { id: number; head_sha: string } | null;
  parseTerowonganSsh(baris: string): { penerusan: { portLokal: number; hostTujuan: string; portTujuan: number }[]; server: string | null };
  ringkasHalaman(html: string): Halaman;
  bandingkanRingkasan(a: Halaman, b: Halaman): string[];
};

let m: Modul;
beforeAll(async () => {
  m = (await import(/* @vite-ignore */ pathToFileURL(PEMERIKSA).href)) as unknown as Modul;
});

describe("sidik dan ringkasUrl", () => {
  it("sidik = 10 heksadesimal pertama sha256", () => {
    expect(m.sidik("abc")).toBe(createHash("sha256").update("abc").digest("hex").slice(0, 10));
    expect(m.sidik("abc")).toHaveLength(10);
    expect(m.sidik("abc")).not.toBe(m.sidik("abd"));
  });

  it("alamat berkredensial dibersihkan; parameter hanya namanya; alamat rusak ditandai", () => {
    expect(m.ringkasUrl("postgresql://postgres:RAHASIA@127.0.0.1:5433/postgres?schema=public&connection_limit=3")).toBe(
      "postgresql://postgres:***@127.0.0.1:5433/postgres?schema,connection_limit",
    );
    expect(m.ringkasUrl("https://ayotka.id/supabase")).toBe("https://ayotka.id/supabase");
    expect(m.ringkasUrl("bukan alamat")).toBe("(alamat tidak terbaca)");
  });
});

describe("bandingkanVariabel", () => {
  it("tidak ada di kedua sisi = tidak dilaporkan", () => {
    expect(m.bandingkanVariabel("X_TIDAK_ADA", undefined, undefined)).toBeNull();
  });

  it("nilai non-rahasia: sama = SAMA, beda = BEDA dengan kedua nilai ditampilkan", () => {
    const ref = { panjang: 12, nilai: "gemini-flash" };
    expect(m.bandingkanVariabel("AI_MODEL", "gemini-flash", ref)).toMatchObject({ status: "SAMA" });
    const beda = m.bandingkanVariabel("AI_MODEL", "gemini-lain", ref);
    expect(beda?.status).toBe("BEDA");
    expect(beda?.catatan).toContain("gemini-flash");
    expect(beda?.catatan).toContain("gemini-lain");
  });

  it("perbedaan yang memang wajar ditandai WAJAR beserta alasannya, bukan BEDA", () => {
    const hasil = m.bandingkanVariabel("NODE_ENV", "development", { panjang: 10, nilai: "production" });
    expect(hasil?.status).toBe("WAJAR");
    expect(hasil?.catatan).toMatch(/next dev/);
    const db = m.bandingkanVariabel("DATABASE_URL", "postgresql://postgres:x@127.0.0.1:5433/postgres", {
      panjang: 40,
      url: "postgresql://postgres:***@127.0.0.1:5432/postgres",
    });
    expect(db?.status).toBe("WAJAR");
    expect(db?.catatan).toMatch(/terowongan/);
    // sandi tidak boleh ikut tercetak di catatan
    expect(db?.catatan).not.toContain("postgres:x@");
  });

  it("alamat yang sama (setelah dibersihkan) = SAMA; beda host pada variabel yang tidak dikecualikan = BEDA", () => {
    const ref = { panjang: 30, url: "postgresql://postgres:***@127.0.0.1:5432/postgres" };
    expect(m.bandingkanVariabel("OTHER_URL", "postgresql://postgres:apa@127.0.0.1:5432/postgres", ref)?.status).toBe("SAMA");
    expect(m.bandingkanVariabel("OTHER_URL", "postgresql://postgres:apa@10.0.0.9:5432/postgres", ref)?.status).toBe("BEDA");
  });

  it("kunci rahasia dibandingkan lewat sidik-jari tanpa mencetak nilainya", () => {
    const kunci = "k".repeat(40);
    const ref = { panjang: 40, sidik: m.sidik(kunci) };
    const sama = m.bandingkanVariabel("APP_ENCRYPTION_KEY", kunci, ref);
    expect(sama?.status).toBe("SAMA");
    const beda = m.bandingkanVariabel("APP_ENCRYPTION_KEY", "z".repeat(40), ref);
    expect(beda?.status).toBe("BEDA");
    expect(beda?.catatan).toMatch(/BERBEDA/);
    expect(JSON.stringify(beda)).not.toContain("zzzz");
  });

  it("hanya panjang yang tersedia (kata sandi): sama = CEK, beda = BEDA", () => {
    expect(m.bandingkanVariabel("EMAIL_SMTP_PASS", "a".repeat(16), { panjang: 16 })?.status).toBe("CEK");
    expect(m.bandingkanVariabel("EMAIL_SMTP_PASS", "a".repeat(15), { panjang: 16 })?.status).toBe("BEDA");
  });

  it("ada di server tetapi hilang di lokal = BEDA, kecuali yang wajar", () => {
    expect(m.bandingkanVariabel("TUTOR_AI_URL", undefined, { panjang: 5, nilai: "https" })?.status).toBe("BEDA");
    expect(m.bandingkanVariabel("GENERATOR_IMAGES_DIR", undefined, { panjang: 5, nilai: "/var/x" })?.status).toBe("WAJAR");
  });

  it("hanya ada di lokal: INFO; alat bantu lokal dijelaskan", () => {
    expect(m.bandingkanVariabel("LOKAL_TERHUBUNG_PRODUKSI", "true", undefined)).toMatchObject({ status: "INFO", catatan: expect.stringMatching(/alat bantu/) });
    expect(m.bandingkanVariabel("TAMBAHAN", "x", undefined)?.status).toBe("INFO");
  });

  it("kosong: sama-sama kosong SAMA; salah satu kosong BEDA", () => {
    expect(m.bandingkanVariabel("REDIS_URL", "", { panjang: 0, kosong: true })?.status).toBe("SAMA");
    expect(m.bandingkanVariabel("REDIS_URL", "x", { panjang: 0, kosong: true })?.status).toBe("BEDA");
    expect(m.bandingkanVariabel("REDIS_URL", "", { panjang: 3, nilai: "abc" })?.status).toBe("BEDA");
  });
});

describe("normalisasiZona", () => {
  it("UTC dalam berbagai tulisan dianggap sama", () => {
    for (const z of ["UTC", "Etc/UTC", "utc", "GMT", "Etc/GMT", "Z"]) expect(m.normalisasiZona(z), z).toBe("UTC");
    expect(m.normalisasiZona("Asia/Jakarta")).toBe("Asia/Jakarta");
    expect(m.normalisasiZona(null)).toBeNull();
    expect(m.normalisasiZona("")).toBeNull();
  });
});

describe("kelompokkanPerubahan", () => {
  it("memisahkan alat kesamaan dari perubahan kode lain", () => {
    const hasil = m.kelompokkanPerubahan([
      " M lib/supabase/admin.ts",
      "?? scripts/lokal/",
      "?? deploy/lokal/",
      "?? tests/unit/admin-terowongan.test.ts",
      " M components/public/header.tsx",
      "?? lib/soal/media-types.ts",
      "R  lama.ts -> app/baru.ts",
      '?? "app/siswa/attempt/[id]/page.tsx"',
      "",
    ]);
    expect(hasil.alat).toEqual(["M lib/supabase/admin.ts", "?? scripts/lokal/", "?? deploy/lokal/", "?? tests/unit/admin-terowongan.test.ts"]);
    expect(hasil.lain).toEqual(["M components/public/header.tsx", "?? lib/soal/media-types.ts", "R app/baru.ts", "?? app/siswa/attempt/[id]/page.tsx"]);
  });

  it("baris pertama yang spasi depannya terpotong (keluaran git yang di-trim) tetap terbaca benar", () => {
    // Bug nyata: "M .env.example" dulu terbaca "env.example" (titik hilang) lalu dianggap bukan alat.
    const hasil = m.kelompokkanPerubahan(["M .env.example", " M package.json", "?? .env.local.contoh"]);
    expect(hasil.alat).toEqual(["M .env.example", "M package.json"]);
    expect(hasil.lain).toEqual(["?? .env.local.contoh"]);
  });

  it("jalur yang hanya mirip awalan alat bukan alat", () => {
    expect(m.kelompokkanPerubahan(["?? scripts/lokalx/a.ts", "?? lib/supabase/admin.ts.bak"]).alat).toEqual([]);
  });

  it("kosong = tidak ada perubahan", () => {
    expect(m.kelompokkanPerubahan([])).toEqual({ alat: [], lain: [] });
  });
});

describe("normalisasiSkema", () => {
  it("perataan kolom, spasi, tab, baris kosong, dan CRLF tidak dianggap perbedaan", () => {
    const a = 'model A {\r\n  school       School   @relation(fields: [schoolId])\r\n\r\n  id String @id\r\n}\r\n';
    const b = 'model A {\n  school School @relation(fields: [schoolId])\n\tid\tString   @id\n}';
    expect(m.normalisasiSkema(a)).toBe(m.normalisasiSkema(b));
  });

  it("perbedaan isi sungguhan tetap terdeteksi", () => {
    const a = "model A {\n  id String @id\n}";
    expect(m.normalisasiSkema(a)).not.toBe(m.normalisasiSkema("model A {\n  id String @id\n  nama String\n}"));
    expect(m.normalisasiSkema(a)).not.toBe(m.normalisasiSkema("model A {\n  id Int @id\n}"));
  });
});

describe("pilihDeployTerakhir", () => {
  const run = (id: number, name: string, conclusion: string | null, sha: string, mulai: string, cabang = "main") => ({
    id, name, conclusion, head_sha: sha, run_started_at: mulai, created_at: mulai, head_branch: cabang,
  });

  it("memilih deploy BERHASIL terbaru; mengabaikan deploy gagal, workflow lain, dan cabang lain", () => {
    const pilih = m.pilihDeployTerakhir({
      workflow_runs: [
        run(5, "Deploy ayotka.id to VPS", "failure", "ffff", "2026-10-11T10:00:00Z"),
        run(4, "CI", "success", "cccc", "2026-10-11T09:30:00Z"),
        run(3, "Deploy ayotka.id to VPS", "success", "bbbb", "2026-10-11T09:00:00Z"),
        run(2, "Deploy ayotka.id to VPS", "success", "aaaa", "2026-10-10T09:00:00Z"),
        run(1, "Deploy ayotka.id to VPS", "success", "dddd", "2026-10-11T11:00:00Z", "maintenance"),
      ],
    });
    expect(pilih?.head_sha).toBe("bbbb");
  });

  it("tidak ada yang berhasil = null; data kosong tidak membuat galat", () => {
    expect(m.pilihDeployTerakhir({ workflow_runs: [run(1, "Deploy ayotka.id to VPS", "failure", "a", "2026-10-11T10:00:00Z")] })).toBeNull();
    expect(m.pilihDeployTerakhir({})).toBeNull();
    expect(m.pilihDeployTerakhir(null)).toBeNull();
  });
});

describe("parseTerowonganSsh", () => {
  it("terowongan satu penerusan (bentuk yang dipakai sekarang)", () => {
    const r = m.parseTerowonganSsh("ssh -N -L 5433:127.0.0.1:5432 firerza@187.77.115.29");
    expect(r.penerusan).toEqual([{ portLokal: 5433, hostTujuan: "127.0.0.1", portTujuan: 5432 }]);
    expect(r.server).toBe("firerza@187.77.115.29");
  });

  it("dua penerusan, jalur ssh.exe Windows berkutip, opsi -o, dan alamat ikat", () => {
    const r = m.parseTerowonganSsh(
      '"C:\\Windows\\System32\\OpenSSH\\ssh.exe" -N -o ServerAliveInterval=30 -L 127.0.0.1:5433:127.0.0.1:5432 -L19999:127.0.0.1:9999 firerza@187.77.115.29',
    );
    expect(r.penerusan).toEqual([
      { portLokal: 5433, hostTujuan: "127.0.0.1", portTujuan: 5432 },
      { portLokal: 19999, hostTujuan: "127.0.0.1", portTujuan: 9999 },
    ]);
    expect(r.server).toBe("firerza@187.77.115.29");
  });

  it("ssh tanpa penerusan port", () => {
    const r = m.parseTerowonganSsh("ssh firerza@187.77.115.29");
    expect(r.penerusan).toEqual([]);
  });
});

describe("ringkasHalaman dan bandingkanRingkasan", () => {
  const html = (judul: string, tautan: string[], h1 = "Selamat datang") =>
    `<!doctype html><html><head><title>${judul}</title>
<meta content="Deskripsi uji" name="description"/>
<script>var x = "<a href='/dari-skrip'>x</a>";</script><style>.a{}</style></head>
<body><!-- <a href="/dari-komentar">x</a> -->
<h1 class="a">${h1}</h1><h2>Bagian <b>satu</b>&nbsp;ini</h2>
${tautan.map((t) => `<a class="x" href="${t}">tautan</a>`).join("\n")}
<a href="https://luar.example/x">luar</a><a href="//cdn.example/y">protokol</a><a href="/_next/static/a.js">aset</a><a href="#atas">jangkar</a>
</body></html>`;

  it("mengambil judul, deskripsi (urutan atribut bebas), tautan internal unik terurut, dan judul bagian", () => {
    const r = m.ringkasHalaman(html("AyoTKA", ["/login", "/registrasi", "/login"]));
    expect(r.judul).toBe("AyoTKA");
    expect(r.deskripsi).toBe("Deskripsi uji");
    expect(r.tautan).toEqual(["/login", "/registrasi"]);
    expect(r.bagian).toEqual(["Selamat datang", "Bagian satu ini"]);
  });

  it("skrip dan komentar tidak dihitung; tautan luar, aset, dan jangkar diabaikan", () => {
    const r = m.ringkasHalaman(html("A", []));
    expect(r.tautan).toEqual([]);
  });

  it("selisih: tautan hanya di satu sisi, judul, dan judul bagian dilaporkan", () => {
    const prod = m.ringkasHalaman(html("AyoTKA", ["/login"]));
    const lokal = m.ringkasHalaman(html("AyoTKA | Dev", ["/login", "/login/mitra", "/login/sekolah"], "Halo"));
    const beda = m.bandingkanRingkasan(prod, lokal);
    expect(beda.some((b) => b.startsWith("judul:"))).toBe(true);
    expect(beda).toContain("tautan hanya di lokal: /login/mitra, /login/sekolah");
    expect(beda.some((b) => b.startsWith("judul bagian berbeda"))).toBe(true);
  });

  it("halaman identik = tanpa selisih", () => {
    const a = m.ringkasHalaman(html("AyoTKA", ["/login", "/registrasi"]));
    const b = m.ringkasHalaman(html("AyoTKA", ["/registrasi", "/login"]));
    expect(m.bandingkanRingkasan(a, b)).toEqual([]);
  });
});
