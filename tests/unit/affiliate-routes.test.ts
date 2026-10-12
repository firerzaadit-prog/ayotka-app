import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  fulfil: vi.fn(),
  userFind: vi.fn(),
  studentFind: vi.fn(),
  rate: vi.fn(),
}));

vi.mock("@/lib/billing/affiliate-fulfillment", () => ({ processAffiliateFulfillment: m.fulfil }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findFirst: m.userFind }, student: { findFirst: m.studentFind } } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rate }));
vi.mock("@/lib/audit/log", () => ({ getClientIp: () => "1.2.3.4" }));

import { GET as purchaseGet, POST as purchasePost } from "@/app/api/webhooks/affiliate/route";
import { GET as successGet, POST as successPost } from "@/app/api/webhooks/affiliate/success/route";
import { GET as cekEmailGet, POST as cekEmailPost } from "@/app/api/webhooks/affiliate/check-email/route";
import { GET as cekAkunGet, POST as cekAkunPost } from "@/app/api/webhooks/affiliate/check-account/route";
import { rahasiaWebhookAffiliate } from "@/lib/billing/affiliate-auth";

const KUNCI_SERVER = "kunci-enkripsi-server-uji-1234567890";
const RAHASIA = rahasiaWebhookAffiliate({ APP_ENCRYPTION_KEY: KUNCI_SERVER })!;
const T50 = "jqKvm6YMT1YzqDwgdVey";
const BASE = "https://ayotka.id/api/webhooks/affiliate";

const json = (url: string, isi: unknown, headers: Record<string, string> = {}) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(isi) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ENCRYPTION_KEY", KUNCI_SERVER);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("AFFILIATE_WEBHOOK_SECRET", "");
  m.rate.mockReturnValue(true);
  m.fulfil.mockResolvedValue({ ok: true, message: "ok", type: "topup", nominal: 50_000, studentName: "Budi" });
  m.userFind.mockResolvedValue({ id: "user-uuid-1", email: "budi@example.com" });
  m.studentFind.mockResolvedValue({ id: "siswa-1", nama: "Budi" });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

const semuaLog = () => [...vi.mocked(console.log).mock.calls, ...vi.mocked(console.warn).mock.calls, ...vi.mocked(console.error).mock.calls].map((c) => JSON.stringify(c)).join(" | ");

describe("webhook affiliate: TANPA rahasia semuanya ditolak (celah lama: siapa pun bisa mengisi saldo)", () => {
  const PURCHASE = `${BASE}?email=budi@example.com&product_id=${T50}&order_id=ORD-1&amount=50000`;

  it("Purchase GET dan POST -> 401, pemenuhan tidak dipanggil, header CORS tetap ada", async () => {
    for (const res of [await purchaseGet(new Request(PURCHASE)), await purchasePost(json(BASE, { email: "budi@example.com", product_id: T50, order_id: "ORD-1" }))]) {
      expect(res.status).toBe(401);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(await res.json()).toMatchObject({ ok: false, status: false, message: "Tidak diizinkan." });
    }
    expect(m.fulfil).not.toHaveBeenCalled();
  });

  it("Success SaaS (GET dan POST) -> 401, pemenuhan tidak dipanggil", async () => {
    expect((await successPost(json(`${BASE}/success`, { uid: "u", order_id: "1", product_id: T50 }))).status).toBe(401);
    expect((await successGet(new Request(`${BASE}/success?uid=u&order_id=1&product_id=${T50}`))).status).toBe(401);
    expect(m.fulfil).not.toHaveBeenCalled();
  });

  it("check-email dan check-account -> 401 dan TIDAK membaca database (tidak membocorkan email/ID akun)", async () => {
    expect((await cekEmailPost(json(`${BASE}/check-email`, { email: "budi@example.com" }))).status).toBe(401);
    expect((await cekEmailGet(new Request(`${BASE}/check-email?email=budi@example.com`))).status).toBe(401);
    expect((await cekAkunPost(json(`${BASE}/check-account`, { uid: "user-uuid-1" }))).status).toBe(401);
    expect((await cekAkunGet(new Request(`${BASE}/check-account?uid=user-uuid-1`))).status).toBe(401);
    expect(m.userFind).not.toHaveBeenCalled();
    expect(m.studentFind).not.toHaveBeenCalled();
  });

  it("rahasia salah -> 401 juga", async () => {
    expect((await purchaseGet(new Request(`${PURCHASE}&token=salah`))).status).toBe(401);
    expect(m.fulfil).not.toHaveBeenCalled();
  });

  it("server tanpa kunci apa pun -> 503 (gagal tertutup) untuk semua endpoint, bahkan dengan 'token'", async () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", "");
    for (const res of [
      await purchaseGet(new Request(`${PURCHASE}&token=${RAHASIA}`)),
      await successPost(json(`${BASE}/success?token=${RAHASIA}`, {})),
      await cekEmailPost(json(`${BASE}/check-email?token=${RAHASIA}`, { email: "a@b.co" })),
      await cekAkunPost(json(`${BASE}/check-account?token=${RAHASIA}`, { uid: "u" })),
    ]) {
      expect(res.status).toBe(503);
    }
    expect(m.fulfil).not.toHaveBeenCalled();
  });

  it("penolakan dicatat di log tanpa memuat email, produk, atau rahasia", async () => {
    await purchaseGet(new Request(`${PURCHASE}&token=salah-rahasia`));
    const log = semuaLog();
    expect(log).toContain("ditolak");
    for (const rahasia of ["budi@example.com", "salah-rahasia", RAHASIA, T50]) expect(log).not.toContain(rahasia);
  });
});

