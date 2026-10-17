import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ kirimEmail: vi.fn(), kirimLewatSmtp: vi.fn() }));
vi.mock("@/lib/email/kirim", () => ({ kirimEmail: m.kirimEmail }));
vi.mock("@/lib/email/mailer", () => ({ kirimLewatSmtp: m.kirimLewatSmtp }));

import { buatEmailAkunBaru, kirimEmailAkunBaru, konteksDinas, urlMasukAkun, type IsiEmailAkunBaru } from "@/lib/email/akun-baru";

const DASAR: IsiEmailAkunBaru = {
  peran: "admin_sekolah",
  nama: "Pak Budi",
  email: "budi@sekolah.sch.id",
  passwordSementara: "Sementara#42x",
  konteks: "SD Negeri 1 Uji",
  asal: "https://ayotka.id",
};

describe("urlMasukAkun", () => {
  it("tiap peran punya pintu masuk sendiri; garis miring akhir pada asal dibuang", () => {
    expect(urlMasukAkun("admin_sekolah", "https://ayotka.id")).toBe("https://ayotka.id/admin/admin-sekolah");
    expect(urlMasukAkun("dinas_pendidikan", "https://ayotka.id/")).toBe("https://ayotka.id/admin/dinas-pendidikan");
    expect(urlMasukAkun("admin_sekolah", "http://localhost:3100///")).toBe("http://localhost:3100/admin/admin-sekolah");
  });
});

describe("konteksDinas", () => {
  it("wilayah ditambahkan hanya bila belum disebut di nama instansi (tanpa membedakan huruf besar kecil)", () => {
    expect(konteksDinas("Dinas Pendidikan Kota Malang", "Kota Malang")).toBe("Dinas Pendidikan Kota Malang");
    expect(konteksDinas("DINAS PENDIDIKAN PROVINSI BALI", "Bali")).toBe("DINAS PENDIDIKAN PROVINSI BALI");
    expect(konteksDinas("Dinas Pendidikan dan Kebudayaan", "Kota Batu")).toBe("Dinas Pendidikan dan Kebudayaan (Kota Batu)");
    expect(konteksDinas("  Dinas  ", "")).toBe("Dinas");
  });
});

