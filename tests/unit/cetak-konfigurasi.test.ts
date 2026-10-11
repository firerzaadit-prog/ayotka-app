import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SKRIP = path.resolve(import.meta.dirname, "../../deploy/self-host/skrip/cetak-konfigurasi.mjs");
const PEMERIKSA = path.resolve(import.meta.dirname, "../../scripts/lokal/cek-kesamaan.mjs");

type Ringkasan = { panjang: number; kosong?: boolean; nilai?: string; url?: string; sidik?: string; sumber?: string };
type Keluaran = {
  versiSkrip: number;
  server: { node: string; zonaWaktu: string };
  kode: { galat?: string };
  env: { berkasDibaca: string[]; variabel: Record<string, Ringkasan> };
  cron: Record<string, unknown>;
};

// Semua nilai di bawah PALSU. Yang berawalan RAHASIA_/SANDI_ tidak boleh muncul sedikit pun di keluaran skrip.
const ENV_BERKAS = [
  "NODE_ENV=production",
  "NEXT_PUBLIC_APP_URL=https://ayotka.id",
  'DATABASE_URL="postgresql://postgres:SANDI_DB_RAHASIA_123@127.0.0.1:5432/postgres?schema=public&connection_limit=3"',
  "DIRECT_URL=postgresql://postgres:SANDI_DB_RAHASIA_123@127.0.0.1:5432/postgres",
  "APP_ENCRYPTION_KEY=RAHASIA_KUNCI_ENKRIPSI_PANJANG_1234567890",
  "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.RAHASIA_PAYLOAD_ABCDEFGHIJKLMNOPQRSTUV.RAHASIA_TANDA_TANGAN_1234567890",
  "EMAIL_SMTP_PASS=RAHASIA sandi smtp panjang 1234567890",
  "SEED_ADMIN_PASSWORD=RAHASIA_AdminSandi#2026!",
  "MAINTENANCE_BYPASS_SECRET=RAHASIA_pendek",
  "REDIS_URL=redis://:SANDI_REDIS_RAHASIA@redis.internal:6379",
  "RESEND_API_KEY=re_RAHASIA_RESEND_1234567890abcdef",
  "TUTOR_AI_URL=https://ai.ayotka.id/api/ai/tutor/chat",
  "AI_MODEL=gemini-dari-env",
  "SOME_URL=https://example.test/a?token=RAHASIA_NILAI_QUERY",
  "AI_QUEUE_RATE_PER_SECOND=5",
  "KOSONG=",
  "CRON_SECRET=RAHASIA_cron_pendek", // 19 karakter: tepat di bawah batas sidik-jari
  "AI_API_KEY=RAHASIA_xxxxxxxxxxxx", // 20 karakter: tepat di batas sidik-jari
  "# komentar RAHASIA_KOMENTAR tidak boleh bocor",
  "#DATABASE_URL_LAMA=postgresql://postgres:SANDI_LAMA_RAHASIA@lama:5432/postgres", // tugas yang dikomentari bukan variabel
  "   # MAILKETING_FROM_EMAIL=salah@komentar.test",
].join("\n");

let folder = "";
let teks = "";
let keluaran: Keluaran;

beforeAll(() => {
  folder = mkdtempSync(path.join(tmpdir(), "ayotka-konfig-"));
  writeFileSync(path.join(folder, ".env"), ENV_BERKAS + "\n");
  writeFileSync(path.join(folder, ".env.local"), "AI_MODEL=gemini-dari-env-local\nLOKAL_KHUSUS_RAHASIA_TOKEN=RAHASIA_HANYA_DI_LOCAL_1234567890\n");
  teks = execFileSync(process.execPath, [SKRIP], {
    encoding: "utf8",
    env: { ...process.env, APP_DIR: folder },
    timeout: 60_000,
  });
  keluaran = JSON.parse(teks) as Keluaran;
}, 90_000);

