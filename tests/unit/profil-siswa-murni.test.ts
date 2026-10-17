import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { signInWithPassword: m.signIn, signOut: m.signOut } }),
}));

import { klasifikasiGalatVerifikasi, verifikasiPasswordSaatIni } from "@/lib/auth/verifikasi-password";
import {
  buatEmailEmailDiubahKeBaru,
  buatEmailEmailDiubahKeLama,
  buatEmailPasswordDiubah,
} from "@/lib/email/profil";
import * as aturanProfil from "@/lib/siswa/profil";
import { bisaUbahEmail } from "@/lib/siswa/profil";
import { gantiEmailSchema, gantiPasswordSchema, normalisasiNomorWa, profilUpdateSchema } from "@/lib/validations/profil";

describe("normalisasiNomorWa", () => {
  it.each([
    ["081234567890", "081234567890"],
    ["0812 3456 7890", "081234567890"],
    ["0812-3456-7890", "081234567890"],
    ["+6281234567890", "081234567890"],
    ["6281234567890", "081234567890"],
    ["  081234567890  ", "081234567890"],
    ["08123456789", "08123456789"],
    ["0812345678901", "0812345678901"],
  ])("'%s' -> %s", (masuk, keluar) => {
    expect(normalisasiNomorWa(masuk)).toBe(keluar);
  });

  it.each(["", "   ", null, undefined])("kosong (%s) -> null (menghapus nomor)", (masuk) => {
    expect(normalisasiNomorWa(masuk)).toBeNull();
  });

  it.each(["12345", "0812345", "081234567890123456", "08abc4567890", "+1 202 555 0101", "0712345678901", "abc"])(
    "'%s' tidak valid",
    (masuk) => {
      expect(normalisasiNomorWa(masuk)).toBe("tidak_valid");
    },
  );
});

describe("skema profil", () => {
  it("profilUpdateSchema: minimal satu kolom", () => {
    expect(profilUpdateSchema.safeParse({}).success).toBe(false);
    expect(profilUpdateSchema.safeParse({ nama: "Budi" }).success).toBe(true);
    expect(profilUpdateSchema.safeParse({ waKontak: null }).success).toBe(true);
    expect(profilUpdateSchema.safeParse({ waKontak: "" }).success).toBe(true);
  });

  it("gantiEmailSchema: huruf kecil dan dipangkas", () => {
    const r = gantiEmailSchema.safeParse({ emailBaru: "  Budi@Contoh.ID ", password: "x" });
    expect(r.success && r.data.emailBaru).toBe("budi@contoh.id");
  });

  it("gantiPasswordSchema: batas panjang 8-72 dan harus berbeda dari yang lama", () => {
    const dasar = { passwordLama: "LamaLama#1", passwordBaru: "BaruBaru#2", konfirmasi: "BaruBaru#2" };
    expect(gantiPasswordSchema.safeParse(dasar).success).toBe(true);
    expect(gantiPasswordSchema.safeParse({ ...dasar, passwordBaru: "1234567", konfirmasi: "1234567" }).success).toBe(false);
    expect(gantiPasswordSchema.safeParse({ ...dasar, passwordBaru: "a".repeat(72), konfirmasi: "a".repeat(72) }).success).toBe(true);
    expect(gantiPasswordSchema.safeParse({ ...dasar, passwordBaru: "a".repeat(73), konfirmasi: "a".repeat(73) }).success).toBe(false);
    expect(gantiPasswordSchema.safeParse({ ...dasar, konfirmasi: "beda" }).success).toBe(false);
    expect(gantiPasswordSchema.safeParse({ passwordLama: "Sama#1234", passwordBaru: "Sama#1234", konfirmasi: "Sama#1234" }).success).toBe(false);
  });
});

describe("aturan siapa boleh mengubah apa", () => {
  it("nama: tidak ada lagi aturan pembatas per jalur (semua siswa, termasuk Jalur A, boleh mengubah namanya)", () => {
    expect(Object.keys(aturanProfil)).toEqual(["bisaUbahEmail"]);
  });

  it("email: tidak untuk akun NISN (email sintetis), ya untuk email sungguhan", () => {
    expect(bisaUbahEmail("0012345678@nisn.ayotka.id")).toBe(false);
    expect(bisaUbahEmail("0012345678@NISN.AYOTKA.ID")).toBe(false);
    expect(bisaUbahEmail("budi@contoh.id")).toBe(true);
    expect(bisaUbahEmail("budi@nisn.ayotka.id.palsu.com")).toBe(true);
  });
});

describe("klasifikasiGalatVerifikasi", () => {
  it("tanpa galat: benar", () => {
    expect(klasifikasiGalatVerifikasi(null)).toBe("benar");
  });

  it.each([
    [{ status: 400, code: "invalid_credentials", message: "Invalid login credentials" }, "salah"],
    [{ status: 401, message: "x" }, "salah"],
    [{ status: 422, message: "x" }, "salah"],
    [{ status: 429, message: "x" }, "dibatasi"],
    [{ status: 400, code: "over_request_rate_limit", message: "x" }, "dibatasi"],
    [{ status: 500, message: "x" }, "layanan"],
    [{ status: 502, message: "x" }, "layanan"],
    [{ status: 0, message: "x" }, "layanan"],
    [{ status: 402, message: "x" }, "layanan"],
    [{ status: 400, message: "exceed_egress_quota" }, "layanan"],
    [{ message: "Project is restricted due to the following violations", status: 403 }, "layanan"],
    [{ name: "AuthRetryableFetchError", message: "fetch failed" }, "layanan"],
    [{ name: "AuthUnknownError", message: "bukan JSON" }, "layanan"],
  ] as const)("%j -> %s", (galat, hasil) => {
    expect(klasifikasiGalatVerifikasi(galat)).toBe(hasil);
  });
});

