import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decryptSecret, encryptSecret } from "@/lib/security/crypto";

/**
 * deploy/self-host/skrip/kunci-enkripsi.mjs memeriksa apakah kunci API tersimpan (app_settings) masih terbaca setelah
 * SUPABASE_SERVICE_ROLE_KEY diganti saat pindah server. Tes ini menjaga supaya algoritma di skrip itu TIDAK menyimpang
 * dari lib/security/crypto.ts: fungsi `coba` diambil langsung dari teks skrip dan diadu dengan enkripsi/dekripsi aplikasi.
 */
const teksSkrip = fs.readFileSync(path.resolve(__dirname, "../../deploy/self-host/skrip/kunci-enkripsi.mjs"), "utf8");
const teksCrypto = fs.readFileSync(path.resolve(__dirname, "../../lib/security/crypto.ts"), "utf8");

const saltSkrip = /const SALT = "([^"]+)"/.exec(teksSkrip)?.[1];
const saltApp = /const SALT = "([^"]+)"/.exec(teksCrypto)?.[1];
const badanCoba = /function coba\([\s\S]*?\n}\n/.exec(teksSkrip)?.[0];

describe("skrip kunci-enkripsi.mjs searah dengan lib/security/crypto.ts", () => {
  const awal = { app: process.env.APP_ENCRYPTION_KEY, svc: process.env.SUPABASE_SERVICE_ROLE_KEY };
  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = "kunci-enkripsi-uji-aplikasi";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });
  afterEach(() => {
    if (awal.app === undefined) delete process.env.APP_ENCRYPTION_KEY;
    else process.env.APP_ENCRYPTION_KEY = awal.app;
    if (awal.svc === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = awal.svc;
  });

  it("garam (salt) dan fungsi pemeriksa ditemukan di skrip dan sama dengan aplikasi", () => {
    expect(saltSkrip).toBeTruthy();
    expect(saltSkrip).toBe(saltApp);
    expect(badanCoba).toBeTruthy();
    expect(teksCrypto).toContain('"aes-256-gcm"');
    expect(teksSkrip).toContain('"aes-256-gcm"');
  });

  const buatCoba = () => new Function("crypto", "SALT", `${badanCoba}; return coba;`)(crypto, saltSkrip) as (rahasia: string, teks: string) => string;

  it("nilai yang dienkripsi aplikasi terbaca skrip dengan kunci yang benar, dan tidak dengan kunci lain", () => {
    const coba = buatCoba();
    const sandi = encryptSecret("AIzaSy-contoh-kunci-gemini");
    expect(coba("kunci-enkripsi-uji-aplikasi", sandi)).toBe("ok");
    expect(coba("kunci-lain", sandi)).toBe("gagal");
    expect(coba("", sandi)).toBe("gagal");
  });

  it("mengganti SUPABASE_SERVICE_ROLE_KEY tidak mengganggu selama APP_ENCRYPTION_KEY diisi (dan sebaliknya tidak)", () => {
    const coba = buatCoba();
    // Dienkripsi tanpa APP_ENCRYPTION_KEY: aplikasi memakai SUPABASE_SERVICE_ROLE_KEY sebagai cadangan.
    delete process.env.APP_ENCRYPTION_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-lama";
    const sandi = encryptSecret("rahasia-midtrans");
    expect(coba("service-key-lama", sandi)).toBe("ok");
    expect(decryptSecret(sandi)).toBe("rahasia-midtrans");

    // Setelah pindah, kunci service berganti: tidak terbaca (inilah bahayanya)...
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-baru";
    expect(decryptSecret(sandi)).toBe("");
    // ...tetapi dengan APP_ENCRYPTION_KEY diisi nilai kunci lama (yang dilakukan skrip --kunci), terbaca lagi.
    process.env.APP_ENCRYPTION_KEY = "service-key-lama";
    expect(decryptSecret(sandi)).toBe("rahasia-midtrans");
  });

  it("nilai polos lama (bukan iv:tag:isi) dianggap polos, bukan galat", () => {
    const coba = buatCoba();
    expect(coba("apa-saja", "nilai-lama-tanpa-enkripsi")).toBe("plaintext");
    expect(coba("apa-saja", "a:b")).toBe("plaintext");
  });
});
