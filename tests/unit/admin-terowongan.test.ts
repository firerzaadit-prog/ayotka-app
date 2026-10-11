import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Bungkus createClient asli: perilaku nyata tetap jalan (tes ujung-ke-ujung di bawah), tetapi argumen yang diterimanya
// bisa diperiksa - itu yang membuktikan jalur bawaan (tanpa terowongan) tidak berubah sedikit pun.
const supa = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", async (impor) => {
  const asli = await impor<typeof import("@supabase/supabase-js")>();
  supa.createClient.mockImplementation(asli.createClient as never);
  return { ...asli, createClient: supa.createClient };
});

import { alihkanKeTerowongan, ambilUrlTerowongan, buatFetchTerowongan } from "@/lib/supabase/admin-terowongan";
import { createAdminClient } from "@/lib/supabase/admin";

const AUTH = "https://ayotka.test/supabase/auth/v1";
const TEROWONGAN = "http://127.0.0.1:19999";

describe("ambilUrlTerowongan", () => {
  it("tidak diatur atau kosong = null (perilaku produksi)", () => {
    expect(ambilUrlTerowongan({})).toBeNull();
    expect(ambilUrlTerowongan({ SUPABASE_ADMIN_TUNNEL_URL: "" })).toBeNull();
    expect(ambilUrlTerowongan({ SUPABASE_ADMIN_TUNNEL_URL: "   " })).toBeNull();
  });

  it("menerima http ke komputer ini sendiri, mengembalikan origin tanpa garis miring akhir", () => {
    expect(ambilUrlTerowongan({ SUPABASE_ADMIN_TUNNEL_URL: "http://127.0.0.1:19999" })).toBe(TEROWONGAN);
    expect(ambilUrlTerowongan({ SUPABASE_ADMIN_TUNNEL_URL: "http://127.0.0.1:19999/" })).toBe(TEROWONGAN);
    expect(ambilUrlTerowongan({ SUPABASE_ADMIN_TUNNEL_URL: " http://localhost:19999 " })).toBe("http://localhost:19999");
    expect(ambilUrlTerowongan({ SUPABASE_ADMIN_TUNNEL_URL: "http://[::1]:19999" })).toBe("http://[::1]:19999");
  });

  it("menolak semua yang bukan loopback polos: kunci service tidak boleh sampai ke host lain", () => {
    const salah = [
      "bukan url",
      "https://127.0.0.1:19999",
      "http://ayotka.id:19999",
      "http://187.77.115.29:9999",
      "http://127.0.0.1.evil.example:19999",
      "http://evil.example/127.0.0.1",
      "http://user:sandi@127.0.0.1:19999",
      "http://127.0.0.1:19999/admin",
      "http://127.0.0.1:19999/?x=1",
      "http://127.0.0.1:19999/#x",
      "http://0.0.0.0:19999",
    ];
    for (const s of salah) {
      expect(() => ambilUrlTerowongan({ SUPABASE_ADMIN_TUNNEL_URL: s }), s).toThrow(/SUPABASE_ADMIN_TUNNEL_URL/);
    }
  });
});

describe("alihkanKeTerowongan", () => {
  it("mengalihkan semua alamat di bawah API auth, query ikut", () => {
    expect(alihkanKeTerowongan(`${AUTH}/admin/users?page=1&per_page=50`, AUTH, TEROWONGAN)).toBe(
      "http://127.0.0.1:19999/admin/users?page=1&per_page=50",
    );
    expect(alihkanKeTerowongan(`${AUTH}/admin/generate_link`, AUTH, TEROWONGAN)).toBe("http://127.0.0.1:19999/admin/generate_link");
    expect(alihkanKeTerowongan(`${AUTH}/token?grant_type=password`, AUTH, TEROWONGAN)).toBe(
      "http://127.0.0.1:19999/token?grant_type=password",
    );
    expect(alihkanKeTerowongan(AUTH, AUTH, TEROWONGAN)).toBe(TEROWONGAN);
  });

  it("garis miring akhir pada authBase tidak mengubah hasil", () => {
    expect(alihkanKeTerowongan(`${AUTH}/admin/users`, `${AUTH}/`, TEROWONGAN)).toBe("http://127.0.0.1:19999/admin/users");
  });

  it("alamat lain dibiarkan (null), termasuk yang hanya mirip awalannya", () => {
    expect(alihkanKeTerowongan("https://ayotka.test/supabase/storage/v1/object/x", AUTH, TEROWONGAN)).toBeNull();
    expect(alihkanKeTerowongan("https://ayotka.test/supabase/auth/v10/admin/users", AUTH, TEROWONGAN)).toBeNull();
    expect(alihkanKeTerowongan("https://ayotka.test/supabase/auth/v1evil/admin", AUTH, TEROWONGAN)).toBeNull();
    expect(alihkanKeTerowongan("https://lain.test/x", AUTH, TEROWONGAN)).toBeNull();
    expect(alihkanKeTerowongan(`https://evil.test/?u=${AUTH}/admin/users`, AUTH, TEROWONGAN)).toBeNull();
  });
});