describe("buatEmailAkunBaru", () => {
  it("admin sekolah: subjek memuat peran dan sekolah; isi memuat alamat masuk, email, password, dan kewajiban ganti password", () => {
    const e = buatEmailAkunBaru(DASAR);
    expect(e.subject).toBe("Akun Admin Sekolah AyoTKA - SD Negeri 1 Uji sudah dibuat");
    for (const bagian of [e.text, e.html]) {
      expect(bagian).toContain("https://ayotka.id/admin/admin-sekolah");
      expect(bagian).toContain("budi@sekolah.sch.id");
      expect(bagian).toContain("Sementara#42x");
      expect(bagian).toContain("Pak Budi");
    }
    expect(e.text).toMatch(/diminta menggantinya saat pertama kali masuk/);
    expect(e.html).toMatch(/sementara<\/strong>/);
  });

  it("dinas pendidikan: pintu masuk dan label dinas", () => {
    const e = buatEmailAkunBaru({ ...DASAR, peran: "dinas_pendidikan", konteks: "Dinas Pendidikan Kota Malang" });
    expect(e.subject).toBe("Akun Dinas Pendidikan AyoTKA - Dinas Pendidikan Kota Malang sudah dibuat");
    expect(e.text).toContain("https://ayotka.id/admin/dinas-pendidikan");
    expect(e.html).toContain("https://ayotka.id/admin/dinas-pendidikan");
    expect(e.text).not.toContain("/admin/admin-sekolah");
  });

  it("nilai dari pengguna di-escape di HTML (nama, sekolah, email, password) dan tidak bisa menyisipkan tag", () => {
    const e = buatEmailAkunBaru({
      ...DASAR,
      nama: '<img src=x onerror="alert(1)">',
      konteks: "SD <b>Hebat</b> & Co",
      passwordSementara: 'a&b<c>"d\'',
    });
    expect(e.html).not.toContain("<img");
    expect(e.html).not.toContain("<b>Hebat");
    expect(e.html).toContain("&lt;img");
    expect(e.html).toContain("SD &lt;b&gt;Hebat&lt;/b&gt; &amp; Co");
    expect(e.html).toContain("a&amp;b&lt;c&gt;&quot;d&#39;");
    // versi teks apa adanya (bukan HTML): password tetap persis sama supaya bisa disalin
    expect(e.text).toContain('a&b<c>"d\'');
  });

  it("subjek tidak bisa disisipi baris baru (injeksi header) dan panjangnya dibatasi", () => {
    const e = buatEmailAkunBaru({ ...DASAR, konteks: "SD Uji\r\nBcc: korban@example.com\n" + "x".repeat(500) });
    expect(e.subject).not.toMatch(/[\r\n]/);
    expect(e.subject.length).toBeLessThan(220);
  });

  it("nama kosong: sapaan netral, tanpa 'undefined' atau tanda kosong", () => {
    const e = buatEmailAkunBaru({ ...DASAR, nama: "   " });
    expect(e.text).toContain("Halo Bapak/Ibu,");
    expect(e.html).toContain("Halo Bapak/Ibu,");
    expect(e.text + e.html).not.toMatch(/undefined|null/);
  });

  it("konteks kosong: subjek dan kalimat tetap wajar", () => {
    const e = buatEmailAkunBaru({ ...DASAR, konteks: "" });
    expect(e.subject).toBe("Akun Admin Sekolah AyoTKA sudah dibuat");
    expect(e.text).toContain("Akun Admin Sekolah AyoTKA sudah dibuat.");
  });
});