describe("webhook affiliate: dengan rahasia yang benar", () => {
  it("Purchase GET: pemenuhan dipanggil dengan data kiriman; token TIDAK ikut ke rawPayload (audit log) maupun log server", async () => {
    const res = await purchaseGet(new Request(`${BASE}?token=${RAHASIA}&email=budi@example.com&product_id=${T50}&order_id=ORD-7&amount=50000`));
    expect(res.status).toBe(200);
    expect(m.fulfil).toHaveBeenCalledTimes(1);
    const arg = m.fulfil.mock.calls[0]![0];
    expect(arg).toMatchObject({ email: "budi@example.com", orderRef: "ORD-7", productId: T50, amount: 50_000, paymentChannel: "affiliate_get_webhook" });
    expect(JSON.stringify(arg)).not.toContain(RAHASIA);
    expect(semuaLog()).not.toContain(RAHASIA);
  });

  it("Purchase POST (JSON) dengan rahasia di header Bearer: diproses, rahasia tidak bocor ke log", async () => {
    const res = await purchasePost(json(BASE, { email: "budi@example.com", product_id: T50, order_id: "ORD-8" }, { authorization: `Bearer ${RAHASIA}` }));
    expect(res.status).toBe(200);
    expect(m.fulfil.mock.calls[0]![0]).toMatchObject({ email: "budi@example.com", orderRef: "ORD-8", paymentChannel: "affiliate_post_webhook" });
    expect(semuaLog()).not.toContain(RAHASIA);
  });

  it("Purchase POST dengan rahasia di query: tidak ikut ke rawPayload dan log", async () => {
    await purchasePost(json(`${BASE}?token=${RAHASIA}`, { email: "budi@example.com", product_id: T50, order_id: "ORD-9" }));
    expect(JSON.stringify(m.fulfil.mock.calls[0]![0])).not.toContain(RAHASIA);
    expect(semuaLog()).not.toContain(RAHASIA);
  });

  it("Purchase GET dibuka browser pembeli (Accept: text/html): dialihkan ke dompet di alamat situs", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ayotka.id");
    const res = await purchaseGet(new Request(`https://localhost:3001/api/webhooks/affiliate?token=${RAHASIA}&email=budi@example.com&product_id=${T50}&order_id=ORD-10`, { headers: { accept: "text/html" } }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://ayotka.id/siswa/wallet?sukses=topup");
  });

  it("Success SaaS: uid/aid/order diteruskan ke pemenuhan; kegagalan pemenuhan = 400 status:false", async () => {
    const ok = await successPost(json(`${BASE}/success?token=${RAHASIA}`, { uid: "user-uuid-1", aid: "siswa-1", order_id: "ORD-11", product_id: T50 }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ status: true });
    expect(m.fulfil.mock.calls[0]![0]).toMatchObject({ userId: "user-uuid-1", studentId: "siswa-1", orderRef: "ORD-11", productId: T50, paymentChannel: "affiliate_saas_success" });

    m.fulfil.mockResolvedValue({ ok: false, message: "Siswa tidak ditemukan", kode: "siswa_tidak_ditemukan" });
    const gagal = await successPost(json(`${BASE}/success?token=${RAHASIA}`, { uid: "x", product_id: T50 }));
    expect(gagal.status).toBe(400);
    expect(await gagal.json()).toMatchObject({ status: false });
  });

  it("check-email: akun ada -> status true + uid; tidak ada -> status false (HTTP 200); email kosong -> 400", async () => {
    const ada = await cekEmailPost(json(`${BASE}/check-email?token=${RAHASIA}`, { email: "budi@example.com" }));
    expect(await ada.json()).toEqual({ status: true, data: { email: "budi@example.com", uid: "user-uuid-1" } });
    m.userFind.mockResolvedValue(null);
    const tidak = await cekEmailGet(new Request(`${BASE}/check-email?token=${RAHASIA}&email=tidak.ada@example.com`));
    expect(tidak.status).toBe(200);
    expect(await tidak.json()).toMatchObject({ status: false, data: null });
    expect((await cekEmailPost(json(`${BASE}/check-email?token=${RAHASIA}`, {}))).status).toBe(400);
  });

  it("check-account: uid dikenal -> data siswa; tidak dikenal -> status false", async () => {
    const ada = await cekAkunPost(json(`${BASE}/check-account?token=${RAHASIA}`, { uid: "user-uuid-1" }));
    expect(await ada.json()).toEqual({ status: true, data: { uid: "user-uuid-1", aid: [{ aid: "siswa-1", title: "Budi", slug: "siswa-1" }] } });
    m.studentFind.mockResolvedValue(null);
    expect(await (await cekAkunGet(new Request(`${BASE}/check-account?token=${RAHASIA}&uid=lain`))).json()).toMatchObject({ status: false, data: null });
  });

  it("check-email dan check-account dibatasi lajunya per IP -> 429 tanpa membaca database", async () => {
    m.rate.mockReturnValue(false);
    expect((await cekEmailPost(json(`${BASE}/check-email?token=${RAHASIA}`, { email: "budi@example.com" }))).status).toBe(429);
    expect((await cekAkunPost(json(`${BASE}/check-account?token=${RAHASIA}`, { uid: "user-uuid-1" }))).status).toBe(429);
    expect(m.userFind).not.toHaveBeenCalled();
    expect(m.studentFind).not.toHaveBeenCalled();
    expect(m.rate.mock.calls.map((c) => c[0])).toEqual(["affiliate-check-email:1.2.3.4", "affiliate-check-account:1.2.3.4"]);
  });
});

describe("webhook affiliate: bentuk panggilan ASLI affiliate.id (dari audit log 11-12 Okt)", () => {
  // Isi Success SaaS persis seperti yang tercatat: tanpa email, produk, atau nominal.
  const ASLI = { uid: "46a031b2-718e-48d4-bce0-c3bb88056a37", type: "onetime", duration: 30, affiliateId: "tomili2204-gmail--1789370238619066965", invoice_number: "AFF-TOM-1791781541315" };

  it("Success: pembeli dari uid, nomor order dari invoice_number, produk dari ?produk= di alamat", async () => {
    const res = await successPost(json(`${BASE}/success?token=${RAHASIA}&produk=topup25k`, ASLI));
    expect(res.status).toBe(200);
    expect(m.fulfil.mock.calls[0]![0]).toMatchObject({ userId: ASLI.uid, orderRef: ASLI.invoice_number, produkKode: "topup25k", paymentChannel: "affiliate_saas_success" });
  });

  it("Success tanpa ?produk= (alamat lama atau salah tempel): kode produk null, supaya pemenuhan menolaknya dengan petunjuk", async () => {
    await successPost(json(`${BASE}/success?token=${RAHASIA}`, ASLI));
    expect(m.fulfil.mock.calls[0]![0].produkKode).toBeNull();
  });

  it("kode produk hanya dibaca dari ALAMAT: yang ada di isi kiriman diabaikan, tidak bisa menimpa", async () => {
    await successPost(json(`${BASE}/success?token=${RAHASIA}&produk=topup25k`, { ...ASLI, produk: "topup50k" }));
    expect(m.fulfil.mock.calls[0]![0].produkKode).toBe("topup25k");
    await successPost(json(`${BASE}/success?token=${RAHASIA}`, { ...ASLI, produk: "topup50k" }));
    expect(m.fulfil.mock.calls[1]![0].produkKode).toBeNull();
  });

  it("alamat yang ditempeli '?uid=...' oleh affiliate.id: kode produk dan rahasia tetap terbaca", async () => {
    const res = await successGet(new Request(`${BASE}/success?token=${RAHASIA}&produk=semester?uid=${ASLI.uid}&invoice_number=${ASLI.invoice_number}`));
    expect(res.status).toBe(200);
    expect(m.fulfil.mock.calls[0]![0]).toMatchObject({ produkKode: "semester", orderRef: ASLI.invoice_number });
  });

  it("Success mencatat di log SEMUA kunci yang diterima (untuk mengetahui nama asli parameter), tanpa rahasia", async () => {
    await successPost(json(`${BASE}/success?token=${RAHASIA}&produk=bulanan`, { ...ASLI, kunci_baru_affiliate: "nilai-baru" }));
    const log = semuaLog();
    for (const kunci of ["uid", "invoice_number", "affiliateId", "duration", "kunci_baru_affiliate", "bulanan"]) expect(log).toContain(kunci);
    expect(log).not.toContain(RAHASIA);
  });

  it("Purchase tanpa email: 400 tanpa memanggil pemenuhan (bukan kegagalan yang dicatat untuk admin); GET dan POST", async () => {
    const get = await purchaseGet(new Request(`${BASE}?token=${RAHASIA}&invoice_number=${ASLI.invoice_number}&product_id=${T50}`));
    expect(get.status).toBe(400);
    expect((await purchasePost(json(`${BASE}?token=${RAHASIA}`, { invoice_number: ASLI.invoice_number, product_id: T50 }))).status).toBe(400);
    expect(m.fulfil).not.toHaveBeenCalled();
  });

  it("Purchase dengan email: invoice_number dipakai sebagai nomor order (sama dengan Success, jadi tidak diproses dua kali)", async () => {
    await purchaseGet(new Request(`${BASE}?token=${RAHASIA}&email=budi@example.com&invoice_number=${ASLI.invoice_number}&product_id=${T50}`));
    await purchasePost(json(`${BASE}?token=${RAHASIA}`, { email: "budi@example.com", invoice_number: ASLI.invoice_number, product_id: T50 }));
    expect(m.fulfil.mock.calls[0]![0].orderRef).toBe(ASLI.invoice_number);
    expect(m.fulfil.mock.calls[1]![0].orderRef).toBe(ASLI.invoice_number);
  });

  it("Purchase GET mencatat di log semua parameter yang dikirim, termasuk yang namanya belum dikenal, tanpa rahasia", async () => {
    await purchaseGet(new Request(`${BASE}?token=${RAHASIA}&email=budi@example.com&nama_parameter_asing=xyz&product_id=${T50}`));
    const log = semuaLog();
    expect(log).toContain("nama_parameter_asing");
    expect(log).not.toContain(RAHASIA);
  });
});