describe("buatFetchTerowongan", () => {
  const dasar = vi.fn(async (..._args: Parameters<typeof fetch>) => new Response("ok"));
  beforeEach(() => dasar.mockClear());

  it("mengalihkan alamat auth (string dan URL) dengan init yang sama persis", async () => {
    const f = buatFetchTerowongan({ authBase: AUTH, terowongan: TEROWONGAN, dasar: dasar as unknown as typeof fetch });
    const init = { method: "POST", body: '{"a":1}', headers: { authorization: "Bearer x" } };
    await f(`${AUTH}/admin/users`, init);
    await f(new URL(`${AUTH}/admin/users/abc`), { method: "DELETE" });
    expect(dasar).toHaveBeenNthCalledWith(1, "http://127.0.0.1:19999/admin/users", init);
    expect(dasar).toHaveBeenNthCalledWith(2, "http://127.0.0.1:19999/admin/users/abc", { method: "DELETE" });
  });

  it("objek Request dialihkan dengan metode, header, dan isinya", async () => {
    const f = buatFetchTerowongan({ authBase: AUTH, terowongan: TEROWONGAN, dasar: dasar as unknown as typeof fetch });
    await f(new Request(`${AUTH}/admin/users`, { method: "POST", headers: { "x-a": "1" }, body: "isi" }));
    const [kirim] = dasar.mock.calls[0]!;
    expect(kirim).toBeInstanceOf(Request);
    const r = kirim as Request;
    expect(r.url).toBe("http://127.0.0.1:19999/admin/users");
    expect(r.method).toBe("POST");
    expect(r.headers.get("x-a")).toBe("1");
    expect(await r.text()).toBe("isi");
  });

  it("alamat non-auth dilewatkan tanpa diubah", async () => {
    const f = buatFetchTerowongan({ authBase: AUTH, terowongan: TEROWONGAN, dasar: dasar as unknown as typeof fetch });
    const init = { method: "GET" };
    await f("https://ayotka.test/supabase/storage/v1/bucket", init);
    expect(dasar).toHaveBeenCalledWith("https://ayotka.test/supabase/storage/v1/bucket", init);
  });
});

describe("createAdminClient dengan supabase-js asli", () => {
  const ENV_ASAL = { ...process.env };
  const panggilan: Array<{ url: string; method: string; auth: string | null; body: unknown }> = [];

  beforeEach(() => {
    panggilan.length = 0;
    supa.createClient.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ayotka.test/supabase";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "kunci-service-uji";
    delete process.env.SUPABASE_ADMIN_TUNNEL_URL;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        panggilan.push({
          url,
          method: init?.method ?? "GET",
          auth: new Headers(init?.headers).get("authorization"),
          body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
        });
        const isi = url.endsWith("/admin/users") && init?.method === "POST"
          ? { id: "u-1", aud: "authenticated", email: "a@b.test" }
          : { users: [], aud: "authenticated" };
        return new Response(JSON.stringify(isi), { status: 200, headers: { "content-type": "application/json" } });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ENV_ASAL };
  });

  it("TANPA terowongan: opsi klien persis seperti sebelum fitur ini ada, dan alamat tetap publik", async () => {
    await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1 });

    expect(supa.createClient).toHaveBeenCalledTimes(1);
    expect(supa.createClient).toHaveBeenCalledWith("https://ayotka.test/supabase", "kunci-service-uji", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const opsi = supa.createClient.mock.calls[0]![2] as Record<string, unknown>;
    expect(Object.keys(opsi)).toEqual(["auth"]); // tidak ada "global"
    expect(panggilan).toHaveLength(1);
    expect(panggilan[0]!.url).toMatch(/^https:\/\/ayotka\.test\/supabase\/auth\/v1\/admin\/users\?/);
    expect(panggilan[0]!.auth).toBe("Bearer kunci-service-uji");
  });

  it("DENGAN terowongan: listUsers dan createUser sampai ke GoTrue lewat loopback, kunci dan isi utuh", async () => {
    process.env.SUPABASE_ADMIN_TUNNEL_URL = TEROWONGAN;
    const admin = createAdminClient();
    await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    await admin.auth.admin.createUser({ email: "a@b.test", password: "rahasia-uji-123", email_confirm: true });

    expect(panggilan).toHaveLength(2);
    expect(panggilan[0]!.url).toMatch(/^http:\/\/127\.0\.0\.1:19999\/admin\/users\?.*per_page=1/);
    expect(panggilan[0]!.method).toBe("GET");
    expect(panggilan[1]!.url).toBe("http://127.0.0.1:19999/admin/users");
    expect(panggilan[1]!.method).toBe("POST");
    expect(panggilan[1]!.body).toMatchObject({ email: "a@b.test", email_confirm: true });
    for (const p of panggilan) expect(p.auth).toBe("Bearer kunci-service-uji");
    // tidak satu pun panggilan lari ke alamat publik
    expect(panggilan.every((p) => p.url.startsWith("http://127.0.0.1:19999/"))).toBe(true);
  });

  it("isian terowongan yang salah membuat klien gagal dibuat (bukan diam-diam memakai jalur lain)", () => {
    process.env.SUPABASE_ADMIN_TUNNEL_URL = "http://ayotka.id:19999";
    expect(() => createAdminClient()).toThrow(/SUPABASE_ADMIN_TUNNEL_URL/);
    expect(panggilan).toHaveLength(0);
  });
});