describe("kirimEmailAkunBaru: urutan jalur kirim", () => {
  let log: ReturnType<typeof vi.spyOn>;
  let peringatan: ReturnType<typeof vi.spyOn>;
  let galat: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    m.kirimEmail.mockReset();
    m.kirimLewatSmtp.mockReset();
    log = vi.spyOn(console, "log").mockImplementation(() => {});
    peringatan = vi.spyOn(console, "warn").mockImplementation(() => {});
    galat = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("Resend berhasil: selesai di situ, SMTP tidak disentuh; yang dikirim ke Resend = isi email yang benar", async () => {
    m.kirimEmail.mockResolvedValue({ ok: true, lewat: "resend" });
    const hasil = await kirimEmailAkunBaru(DASAR);
    expect(hasil).toEqual({ tujuan: "budi@sekolah.sch.id", terkirim: true, lewat: "resend" });
    expect(m.kirimLewatSmtp).not.toHaveBeenCalled();
    const kirim = m.kirimEmail.mock.calls[0]![0] as { to: string; subject: string; html: string };
    expect(kirim.to).toBe("budi@sekolah.sch.id");
    expect(kirim.subject).toBe(buatEmailAkunBaru(DASAR).subject);
    expect(kirim.html).toContain("Sementara#42x");
  });

  it("Resend gagal tetapi Mailketing berhasil (di dalam kirimEmail): dilaporkan lewat Mailketing", async () => {
    m.kirimEmail.mockResolvedValue({ ok: true, lewat: "mailketing" });
    expect((await kirimEmailAkunBaru(DASAR)).lewat).toBe("mailketing");
    expect(m.kirimLewatSmtp).not.toHaveBeenCalled();
  });

  it("Resend dan Mailketing gagal, Gmail/SMTP berhasil: terkirim lewat smtp, dengan teks dan HTML", async () => {
    m.kirimEmail.mockResolvedValue({ ok: false, error: "x", kuotaHabis: true, kode: "resend-429-kuota + mailketing-nonaktif" });
    m.kirimLewatSmtp.mockResolvedValue({ ok: true });
    const hasil = await kirimEmailAkunBaru(DASAR);
    expect(hasil).toEqual({ tujuan: "budi@sekolah.sch.id", terkirim: true, lewat: "smtp" });
    const smtp = m.kirimLewatSmtp.mock.calls[0]![0] as { to: string; text: string; html: string };
    expect(smtp.to).toBe("budi@sekolah.sch.id");
    expect(smtp.text).toContain("Sementara#42x");
    expect(smtp.html).toContain("Sementara#42x");
  });

  it("semua gagal, SMTP belum diatur: tidak terkirim, alasan jujur (kuota habis + cadangan belum diatur), tanpa melempar", async () => {
    m.kirimEmail.mockResolvedValue({ ok: false, error: "x", kuotaHabis: true, kode: "resend-429-kuota + mailketing-nonaktif" });
    m.kirimLewatSmtp.mockResolvedValue({ ok: false, kode: "belum_diatur", error: "SMTP belum diatur." });
    const hasil = await kirimEmailAkunBaru(DASAR);
    expect(hasil.terkirim).toBe(false);
    expect(hasil.alasan).toContain("Kuota email Resend sedang habis");
    expect(hasil.alasan).toContain("cadangan Gmail/SMTP belum diatur");
  });

  it("semua gagal bukan karena kuota, SMTP juga gagal: alasan memuat kode dan penjelasan SMTP", async () => {
    m.kirimEmail.mockResolvedValue({ ok: false, error: "x", kuotaHabis: false, kode: "resend-401 + mailketing-nonaktif" });
    m.kirimLewatSmtp.mockResolvedValue({ ok: false, kode: "login_ditolak", error: "Login SMTP ditolak. Untuk Gmail: pakai App Password." });
    const hasil = await kirimEmailAkunBaru(DASAR);
    expect(hasil.terkirim).toBe(false);
    expect(hasil.alasan).toContain("Resend/Mailketing gagal (resend-401 + mailketing-nonaktif)");
    expect(hasil.alasan).toContain("Gmail/SMTP juga gagal: Login SMTP ditolak");
    expect(hasil.alasan).not.toContain(".."); // tanpa titik ganda
    expect(hasil.alasan!.endsWith(".")).toBe(true);
  });

  it("galat tak terduga di mana pun tidak dilempar keluar (pembuatan akun tidak boleh gagal karena email)", async () => {
    m.kirimEmail.mockRejectedValue(new Error("jaringan putus"));
    const hasil = await kirimEmailAkunBaru(DASAR);
    expect(hasil.terkirim).toBe(false);
    expect(hasil.alasan).toContain("gangguan tak terduga");
  });

  it("password sementara TIDAK pernah muncul di log (log, warn, maupun error), dalam semua jalur", async () => {
    const skenario: Array<() => void> = [
      () => m.kirimEmail.mockResolvedValue({ ok: true, lewat: "resend" }),
      () => {
        m.kirimEmail.mockResolvedValue({ ok: false, error: "x", kuotaHabis: false, kode: "resend-500" });
        m.kirimLewatSmtp.mockResolvedValue({ ok: true });
      },
      () => {
        m.kirimEmail.mockResolvedValue({ ok: false, error: "x", kuotaHabis: false, kode: "resend-500" });
        m.kirimLewatSmtp.mockResolvedValue({ ok: false, kode: "gagal", error: "boom" });
      },
      () => m.kirimEmail.mockRejectedValue(new Error("boom")),
    ];
    for (const atur of skenario) {
      atur();
      await kirimEmailAkunBaru(DASAR);
    }
    const semuaLog = JSON.stringify([...log.mock.calls, ...peringatan.mock.calls, ...galat.mock.calls]);
    expect(semuaLog).not.toContain("Sementara#42x");
    expect(semuaLog).toContain("budi@sekolah.sch.id"); // alamat tujuan boleh dicatat (membantu menelusuri)
  });
});
