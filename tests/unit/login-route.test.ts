import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  userFind: vi.fn(),
  hasActiveSchoolAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword: m.signIn, signOut: m.signOut } }),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: m.userFind, update: vi.fn() },
    loginLog: { create: vi.fn() },
    $transaction: vi.fn(async () => []),
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/auth/session", () => ({ hasActiveSchoolAccess: m.hasActiveSchoolAccess }));

import { POST } from "@/app/api/auth/login/route";

let urutanIp = 0;
/** Tiap tes memakai IP sendiri: penghitung batas disimpan di memori proses dan dibagi antar tes. */
const ipBaru = () => `10.20.${Math.floor(++urutanIp / 250)}.${urutanIp % 250}`;

function masuk(ip: string, emailOrNisn: string, password = "sandi-benar") {
  return POST(
    new Request("http://x/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip, "user-agent": "vitest" },
      body: JSON.stringify({ emailOrNisn, password }),
    }),
  );
}

const BERHASIL = { data: { user: { id: "u1", app_metadata: { role: "siswa" } } }, error: null };
const salahSandi = { data: { user: null }, error: { code: "invalid_credentials", status: 400, message: "Invalid login credentials" } };

/** Sandi "benar" hanya kalau persis "sandi-benar"; selain itu salah sandi. */
function akunNormal() {
  m.signIn.mockImplementation(async ({ password }: { password: string }) => (password === "sandi-benar" ? BERHASIL : salahSandi));
}

beforeEach(() => {
  vi.resetAllMocks();
  m.userFind.mockResolvedValue({ status: "aktif", role: "siswa" });
  m.hasActiveSchoolAccess.mockResolvedValue(true);
  m.signOut.mockResolvedValue({});
  akunNormal();
});
afterEach(() => {
  delete process.env.LOGIN_MAX_PER_IP;
  delete process.env.LOGIN_FAIL_LIMIT_PER_IP;
  delete process.env.LOGIN_FAIL_LIMIT_PER_ACCOUNT;
});

describe("POST /api/auth/login - pembatas yang hanya menghitung kegagalan", () => {
  it("satu kelas/lab di belakang SATU IP: 100 siswa login benar serentak, semuanya berhasil (tidak ada 429)", async () => {
    const ip = ipBaru();
    const hasil = [];
    for (let i = 1; i <= 100; i++) hasil.push((await masuk(ip, `9${String(i).padStart(9, "0")}`)).status);
    expect(hasil.every((s) => s === 200)).toBe(true);
  });

  it("penebak satu akun: 5 kegagalan lolos ke Supabase (401), percobaan ke-6 langsung 429 tanpa menyentuh Supabase", async () => {
    const ip = ipBaru();
    for (let i = 0; i < 5; i++) expect((await masuk(ip, "9000000001", "salah")).status).toBe(401);
    expect(m.signIn).toHaveBeenCalledTimes(5);
    const res = await masuk(ip, "9000000001", "salah");
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(m.signIn).toHaveBeenCalledTimes(5);
  });

  it("akun yang sedang diblokir tidak bisa masuk walau kata sandinya benar (selama jendela 1 menit)", async () => {
    const ip = ipBaru();
    for (let i = 0; i < 5; i++) await masuk(ip, "9000000002", "salah");
    expect((await masuk(ip, "9000000002", "sandi-benar")).status).toBe(429);
  });

  it("penebak banyak akun dari satu IP: 30 kegagalan lolos, percobaan ke-31 (akun baru) ditolak 429", async () => {
    const ip = ipBaru();
    for (let i = 1; i <= 30; i++) expect((await masuk(ip, `9${String(500 + i).padStart(9, "0")}`, "salah")).status).toBe(401);
    expect((await masuk(ip, "9000000999", "salah")).status).toBe(429);
  });

  it("login berhasil TIDAK menambah hitungan gagal: 4 gagal + 50 berhasil + gagal ke-5 masih 401, baru ke-6 yang 429", async () => {
    const ip = ipBaru();
    for (let i = 0; i < 4; i++) await masuk(ip, "9000000003", "salah");
    for (let i = 1; i <= 50; i++) expect((await masuk(ip, `9${String(700 + i).padStart(9, "0")}`)).status).toBe(200);
    expect((await masuk(ip, "9000000003", "salah")).status).toBe(401);
    expect((await masuk(ip, "9000000003", "salah")).status).toBe(429);
  });

  it("akun lain dari IP yang sama tidak ikut terblokir ketika satu akun diserang", async () => {
    const ip = ipBaru();
    for (let i = 0; i < 5; i++) await masuk(ip, "9000000004", "salah");
    expect((await masuk(ip, "9000000004", "salah")).status).toBe(429);
    expect((await masuk(ip, "9000000005")).status).toBe(200);
  });

  it("IP lain tidak terpengaruh blokir akun di IP pertama", async () => {
    const ip1 = ipBaru();
    const ip2 = ipBaru();
    for (let i = 0; i < 5; i++) await masuk(ip1, "9000000006", "salah");
    expect((await masuk(ip1, "9000000006", "salah")).status).toBe(429);
    expect((await masuk(ip2, "9000000006")).status).toBe(200);
  });

  it("NISN, email, dan beda huruf besar/kecil untuk akun yang sama dihitung satu akun", async () => {
    const ip = ipBaru();
    await masuk(ip, "9000000007", "salah");
    await masuk(ip, "9000000007", "salah");
    await masuk(ip, "9000000007@nisn.ayotka.id", "salah");
    await masuk(ip, "9000000007@NISN.ayotka.id", "salah");
    await masuk(ip, "9000000007@nisn.ayotka.id", "salah");
    expect((await masuk(ip, "9000000007", "salah")).status).toBe(429);
  });

  it("langit-langit semua percobaan per IP (anti banjir) bisa diatur: LOGIN_MAX_PER_IP=3 -> percobaan ke-4 ditolak", async () => {
    process.env.LOGIN_MAX_PER_IP = "3";
    const ip = ipBaru();
    for (let i = 1; i <= 3; i++) expect((await masuk(ip, `9${String(800 + i).padStart(9, "0")}`)).status).toBe(200);
    expect((await masuk(ip, "9000000808")).status).toBe(429);
  });

  it("batas kegagalan bisa diatur lewat env (rem darurat): LOGIN_FAIL_LIMIT_PER_ACCOUNT=1", async () => {
    process.env.LOGIN_FAIL_LIMIT_PER_ACCOUNT = "1";
    const ip = ipBaru();
    expect((await masuk(ip, "9000000009", "salah")).status).toBe(401);
    expect((await masuk(ip, "9000000009", "salah")).status).toBe(429);
  });
});

