import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ kirimEmail: vi.fn() }));
vi.mock("@/lib/email/kirim", () => ({ kirimEmail: m.kirimEmail }));

import { kirimEmailKonfirmasi } from "@/lib/email/konfirmasi";

const params = { email: "siswa.rahasia@example.com", nama: "Budi <script>", tokenHash: "tok_abc123", type: "signup" as const, peran: "siswa" as const };
const htmlTerkirim = () => String(m.kirimEmail.mock.calls[0]![0].html);
const tautanDi = (html: string) => [...html.matchAll(/https?:\/\/[^"<\s]+\/api\/auth\/confirm[^"<\s]*/g)].map((x) => x[0]);

beforeEach(() => {
  m.kirimEmail.mockReset();
  m.kirimEmail.mockResolvedValue({ ok: true, lewat: "resend" });
});
afterEach(() => vi.unstubAllEnvs());

describe("kirimEmailKonfirmasi: tautan di dalam email", () => {
  it("tautan memakai alamat situs dari NEXT_PUBLIC_APP_URL, lengkap dengan token, jenis, dan tujuan", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ayotka.id");
    await expect(kirimEmailKonfirmasi(params)).resolves.toEqual({ ok: true, lewat: "resend" });
    const tautan = tautanDi(htmlTerkirim());
    // dua kali: tombol dan teks salinan
    expect(tautan).toHaveLength(2);
    expect(new Set(tautan)).toEqual(new Set(["https://ayotka.id/api/auth/confirm?token_hash=tok_abc123&type=signup&next=%2Fsiswa%2Fdashboard"]));
  });

  it("tujuan mitra ke dashboard mitra; jenis magiclink (kirim ulang) ikut terbawa", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ayotka.id");
    await kirimEmailKonfirmasi({ ...params, peran: "mitra", type: "magiclink" });
    expect(tautanDi(htmlTerkirim())[0]).toBe("https://ayotka.id/api/auth/confirm?token_hash=tok_abc123&type=magiclink&next=%2Fmitra%2Fdashboard");
  });

  it("garis miring di ujung alamat situs tidak menghasilkan '//' di tautan", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ayotka.id/");
    await kirimEmailKonfirmasi(params);
    expect(tautanDi(htmlTerkirim())[0]).toMatch(/^https:\/\/ayotka\.id\/api\/auth\/confirm\?/);
  });

  it("produksi tanpa NEXT_PUBLIC_APP_URL: TIDAK mengirim tautan rusak dan tidak melempar galat; kembali gagal dengan kode yang jelas", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const hasil = await kirimEmailKonfirmasi(params);
    expect(hasil).toMatchObject({ ok: false, kode: "app-url-tidak-valid", kuotaHabis: false });
    expect(m.kirimEmail).not.toHaveBeenCalled();
  });

  it("alamat situs yang bukan URL sah di produksi juga dibatalkan dengan kode yang sama", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "bukan url sama sekali");
    expect(await kirimEmailKonfirmasi(params)).toMatchObject({ ok: false, kode: "app-url-tidak-valid" });
    expect(m.kirimEmail).not.toHaveBeenCalled();
  });

  it("di luar produksi tanpa env: memakai http://localhost:3000 (dev/tes tetap berjalan)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    await kirimEmailKonfirmasi(params);
    expect(tautanDi(htmlTerkirim())[0]).toMatch(/^http:\/\/localhost:3000\/api\/auth\/confirm\?/);
  });

  it("galat tak terduga (pengirim melempar) TIDAK menjadi 500: dikembalikan sebagai kegagalan berkode, dan dicatat di log", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ayotka.id");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.kirimEmail.mockRejectedValue(new Error("koneksi pecah"));
    await expect(kirimEmailKonfirmasi(params)).resolves.toEqual({
      ok: false,
      error: "Galat tak terduga saat mengirim email konfirmasi",
      kuotaHabis: false,
      kode: "email-galat-tak-terduga",
    });
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("nama penerima di-escape (tidak menyisipkan HTML) dan hasil pengiriman diteruskan apa adanya saat gagal", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ayotka.id");
    m.kirimEmail.mockResolvedValue({ ok: false, error: "x", kuotaHabis: false, kode: "resend-401 + mailketing-nonaktif" });
    const hasil = await kirimEmailKonfirmasi(params);
    expect(hasil).toMatchObject({ ok: false, kode: "resend-401 + mailketing-nonaktif" });
    expect(htmlTerkirim()).not.toContain("<script>");
    expect(htmlTerkirim()).toContain("Budi &lt;script&gt;");
  });
});
