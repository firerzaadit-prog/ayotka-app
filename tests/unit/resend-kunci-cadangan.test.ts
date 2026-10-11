import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  upsert: vi.fn(),
  decrypt: vi.fn(),
  konfig: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { appSetting: { upsert: m.upsert } } }));
vi.mock("@/lib/security/crypto", () => ({ decryptSecret: m.decrypt }));

import { tentukanKonfigResend } from "@/lib/settings/resend-config";
import { getResolvedResendConfig } from "@/lib/settings/app-settings";
import { kodeGalatResend } from "@/lib/email/kode-galat";

describe("tentukanKonfigResend (kunci mana yang dipakai)", () => {
  const dasar = { dbTersimpan: false, dbKunci: "", dbFrom: null, envKunci: undefined, envFrom: undefined };

  it("kunci database yang terbaca dipakai lebih dulu; tanpa cadangan bila kunci .env sama atau kosong", () => {
    expect(tentukanKonfigResend({ ...dasar, dbTersimpan: true, dbKunci: "re_db", envKunci: "re_db" })).toEqual({
      apiKey: "re_db",
      fromEmail: "AyoTKA <noreply@ayotka.id>",
      source: "database",
    });
    expect(tentukanKonfigResend({ ...dasar, dbTersimpan: true, dbKunci: "re_db", envKunci: "" })).not.toHaveProperty("kunciCadanganEnv");
    expect(tentukanKonfigResend({ ...dasar, dbTersimpan: true, dbKunci: "re_db", envKunci: "   " })).not.toHaveProperty("kunciCadanganEnv");
  });

  it("kunci .env yang BERBEDA dari kunci database disimpan sebagai cadangan (dipangkas)", () => {
    const k = tentukanKonfigResend({ ...dasar, dbTersimpan: true, dbKunci: "re_db", envKunci: "  re_env \n" });
    expect(k).toMatchObject({ apiKey: "re_db", source: "database", kunciCadanganEnv: "re_env" });
  });

  it("kunci database tersimpan tetapi tidak terbaca: dipakai kunci .env dan ditandai kunciDatabaseTakTerbaca", () => {
    expect(tentukanKonfigResend({ ...dasar, dbTersimpan: true, dbKunci: "", envKunci: "re_env" })).toEqual({
      apiKey: "re_env",
      fromEmail: "AyoTKA <noreply@ayotka.id>",
      source: "env",
      kunciDatabaseTakTerbaca: true,
    });
  });

  it("kunci database tidak terbaca DAN .env kosong: source none, tetap ditandai tak terbaca (bukan sekadar 'belum diisi')", () => {
    expect(tentukanKonfigResend({ ...dasar, dbTersimpan: true, dbKunci: "", envKunci: "" })).toMatchObject({
      apiKey: "",
      source: "none",
      kunciDatabaseTakTerbaca: true,
    });
  });

  it("tidak ada apa pun di database: .env dipakai, tanpa tanda apa-apa; semuanya kosong = none", () => {
    expect(tentukanKonfigResend({ ...dasar, envKunci: "re_env" })).toEqual({
      apiKey: "re_env",
      fromEmail: "AyoTKA <noreply@ayotka.id>",
      source: "env",
    });
    expect(tentukanKonfigResend(dasar)).toEqual({ apiKey: "", fromEmail: "AyoTKA <noreply@ayotka.id>", source: "none" });
  });

  it("alamat pengirim: database didahulukan, kutip pembungkus dibuang, yang rusak jatuh ke .env lalu ke bawaan", () => {
    const f = (dbFrom: string | null, envFrom: string | undefined) =>
      tentukanKonfigResend({ ...dasar, dbTersimpan: true, dbKunci: "re_db", dbFrom, envFrom }).fromEmail;
    expect(f('"Tim <halo@ayotka.id>"', "AyoTKA <noreply@ayotka.id>")).toBe("Tim <halo@ayotka.id>");
    expect(f("rusak tanpa alamat", "Env <env@ayotka.id>")).toBe("Env <env@ayotka.id>");
    expect(f(null, undefined)).toBe("AyoTKA <noreply@ayotka.id>");
  });
});