describe("verifikasiPasswordSaatIni", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.signOut.mockResolvedValue({ error: null });
  });

  it("password benar: true dan sesi sementara dicabut", async () => {
    m.signIn.mockResolvedValue({ data: { user: { id: "u" }, session: { access_token: "t" } }, error: null });
    expect(await verifikasiPasswordSaatIni("a@b.id", "rahasia")).toBe("benar");
    expect(m.signIn).toHaveBeenCalledWith({ email: "a@b.id", password: "rahasia" });
    expect(m.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("password salah: 'salah' dan tidak ada sesi yang perlu dicabut", async () => {
    m.signIn.mockResolvedValue({ data: { user: null, session: null }, error: { status: 400, code: "invalid_credentials", message: "Invalid" } });
    expect(await verifikasiPasswordSaatIni("a@b.id", "salah")).toBe("salah");
    expect(m.signOut).not.toHaveBeenCalled();
  });

  it("gagal mencabut sesi sementara tidak mengubah hasil", async () => {
    m.signIn.mockResolvedValue({ data: { user: { id: "u" }, session: { access_token: "t" } }, error: null });
    m.signOut.mockRejectedValue(new Error("putus"));
    expect(await verifikasiPasswordSaatIni("a@b.id", "rahasia")).toBe("benar");
  });

  it("layanan tidak terjangkau (melempar): 'layanan', bukan galat tak tertangani", async () => {
    m.signIn.mockRejectedValue(new Error("ECONNREFUSED"));
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await verifikasiPasswordSaatIni("a@b.id", "rahasia")).toBe("layanan");
    galat.mockRestore();
  });
});

describe("email pemberitahuan akun", () => {
  const waktu = new Date("2026-10-16T05:30:00.000Z");
  const asal = "https://ayotka.id";

  it("password diubah: sapaan bernama, waktu WIB tepat sekali 'WIB', tautan lupa password dan bantuan WhatsApp", () => {
    const { subject, html } = buatEmailPasswordDiubah({ nama: "Budi", email: "budi@contoh.id", waktu, asal });
    expect(subject).toBe("Password akun AyoTKA kamu diubah");
    expect(html).toContain("Halo Budi,");
    expect(html).toContain("16 Oktober 2026, 12.30 WIB");
    expect(html).not.toMatch(/WIB WIB/);
    expect(html).toContain("https://ayotka.id/forgot-password");
    expect(html).toContain("https://wa.me/");
  });

  it("nama kosong: sapaan tanpa nama", () => {
    expect(buatEmailPasswordDiubah({ nama: "  ", email: "budi@contoh.id", waktu, asal }).html).toContain("<p>Halo,</p>");
  });

  it("nilai dari pengguna di-escape (nama dan email tidak bisa menyisipkan HTML)", () => {
    const { html } = buatEmailEmailDiubahKeLama({
      nama: '<script>alert("x")</script>',
      emailLama: "a<b>@x.id",
      emailBaru: 'c"d@y.id',
      waktu,
      asal,
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a&lt;b&gt;@x.id");
    expect(html).toContain("c&quot;d@y.id");
  });

  it("email lama: menyebut lama dan baru; email baru: tautan masuk dan password tidak berubah", () => {
    const lama = buatEmailEmailDiubahKeLama({ nama: "Budi", emailLama: "lama@x.id", emailBaru: "baru@x.id", waktu, asal });
    expect(lama.subject).toBe("Email akun AyoTKA kamu diganti");
    expect(lama.html).toContain("lama@x.id");
    expect(lama.html).toContain("baru@x.id");
    const baru = buatEmailEmailDiubahKeBaru({ nama: "Budi", emailBaru: "baru@x.id", waktu, asal });
    expect(baru.subject).toBe("Email baru akun AyoTKA kamu sudah aktif");
    expect(baru.html).toContain('href="https://ayotka.id/login"');
    expect(baru.html).toContain("Password-mu tidak berubah");
  });

  it("tidak membawa password atau token apa pun", () => {
    const semua = [
      buatEmailPasswordDiubah({ nama: "Budi", email: "budi@contoh.id", waktu, asal }).html,
      buatEmailEmailDiubahKeLama({ nama: "Budi", emailLama: "a@x.id", emailBaru: "b@x.id", waktu, asal }).html,
      buatEmailEmailDiubahKeBaru({ nama: "Budi", emailBaru: "b@x.id", waktu, asal }).html,
    ].join("\n");
    expect(semua).not.toMatch(/password\s*[:=]/i);
    expect(semua).not.toMatch(/token/i);
  });
});
