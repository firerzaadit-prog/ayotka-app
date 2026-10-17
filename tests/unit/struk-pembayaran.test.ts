import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ kirim: vi.fn() }));

// Hanya pengiriman yang ditiru; pembuat isi struk tetap yang asli.
vi.mock("@/lib/email/profil", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/profil")>()),
  kirimPemberitahuanAkun: m.kirim,
}));

import { kirimStrukKeEmailKontak, type SiswaUntukStruk } from "@/lib/email/struk-pembayaran";

const NISN: SiswaUntukStruk = {
  nama: "Siti Aminah",
  nisn: "3155213156",
  emailKontak: "ortu.siti@gmail.com",
  emailKontakVerifiedAt: new Date("2026-10-10T00:00:00Z"),
  user: { email: "3155213156@nisn.ayotka.id" },
};
const TOPUP = { jenis: "topup", nominal: 25_000 } as const;
const WAKTU = new Date("2026-10-16T03:00:00.000Z");

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ayotka.id/");
  m.kirim.mockResolvedValue({ ok: true, lewat: "resend" });
});

describe("kirimStrukKeEmailKontak", () => {
  it("akun NISN dengan email kontak terverifikasi: struk dikirim sekali ke email kontak, NISN hanya tersamar", async () => {
    await expect(kirimStrukKeEmailKontak(NISN, TOPUP, WAKTU)).resolves.toBe(true);
    expect(m.kirim).toHaveBeenCalledTimes(1);
    const [tujuan, isi] = m.kirim.mock.calls[0] as [string, { subject: string; html: string }];
    expect(tujuan).toBe("ortu.siti@gmail.com");
    expect(isi.subject).toBe("Bukti pembayaran AyoTKA: Top up saldo");
    expect(isi.html).toContain("Rp25.000");
    expect(isi.html).toContain("NISN ******3156");
    expect(isi.html).not.toContain("3155213156@nisn.ayotka.id");
    // tautan memakai alamat publik dari env (garis miring di ujung dibuang)
    expect(isi.html).toContain('href="https://ayotka.id/siswa/pembayaran"');
  });

  it("langganan: ringkasan paket ikut tercetak", async () => {
    await kirimStrukKeEmailKontak(NISN, { jenis: "langganan", namaPaket: "Paket Bulanan", harga: 59_000, berlakuSampai: new Date("2026-11-15T10:00:00Z") }, WAKTU);
    const isi = m.kirim.mock.calls[0]![1] as { subject: string; html: string };
    expect(isi.subject).toBe("Bukti pembayaran AyoTKA: Paket Paket Bulanan");
    expect(isi.html).toContain("Rp59.000");
    expect(isi.html).toContain("15 November 2026");
  });

  it("gagal kirim: mengembalikan false (tidak melempar)", async () => {
    m.kirim.mockResolvedValue({ ok: false, error: "kuota", kuotaHabis: true, kode: "resend-429" });
    await expect(kirimStrukKeEmailKontak(NISN, TOPUP, WAKTU)).resolves.toBe(false);
  });

  it.each([
    ["akun dengan email sungguhan (affiliate.id sudah mengirim buktinya ke sana)", { ...NISN, user: { email: "siti@gmail.com" } }],
    ["akun NISN tanpa email kontak", { ...NISN, emailKontak: null, emailKontakVerifiedAt: null }],
    ["email kontak belum terverifikasi", { ...NISN, emailKontakVerifiedAt: null }],
    ["tanpa akun login", { ...NISN, user: null }],
    ["data akun tidak dimuat", { ...NISN, user: undefined }],
  ])("%s: tidak ada struk (null)", async (_nama, siswa) => {
    await expect(kirimStrukKeEmailKontak(siswa as SiswaUntukStruk, TOPUP, WAKTU)).resolves.toBeNull();
    expect(m.kirim).not.toHaveBeenCalled();
  });

  it("galat tak terduga di pengiriman: dicatat dan hasilnya false; pemanggil tidak pernah kena lemparan", async () => {
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    m.kirim.mockRejectedValue(new Error("SMTP meledak"));
    await expect(kirimStrukKeEmailKontak(NISN, TOPUP, WAKTU)).resolves.toBe(false);
    expect(galat.mock.calls.some((c) => String(c[0]).includes("[struk-pembayaran]"))).toBe(true);
    galat.mockRestore();
  });

  it("tanpa NEXT_PUBLIC_APP_URL: tautan memakai alamat produksi bawaan", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    await kirimStrukKeEmailKontak(NISN, TOPUP, WAKTU);
    expect((m.kirim.mock.calls[0]![1] as { html: string }).html).toContain('href="https://ayotka.id/siswa/pembayaran"');
  });
});