describe("getResolvedResendConfig (perekat ke database)", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    m.upsert.mockReset();
    m.decrypt.mockReset();
    warn.mockClear();
    // Cabang uji bawaan (VITEST/NODE_ENV=test) hanya membaca .env; supaya jalur database yang diuji, matikan sementara.
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "re_env_kunci");
    vi.stubEnv("RESEND_FROM_EMAIL", "AyoTKA <noreply@ayotka.id>");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("kunci database terbaca + kunci .env berbeda -> database dipakai, .env jadi cadangan, tanpa peringatan", async () => {
    m.upsert.mockResolvedValue({ resendApiKeyEncrypted: "iv:tag:isi", resendFromEmail: "Tim <halo@ayotka.id>" });
    m.decrypt.mockReturnValue("re_db_kunci");
    expect(await getResolvedResendConfig()).toEqual({
      apiKey: "re_db_kunci",
      fromEmail: "Tim <halo@ayotka.id>",
      source: "database",
      kunciCadanganEnv: "re_env_kunci",
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("kunci database tersimpan tetapi tidak terbaca -> .env dipakai, ditandai, dan dicatat di log tanpa membocorkan kunci", async () => {
    m.upsert.mockResolvedValue({ resendApiKeyEncrypted: "iv:tag:isi", resendFromEmail: null });
    m.decrypt.mockReturnValue("");
    const hasil = await getResolvedResendConfig();
    expect(hasil).toMatchObject({ apiKey: "re_env_kunci", source: "env", kunciDatabaseTakTerbaca: true });
    expect(warn).toHaveBeenCalledTimes(1);
    const log = String(warn.mock.calls[0]![0]);
    expect(log).toMatch(/tidak bisa dibaca/);
    expect(log).toMatch(/Memakai RESEND_API_KEY dari \.env/);
    expect(log).not.toContain("re_env_kunci");
  });

  it("kunci database tidak terbaca dan .env kosong -> log menyebut email tidak bisa dikirim", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    m.upsert.mockResolvedValue({ resendApiKeyEncrypted: "iv:tag:isi", resendFromEmail: null });
    m.decrypt.mockReturnValue("");
    expect(await getResolvedResendConfig()).toMatchObject({ apiKey: "", source: "none", kunciDatabaseTakTerbaca: true });
    expect(String(warn.mock.calls[0]![0])).toMatch(/email tidak bisa dikirim/);
  });

  it("belum ada kunci di database sama sekali -> .env dipakai tanpa peringatan", async () => {
    m.upsert.mockResolvedValue({ resendApiKeyEncrypted: null, resendFromEmail: null });
    m.decrypt.mockReturnValue("");
    const hasil = await getResolvedResendConfig();
    expect(hasil).toMatchObject({ apiKey: "re_env_kunci", source: "env" });
    expect(hasil).not.toHaveProperty("kunciDatabaseTakTerbaca");
    expect(warn).not.toHaveBeenCalled();
  });

  it("database tidak terjangkau -> jatuh ke .env (perilaku lama) dengan satu peringatan", async () => {
    m.upsert.mockRejectedValue(new Error("koneksi putus"));
    expect(await getResolvedResendConfig()).toMatchObject({ apiKey: "re_env_kunci", source: "env" });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("dalam lingkungan uji (VITEST) database tidak disentuh sama sekali", async () => {
    vi.stubEnv("VITEST", "true");
    expect(await getResolvedResendConfig()).toMatchObject({ apiKey: "re_env_kunci", source: "env" });
    expect(m.upsert).not.toHaveBeenCalled();
  });
});

describe("kode untuk kunci database yang tidak terbaca", () => {
  it("pesan galat pengirim dipetakan ke kode 'resend-kunci-db-tak-terbaca' (bukan 'kosong' biasa)", () => {
    expect(
      kodeGalatResend({ error: "Kunci Resend di Pengaturan Sistem tidak bisa dibaca (kunci enkripsi server berubah) dan RESEND_API_KEY di .env juga kosong" }),
    ).toBe("resend-kunci-db-tak-terbaca");
    expect(kodeGalatResend({ error: "RESEND_API_KEY belum diisi di Pengaturan Sistem atau .env" })).toBe("resend-kunci-kosong");
  });
});
