import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ createTransport: vi.fn(), sendMail: vi.fn(), resolved: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: m.createTransport } }));
vi.mock("@/lib/settings/app-settings", () => ({ getResolvedSmtpConfig: m.resolved }));

import { bentukPengirim, jelaskanGalatSmtp, kirimLewatSmtp, sendMail } from "@/lib/email/mailer";

const GMAIL = { host: "smtp.gmail.com", port: 465, user: "tim.ayotka@gmail.com", pass: "abcdabcdabcdabcd" };
const surat = { to: "budi@sekolah.sch.id", subject: "Tes", text: "isi", html: "<p>isi</p>" };

beforeEach(() => {
  m.createTransport.mockReset();
  m.sendMail.mockReset();
  m.resolved.mockReset();
  m.createTransport.mockReturnValue({ sendMail: m.sendMail });
  m.sendMail.mockResolvedValue({ messageId: "x" });
  m.resolved.mockResolvedValue({ ...GMAIL, source: "database" });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("jelaskanGalatSmtp", () => {
  it("login ditolak (EAUTH atau 535/534): petunjuk App Password Gmail", () => {
    for (const e of [{ code: "EAUTH" }, { responseCode: 535, message: "Invalid login" }, { responseCode: 534 }]) {
      const h = jelaskanGalatSmtp(e);
      expect(h.kode).toBe("login_ditolak");
      expect(h.error).toContain("App Password");
    }
  });

  it("tidak bisa terhubung: kode jaringan umum dan salah mode TLS (port tertukar)", () => {
    for (const e of [
      { code: "ECONNECTION" },
      { code: "ETIMEDOUT" },
      { code: "ESOCKET" },
      { code: "ECONNREFUSED" },
      { code: "ENOTFOUND" },
      { code: "EDNS" },
      { message: "error:0A00010B:SSL routines:ssl3_get_record:wrong version number" },
    ]) {
      const h = jelaskanGalatSmtp(e);
      expect(h.kode, JSON.stringify(e)).toBe("tidak_terhubung");
      expect(h.error).toContain("smtp.gmail.com");
    }
  });

  it("penerima ditolak: EENVELOPE atau 550/551/553/501", () => {
    for (const e of [{ code: "EENVELOPE" }, { responseCode: 550 }, { responseCode: 551 }, { responseCode: 553 }, { responseCode: 501 }]) {
      expect(jelaskanGalatSmtp(e).kode).toBe("penerima_ditolak");
    }
  });

  it("galat lain: pesan dirapatkan dan dipotong 200 karakter; bukan Error / kosong tetap menghasilkan kalimat", () => {
    const panjang = jelaskanGalatSmtp({ message: "baris1\n\nbaris2   " + "x".repeat(500) });
    expect(panjang.kode).toBe("gagal");
    expect(panjang.error.startsWith("Email gagal dikirim: baris1 baris2")).toBe(true);
    expect(panjang.error.length).toBeLessThanOrEqual("Email gagal dikirim: ".length + 200);
    expect(jelaskanGalatSmtp(null)).toEqual({ kode: "gagal", error: "Email gagal dikirim (sebab tidak diketahui)." });
    expect(jelaskanGalatSmtp("string biasa").kode).toBe("gagal");
  });
});

describe("bentukPengirim", () => {
  it("username berupa alamat email: dipakai sebagai alamat dengan nama AyoTKA; selain itu apa adanya", () => {
    expect(bentukPengirim("tim.ayotka@gmail.com")).toEqual({ name: "AyoTKA", address: "tim.ayotka@gmail.com" });
    expect(bentukPengirim("apikey")).toBe("apikey");
    expect(bentukPengirim("dua kata@x.id")).toBe("dua kata@x.id");
  });
});

describe("kirimLewatSmtp", () => {
  it("SMTP belum diisi (salah satu kosong): belum_diatur dengan petunjuk, tanpa membuat koneksi", async () => {
    for (const kosong of [{ host: "" }, { user: "" }, { pass: "" }]) {
      m.resolved.mockResolvedValue({ ...GMAIL, ...kosong, source: "none" });
      const h = await kirimLewatSmtp(surat);
      expect(h).toMatchObject({ ok: false, kode: "belum_diatur" });
      expect((h as { error: string }).error).toContain("Pengaturan > Layanan Email");
    }
    expect(m.createTransport).not.toHaveBeenCalled();
  });

  it("Gmail port 465: SSL langsung, batas waktu terpasang, pengirim bernama AyoTKA, teks + HTML terkirim", async () => {
    const h = await kirimLewatSmtp(surat);
    expect(h).toEqual({ ok: true });
    const opsi = m.createTransport.mock.calls[0]![0];
    expect(opsi).toMatchObject({ host: "smtp.gmail.com", port: 465, secure: true, requireTLS: false, auth: { user: GMAIL.user, pass: GMAIL.pass } });
    expect(opsi.connectionTimeout).toBeLessThanOrEqual(10_000);
    expect(opsi.greetingTimeout).toBeLessThanOrEqual(10_000);
    expect(opsi.socketTimeout).toBeLessThanOrEqual(20_000);
    expect(m.sendMail).toHaveBeenCalledWith({
      from: { name: "AyoTKA", address: GMAIL.user },
      to: surat.to,
      subject: "Tes",
      text: "isi",
      html: "<p>isi</p>",
    });
  });

  it("port 587: STARTTLS WAJIB (tidak turun ke teks polos); port lain (mis. 2525): tanpa paksaan", async () => {
    await kirimLewatSmtp(surat, { ...GMAIL, port: 587 });
    expect(m.createTransport.mock.calls[0]![0]).toMatchObject({ secure: false, requireTLS: true });
    await kirimLewatSmtp(surat, { ...GMAIL, port: 2525 });
    expect(m.createTransport.mock.calls[1]![0]).toMatchObject({ secure: false, requireTLS: false });
  });

  it("konfigurasi eksplisit (uji koneksi dari layar) dipakai tanpa membaca pengaturan tersimpan", async () => {
    await kirimLewatSmtp(surat, { host: "smtp.contoh.id", port: 465, user: "a@contoh.id", pass: "rahasia" });
    expect(m.resolved).not.toHaveBeenCalled();
    expect(m.createTransport.mock.calls[0]![0]).toMatchObject({ host: "smtp.contoh.id", auth: { user: "a@contoh.id", pass: "rahasia" } });
  });

  it("subjek dibersihkan dari baris baru; tanpa HTML = field html tidak dikirim", async () => {
    await kirimLewatSmtp({ to: surat.to, subject: "Baris1\r\nBcc: x@y.id", text: "isi" });
    const dikirim = m.sendMail.mock.calls[0]![0];
    expect(dikirim.subject).toBe("Baris1 Bcc: x@y.id");
    expect("html" in dikirim).toBe(false);
  });

  it("gagal kirim: dikembalikan sebagai hasil (tidak melempar), kata sandi tidak ikut ke log atau hasil", async () => {
    m.sendMail.mockRejectedValue(Object.assign(new Error("Invalid login: 535-5.7.8 Username and Password not accepted"), { code: "EAUTH", responseCode: 535 }));
    const h = await kirimLewatSmtp(surat);
    expect(h).toMatchObject({ ok: false, kode: "login_ditolak" });
    expect(JSON.stringify(h)).not.toContain(GMAIL.pass);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(GMAIL.pass);
  });

  it("gangguan jaringan saat membuat koneksi (createTransport/sendMail melempar): tetap hasil galat", async () => {
    m.createTransport.mockImplementation(() => {
      throw new Error("konfigurasi aneh");
    });
    expect(await kirimLewatSmtp(surat)).toMatchObject({ ok: false, kode: "gagal" });
  });
});

describe("sendMail (bentuk lama: ya/tidak)", () => {
  it("true bila terkirim, false bila gagal atau SMTP belum diatur (dengan peringatan)", async () => {
    expect(await sendMail(surat)).toBe(true);
    m.sendMail.mockRejectedValue(new Error("boom"));
    expect(await sendMail(surat)).toBe(false);
    m.resolved.mockResolvedValue({ host: "", port: 587, user: "", pass: "", source: "none" });
    expect(await sendMail(surat)).toBe(false);
    expect(vi.mocked(console.warn)).toHaveBeenCalledWith(expect.stringContaining("EMAIL_SMTP_* belum diisi"));
  });
});
