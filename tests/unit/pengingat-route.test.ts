import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  jalankan: vi.fn(),
  kirimEmail: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { penanda: "prisma-tiruan" } }));
vi.mock("@/lib/email/kirim", () => ({ kirimEmail: m.kirimEmail }));
vi.mock("@/lib/billing/pengingat-periode", () => ({ jalankanPengingatPeriode: m.jalankan }));

import { GET } from "@/app/api/cron/pengingat-langganan/route";

const req = (qs = "", header?: string) =>
  new Request(`https://ayotka-preview.vercel.app/api/cron/pengingat-langganan${qs}`, {
    headers: header === undefined ? {} : { authorization: header },
  });
const HASIL = { dryRun: false, diperiksa: 2, terkirim: [{ schoolId: "s1" }], akanDikirim: [], dilewati: [], gagal: [] };

const secretAwal = process.env.CRON_SECRET;
const urlAwal = process.env.NEXT_PUBLIC_APP_URL;

beforeEach(() => {
  vi.resetAllMocks();
  m.jalankan.mockResolvedValue(HASIL);
  process.env.CRON_SECRET = "rahasia-cron";
  process.env.NEXT_PUBLIC_APP_URL = "https://ayotka.id";
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  if (secretAwal === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = secretAwal;
  if (urlAwal === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = urlAwal;
});

describe("GET /api/cron/pengingat-langganan - otorisasi", () => {
  it.each([
    ["tanpa header Authorization", undefined],
    ["header salah", "Bearer salah"],
    ["tanpa kata Bearer", "rahasia-cron"],
    ["huruf besar/kecil berbeda", "Bearer RAHASIA-CRON"],
  ])("401 kalau %s, dan tidak menjalankan apa pun", async (_nama, header) => {
    expect((await GET(req("", header))).status).toBe(401);
    expect(m.jalankan).not.toHaveBeenCalled();
  });

  it("401 kalau CRON_SECRET tidak diatur di server, bahkan untuk header 'Bearer undefined'", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req("", "Bearer undefined"))).status).toBe(401);
    expect((await GET(req("", "Bearer "))).status).toBe(401);
    expect(m.jalankan).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/pengingat-langganan - menjalankan pengingat", () => {
  it("dengan rahasia benar: menjalankan sungguhan dan mengembalikan ringkasannya", async () => {
    const res = await GET(req("", "Bearer rahasia-cron"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(HASIL);
    expect(m.jalankan).toHaveBeenCalledTimes(1);
    expect(m.jalankan.mock.calls[0]![1]).toEqual({ dryRun: false });
  });

  it("?dryRun=1 menjalankan mode simulasi; nilai lain tetap sungguhan", async () => {
    await GET(req("?dryRun=1", "Bearer rahasia-cron"));
    expect(m.jalankan.mock.calls[0]![1]).toEqual({ dryRun: true });
    await GET(req("?dryRun=0", "Bearer rahasia-cron"));
    expect(m.jalankan.mock.calls[1]![1]).toEqual({ dryRun: false });
    await GET(req("?dryRun=true", "Bearer rahasia-cron"));
    expect(m.jalankan.mock.calls[2]![1]).toEqual({ dryRun: false });
  });

  it("alamat aplikasi dari NEXT_PUBLIC_APP_URL (garis miring akhir dibuang); tanpa itu memakai asal permintaan", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://ayotka.id///";
    await GET(req("", "Bearer rahasia-cron"));
    expect(m.jalankan.mock.calls[0]![0].appUrl).toBe("https://ayotka.id");

    delete process.env.NEXT_PUBLIC_APP_URL;
    await GET(req("", "Bearer rahasia-cron"));
    expect(m.jalankan.mock.calls[1]![0].appUrl).toBe("https://ayotka-preview.vercel.app");
  });

  it("memakai database aplikasi dan pengirim email pusat; hasil kirim dipetakan ke ok/galat", async () => {
    await GET(req("", "Bearer rahasia-cron"));
    const deps = m.jalankan.mock.calls[0]![0] as {
      db: unknown;
      kirim: (e: { to: string; subject: string; html: string }) => Promise<{ ok: boolean; error?: string }>;
    };
    expect(deps.db).toEqual({ penanda: "prisma-tiruan" });

    const email = { to: "a@b.id", subject: "s", html: "<p>h</p>" };
    m.kirimEmail.mockResolvedValueOnce({ ok: true, lewat: "resend" });
    expect(await deps.kirim(email)).toEqual({ ok: true });
    expect(m.kirimEmail).toHaveBeenCalledWith(email);

    m.kirimEmail.mockResolvedValueOnce({ ok: false, error: "kuota habis", kuotaHabis: true });
    expect(await deps.kirim(email)).toEqual({ ok: false, error: "kuota habis" });
  });
});

describe("vercel.json - jadwal cron", () => {
  const akar = path.resolve(__dirname, "../..");
  const konfig = JSON.parse(readFileSync(path.join(akar, "vercel.json"), "utf8")) as {
    crons: { path: string; schedule: string }[];
  };

  it("JSON valid dan memuat cron pengingat langganan sekali sehari pukul 01.00 UTC (08.00 WIB)", () => {
    const pengingat = konfig.crons.find((c) => c.path === "/api/cron/pengingat-langganan");
    expect(pengingat).toEqual({ path: "/api/cron/pengingat-langganan", schedule: "0 1 * * *" });
  });

  it("cron antrean AI yang sudah ada tidak berubah", () => {
    expect(konfig.crons.find((c) => c.path === "/api/cron/proses-antrean-ai")).toEqual({
      path: "/api/cron/proses-antrean-ai",
      schedule: "0 3 * * *",
    });
  });

  it("setiap cron menunjuk rute yang benar-benar ada dan berjadwal sekali sehari (batas plan Hobby)", () => {
    for (const cron of konfig.crons) {
      expect(existsSync(path.join(akar, "app", ...cron.path.split("/").filter(Boolean), "route.ts"))).toBe(true);
      expect(cron.schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
    }
  });
});
