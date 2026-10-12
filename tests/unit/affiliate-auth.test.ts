import { describe, expect, it } from "vitest";
import { alamatWebhookAffiliate, periksaAksesAffiliate, rahasiaWebhookAffiliate } from "@/lib/billing/affiliate-auth";

const ENV = { APP_ENCRYPTION_KEY: "kunci-enkripsi-server-uji-1234567890" };
const rahasia = rahasiaWebhookAffiliate(ENV)!;
const minta = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

describe("rahasiaWebhookAffiliate", () => {
  it("diturunkan dari kunci enkripsi server: stabil, panjang cukup, dan TIDAK memuat kunci aslinya", () => {
    expect(rahasia).toMatch(/^[0-9a-f]{48}$/);
    expect(rahasiaWebhookAffiliate(ENV)).toBe(rahasia);
    expect(rahasia).not.toContain(ENV.APP_ENCRYPTION_KEY);
  });

  it("kunci server berbeda -> rahasia berbeda; SUPABASE_SERVICE_ROLE_KEY dipakai bila APP_ENCRYPTION_KEY kosong", () => {
    expect(rahasiaWebhookAffiliate({ APP_ENCRYPTION_KEY: "kunci-lain-yang-berbeda-0987654321" })).not.toBe(rahasia);
    expect(rahasiaWebhookAffiliate({ SUPABASE_SERVICE_ROLE_KEY: ENV.APP_ENCRYPTION_KEY })).toBe(rahasia);
  });

  it("AFFILIATE_WEBHOOK_SECRET (minimal 16 karakter) didahulukan; yang terlalu pendek diabaikan", () => {
    expect(rahasiaWebhookAffiliate({ ...ENV, AFFILIATE_WEBHOOK_SECRET: "  rahasia-eksplisit-panjang-123  " })).toBe("rahasia-eksplisit-panjang-123");
    expect(rahasiaWebhookAffiliate({ ...ENV, AFFILIATE_WEBHOOK_SECRET: "pendek" })).toBe(rahasia);
  });

  it("tanpa kunci apa pun: null", () => {
    expect(rahasiaWebhookAffiliate({})).toBeNull();
    expect(rahasiaWebhookAffiliate({ AFFILIATE_WEBHOOK_SECRET: "pendek" })).toBeNull();
  });
});

describe("periksaAksesAffiliate", () => {
  const dasar = "https://ayotka.id/api/webhooks/affiliate";

  it("TANPA rahasia -> 401 (inilah celah lama: dulu semua panggilan lolos)", () => {
    expect(periksaAksesAffiliate(minta(dasar), ENV)).toEqual({ ok: false, status: 401, pesan: "Tidak diizinkan." });
    expect(periksaAksesAffiliate(minta(`${dasar}?email=a@b.co&product_id=jqKvm6YMT1YzqDwgdVey&order_id=1`), ENV)).toMatchObject({ ok: false, status: 401 });
  });

  it("rahasia salah, kosong, atau hampir benar -> 401", () => {
    for (const salah of ["", "salah", rahasia.slice(0, -1), `${rahasia}x`, rahasia.toUpperCase()]) {
      expect(periksaAksesAffiliate(minta(`${dasar}?token=${salah}`), ENV), salah).toMatchObject({ ok: false, status: 401 });
    }
  });

  it("rahasia benar di query (?token=), di Authorization: Bearer, atau di X-Webhook-Token -> lolos", () => {
    expect(periksaAksesAffiliate(minta(`${dasar}?token=${rahasia}`), ENV)).toEqual({ ok: true });
    expect(periksaAksesAffiliate(minta(`${dasar}?email=a%40b.co&token=${rahasia}&order_id=9`), ENV)).toEqual({ ok: true });
    expect(periksaAksesAffiliate(minta(dasar, { authorization: `Bearer ${rahasia}` }), ENV)).toEqual({ ok: true });
    expect(periksaAksesAffiliate(minta(dasar, { "x-webhook-token": rahasia }), ENV)).toEqual({ ok: true });
  });

  it("tahan terhadap parameter yang ditempel dengan cara salah oleh pengirim: ?token=RAHASIA?email=x dan &", () => {
    expect(periksaAksesAffiliate(minta(`${dasar}?token=${rahasia}?email=a@b.co&order_id=1`), ENV)).toEqual({ ok: true });
    expect(periksaAksesAffiliate(minta(`${dasar}?token=${rahasia}&email=a@b.co`), ENV)).toEqual({ ok: true });
  });

  it("Bearer dengan nilai lain (mis. kunci API affiliate.id) tidak menggagalkan token yang benar di query, tetapi sendirian tidak cukup", () => {
    expect(periksaAksesAffiliate(minta(`${dasar}?token=${rahasia}`, { authorization: "Bearer kunci-api-lain" }), ENV)).toEqual({ ok: true });
    expect(periksaAksesAffiliate(minta(dasar, { authorization: "Bearer kunci-api-lain" }), ENV)).toMatchObject({ ok: false, status: 401 });
  });

  it("server tanpa kunci -> 503 (gagal tertutup): bahkan 'token' kosong atau apa pun ditolak", () => {
    expect(periksaAksesAffiliate(minta(`${dasar}?token=apa-saja`), {})).toMatchObject({ ok: false, status: 503 });
    expect(periksaAksesAffiliate(minta(dasar), {})).toMatchObject({ ok: false, status: 503 });
  });

  it("rahasia server lain tidak dikenali", () => {
    const lain = rahasiaWebhookAffiliate({ APP_ENCRYPTION_KEY: "server-lain-sama-sekali-1234567890" })!;
    expect(periksaAksesAffiliate(minta(`${dasar}?token=${lain}`), ENV)).toMatchObject({ ok: false, status: 401 });
  });
});

describe("alamatWebhookAffiliate", () => {
  it("tiga alamat umum + satu alamat Success per produk, rahasia sama, di asal publik tanpa garis miring ganda", () => {
    const a = alamatWebhookAffiliate("https://ayotka.id/", ENV)!;
    const success = (kode: string) => `https://ayotka.id/api/webhooks/affiliate/success?token=${rahasia}&produk=${kode}`;
    expect(a).toEqual({
      purchase: `https://ayotka.id/api/webhooks/affiliate?token=${rahasia}`,
      checkEmail: `https://ayotka.id/api/webhooks/affiliate/check-email?token=${rahasia}`,
      checkAccount: `https://ayotka.id/api/webhooks/affiliate/check-account?token=${rahasia}`,
      success: { topup25k: success("topup25k"), topup50k: success("topup50k"), bulanan: success("bulanan"), semester: success("semester") },
    });
  });

  it("setiap alamat yang diberikan ke admin LOLOS pemeriksaan server (tidak mungkin salah salin)", () => {
    const a = alamatWebhookAffiliate("https://ayotka.id", ENV)!;
    for (const url of [a.purchase, a.checkEmail, a.checkAccount, ...Object.values(a.success)]) {
      expect(periksaAksesAffiliate(minta(url), ENV), url).toEqual({ ok: true });
    }
  });

  it("tanpa kunci server: null", () => {
    expect(alamatWebhookAffiliate("https://ayotka.id", {})).toBeNull();
  });
});