afterAll(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe("cetak-konfigurasi.mjs: tidak membocorkan rahasia", () => {
  it("tidak ada nilai rahasia (atau potongannya) di seluruh keluaran", () => {
    for (const rahasia of [
      "SANDI_DB_RAHASIA_123",
      "RAHASIA_KUNCI_ENKRIPSI",
      "RAHASIA_PAYLOAD",
      "RAHASIA_TANDA_TANGAN",
      "RAHASIA sandi smtp",
      "RAHASIA_AdminSandi",
      "RAHASIA_pendek",
      "SANDI_REDIS_RAHASIA",
      "RAHASIA_RESEND",
      "RAHASIA_NILAI_QUERY",
      "RAHASIA_KOMENTAR",
      "SANDI_LAMA_RAHASIA",
      "RAHASIA_cron_pendek",
      "RAHASIA_xxxxxxxxxxxx",
      "RAHASIA_HANYA_DI_LOCAL",
      "eyJhbGciOiJIUzI1NiJ9",
    ]) {
      expect(teks.includes(rahasia), rahasia).toBe(false);
    }
  });

  it("alamat berkredensial hanya muncul tanpa kredensial dan tanpa nilai parameter", () => {
    const v = keluaran.env.variabel;
    expect(v.DATABASE_URL?.url).toBe("postgresql://postgres:***@127.0.0.1:5432/postgres?schema,connection_limit");
    expect(v.DIRECT_URL?.url).toBe("postgresql://postgres:***@127.0.0.1:5432/postgres");
    expect(v.REDIS_URL?.url).toBe("redis://redis.internal:6379");
    expect(v.SOME_URL?.url).toBe("https://example.test/a?token");
    for (const nama of ["DATABASE_URL", "DIRECT_URL", "REDIS_URL", "SOME_URL"]) expect(v[nama]?.nilai).toBeUndefined();
  });

  it("kunci panjang hanya berupa sidik-jari; kata sandi dan nilai pendek hanya panjang", () => {
    const v = keluaran.env.variabel;
    const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 10);
    const kunci = "RAHASIA_KUNCI_ENKRIPSI_PANJANG_1234567890";
    expect(v.APP_ENCRYPTION_KEY).toMatchObject({ panjang: kunci.length, sidik: sha(kunci) });
    expect(v.APP_ENCRYPTION_KEY?.nilai).toBeUndefined();
    expect(v.RESEND_API_KEY?.sidik).toMatch(/^[0-9a-f]{10}$/);
    expect(v.SUPABASE_SERVICE_ROLE_KEY?.sidik).toMatch(/^[0-9a-f]{10}$/);
    // kata sandi: tidak ada sidik-jari sama sekali (nilai berentropi rendah bisa ditebak dari hash)
    expect(v.EMAIL_SMTP_PASS).toEqual({ sumber: ".env", panjang: "RAHASIA sandi smtp panjang 1234567890".length });
    expect(v.SEED_ADMIN_PASSWORD).toEqual({ sumber: ".env", panjang: "RAHASIA_AdminSandi#2026!".length });
    expect(v.MAINTENANCE_BYPASS_SECRET).toEqual({ sumber: ".env", panjang: "RAHASIA_pendek".length });
    // batas tepat: 19 karakter tanpa sidik-jari, 20 karakter dengan sidik-jari (nilai pendek berentropi rendah)
    expect("RAHASIA_cron_pendek").toHaveLength(19);
    expect("RAHASIA_xxxxxxxxxxxx").toHaveLength(20);
    expect(v.CRON_SECRET).toEqual({ sumber: ".env", panjang: 19 });
    expect(v.AI_API_KEY).toEqual({ sumber: ".env", panjang: 20, sidik: sha("RAHASIA_xxxxxxxxxxxx") });
  });

  it("nilai non-rahasia yang terdaftar dicetak apa adanya; kosong ditandai", () => {
    const v = keluaran.env.variabel;
    expect(v.NEXT_PUBLIC_APP_URL?.nilai).toBe("https://ayotka.id");
    expect(v.TUTOR_AI_URL?.nilai).toBe("https://ai.ayotka.id/api/ai/tutor/chat");
    expect(v.AI_QUEUE_RATE_PER_SECOND?.nilai).toBe("5");
    expect(v.NODE_ENV?.nilai).toBe("production");
    expect(v.KOSONG).toMatchObject({ kosong: true, panjang: 0 });
  });

  it("baris yang dikomentari bukan variabel (tidak dilaporkan, nilainya tidak dibaca)", () => {
    const v = keluaran.env.variabel;
    expect(v.DATABASE_URL_LAMA).toBeUndefined();
    expect(v.MAILKETING_FROM_EMAIL).toBeUndefined();
    expect(Object.keys(v).some((k) => k.startsWith("#"))).toBe(false);
  });

  it("urutan prioritas Next.js: .env.local mengalahkan .env, dan sumbernya dicatat", () => {
    const v = keluaran.env.variabel;
    expect(v.AI_MODEL).toMatchObject({ nilai: "gemini-dari-env-local", sumber: ".env.local" });
    expect(v.APP_ENCRYPTION_KEY?.sumber).toBe(".env");
    expect(keluaran.env.berkasDibaca).toEqual([".env.local", ".env"]);
  });

  it("tetap menghasilkan JSON lengkap walau bagian lain (git, pm2, nginx, docker) tidak tersedia", () => {
    expect(keluaran.versiSkrip).toBe(1);
    expect(keluaran.server.node).toBe(process.version);
    expect(typeof keluaran.server.zonaWaktu).toBe("string");
    expect(keluaran.kode.galat).toBeTypeOf("string"); // folder uji bukan repositori git
  });

  it("folder aplikasi yang tidak ada tidak membuat skrip mati", () => {
    const hasil = execFileSync(process.execPath, [SKRIP], {
      encoding: "utf8",
      env: { ...process.env, APP_DIR: path.join(folder, "tidak-ada") },
      timeout: 60_000,
    });
    const j = JSON.parse(hasil) as Keluaran & { env: { galat?: string; variabel?: unknown } };
    expect(j.versiSkrip).toBe(1);
    expect(j.env.variabel ?? {}).toEqual({});
  }, 90_000);
});