describe("POST /api/auth/login - kasus yang bukan penebakan tidak dihitung", () => {
  it("batas laju milik Supabase -> 429 dengan pesan 'sistem sedang ramai' (BUKAN 'password salah') dan tidak dihitung gagal", async () => {
    const ip = ipBaru();
    m.signIn.mockResolvedValue({ data: { user: null }, error: { code: "over_request_rate_limit", status: 429, message: "rate limit" } });
    const res = await masuk(ip, "9000000010");
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/ramai/i);
    expect(body.error).not.toMatch(/password salah/i);
    expect(res.headers.get("Retry-After")).toBe("30");

    // 20 kali ditolak Supabase tidak membuat akun/IP itu terblokir oleh pembatas kita.
    for (let i = 0; i < 20; i++) await masuk(ip, "9000000010");
    akunNormal();
    expect((await masuk(ip, "9000000010")).status).toBe(200);
  });

  it("email belum dikonfirmasi: pesan khusus, dan 10 kali berturut-turut tidak membuat kena 429", async () => {
    const ip = ipBaru();
    m.signIn.mockResolvedValue({ data: { user: null }, error: { code: "email_not_confirmed", status: 400, message: "x" } });
    for (let i = 0; i < 10; i++) {
      const res = await masuk(ip, "siswa@contoh.com");
      expect(res.status).toBe(401);
      expect((await res.json()).code).toBe("EMAIL_BELUM_DIKONFIRMASI");
    }
  });

  it("akun nonaktif setelah kata sandi benar: ditolak 401 dan tidak dihitung sebagai kegagalan", async () => {
    const ip = ipBaru();
    m.userFind.mockResolvedValue({ status: "nonaktif", role: "siswa" });
    for (let i = 0; i < 8; i++) expect((await masuk(ip, "9000000011")).status).toBe(401);
  });

  it("body tidak valid -> 400 (tetap ikut langit-langit, tidak ikut hitungan gagal)", async () => {
    const ip = ipBaru();
    const res = await POST(
      new Request("http://x/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ emailOrNisn: "", password: "" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("login berhasil mengembalikan arah halaman sesuai peran", async () => {
    const res = await masuk(ipBaru(), "9000000012");
    expect(res.status).toBe(200);
    expect((await res.json()).redirectTo).toBe("/siswa/dashboard");
  });
});