describe("cetak-konfigurasi.mjs: syarat pengiriman lewat PowerShell", () => {
  it("berkas ASCII murni (PowerShell merusak karakter lain saat mengalirkan ke ssh)", () => {
    const bytes = readFileSync(SKRIP);
    const bukanAscii = [...bytes].filter((b) => b > 127).length;
    expect(bukanAscii).toBe(0);
  });

  it("sidik-jari identik dengan fungsi pembanding di pemeriksa lokal (jika berbeda, perbandingan selalu BEDA)", async () => {
    const m = (await import(/* @vite-ignore */ pathToFileURL(PEMERIKSA).href)) as unknown as {
      sidik(v: string): string;
      ringkasNilai(nama: string, v: string): Ringkasan;
    };
    expect(m.sidik("RAHASIA_KUNCI_ENKRIPSI_PANJANG_1234567890")).toBe(keluaran.env.variabel.APP_ENCRYPTION_KEY?.sidik);
    // bentuk ringkasan lokal harus persis sama dengan yang dicetak server untuk nilai yang sama
    const nilaiDiServer: Record<string, string> = {
      DATABASE_URL: "postgresql://postgres:SANDI_DB_RAHASIA_123@127.0.0.1:5432/postgres?schema=public&connection_limit=3",
      APP_ENCRYPTION_KEY: "RAHASIA_KUNCI_ENKRIPSI_PANJANG_1234567890",
      EMAIL_SMTP_PASS: "RAHASIA sandi smtp panjang 1234567890",
      NEXT_PUBLIC_APP_URL: "https://ayotka.id",
      REDIS_URL: "redis://:SANDI_REDIS_RAHASIA@redis.internal:6379",
      SOME_URL: "https://example.test/a?token=RAHASIA_NILAI_QUERY",
      KOSONG: "",
    };
    for (const [nama, nilai] of Object.entries(nilaiDiServer)) {
      const { sumber: _s, ...dariServer } = keluaran.env.variabel[nama]!;
      expect(m.ringkasNilai(nama, nilai), nama).toEqual(dariServer);
    }
  });
});
