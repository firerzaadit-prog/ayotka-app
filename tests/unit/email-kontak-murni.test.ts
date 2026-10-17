import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MASA_BERLAKU_TOKEN_MS,
  buatTokenEmailKontak,
  emailKontakTerverifikasi,
  labelNisnTersamar,
  periksaTokenEmailKontak,
  ringkasEmailKontak,
  samarkanEmail,
} from "@/lib/siswa/email-kontak";
import { adalahDomainTanpaKotakSurat, emailKontakSchema, verifikasiEmailKontakSchema } from "@/lib/validations/email-kontak";
import { buatEmailEmailKontakBerubah, buatEmailStrukPembayaran, buatEmailVerifikasiEmailKontak } from "@/lib/email/profil";

const ID = "3f9c2a64-1b7e-4c58-9d0a-5e2b8f7a1c34";
const ENV = { APP_ENCRYPTION_KEY: "kunci-uji-aplikasi" };
const SEKARANG = new Date("2026-10-16T03:00:00.000Z");

describe("token verifikasi email kontak", () => {
  it("dibuat lalu diperiksa: memuat siswa dan alamat (huruf kecil, dipangkas)", () => {
    const token = buatTokenEmailKontak({ studentId: ID, email: "  Orang.Tua@Contoh.ID ", sekarang: SEKARANG }, ENV)!;
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(periksaTokenEmailKontak(token, SEKARANG, ENV)).toEqual({ ok: true, studentId: ID, email: "orang.tua@contoh.id" });
  });

  it("berlaku tepat 48 jam: sebelum batas sah, sesudahnya kedaluwarsa", () => {
    const token = buatTokenEmailKontak({ studentId: ID, email: "a@b.id", sekarang: SEKARANG }, ENV)!;
    const batas = SEKARANG.getTime() + MASA_BERLAKU_TOKEN_MS;
    expect(periksaTokenEmailKontak(token, new Date(batas - 1000), ENV).ok).toBe(true);
    expect(periksaTokenEmailKontak(token, new Date(batas), ENV).ok).toBe(true);
    expect(periksaTokenEmailKontak(token, new Date(batas + 2000), ENV)).toEqual({ ok: false, alasan: "kedaluwarsa" });
    expect(MASA_BERLAKU_TOKEN_MS).toBe(48 * 3_600_000);
  });

  it("kunci server berbeda: tidak sah (tautan lama mati bila kunci diganti)", () => {
    const token = buatTokenEmailKontak({ studentId: ID, email: "a@b.id", sekarang: SEKARANG }, ENV)!;
    expect(periksaTokenEmailKontak(token, SEKARANG, { APP_ENCRYPTION_KEY: "kunci-lain" })).toEqual({ ok: false, alasan: "tidak_sah" });
  });

  it("memakai SUPABASE_SERVICE_ROLE_KEY bila APP_ENCRYPTION_KEY tidak ada, dan menolak bila keduanya kosong", () => {
    const env = { SUPABASE_SERVICE_ROLE_KEY: "kunci-layanan" };
    const token = buatTokenEmailKontak({ studentId: ID, email: "a@b.id", sekarang: SEKARANG }, env)!;
    expect(periksaTokenEmailKontak(token, SEKARANG, env).ok).toBe(true);
    expect(buatTokenEmailKontak({ studentId: ID, email: "a@b.id" }, {})).toBeNull();
    expect(periksaTokenEmailKontak(token, SEKARANG, {})).toEqual({ ok: false, alasan: "tanpa_kunci" });
  });

  it("ID siswa bukan UUID: token tidak dibuat", () => {
    expect(buatTokenEmailKontak({ studentId: "bukan-uuid", email: "a@b.id" }, ENV)).toBeNull();
  });

  it("muatan diubah (alamat atau siswa lain) dengan tanda tangan lama: tidak sah", () => {
    const token = buatTokenEmailKontak({ studentId: ID, email: "a@b.id", sekarang: SEKARANG }, ENV)!;
    const [muatan, tanda] = token.split(".") as [string, string];
    const isi = JSON.parse(Buffer.from(muatan, "base64url").toString("utf8")) as Record<string, unknown>;
    const palsu = (o: Record<string, unknown>) => `${Buffer.from(JSON.stringify(o)).toString("base64url")}.${tanda}`;
    expect(periksaTokenEmailKontak(palsu({ ...isi, e: "penyerang@jahat.id" }), SEKARANG, ENV).ok).toBe(false);
    expect(periksaTokenEmailKontak(palsu({ ...isi, s: "00000000-0000-4000-8000-000000000000" }), SEKARANG, ENV).ok).toBe(false);
    expect(periksaTokenEmailKontak(palsu({ ...isi, x: 9_999_999_999 }), SEKARANG, ENV).ok).toBe(false);
  });

  it.each([
    ["kosong", ""],
    ["tanpa titik", "abcdefghij"],
    ["tiga bagian", "a.b.c"],
    ["bagian kosong", "abc."],
    ["tanda tangan acak", "eyJzIjoiYSJ9.AAAA"],
    ["bukan base64url", "!!!.???"],
  ])("token rusak (%s): tidak sah", (_nama, token) => {
    expect(periksaTokenEmailKontak(token, SEKARANG, ENV)).toEqual({ ok: false, alasan: "tidak_sah" });
  });

  it("muatan bertanda tangan benar tetapi bentuknya salah (bukan objek yang diharapkan): tidak sah", async () => {
    const { createHmac } = await import("node:crypto");
    const kunci = createHmac("sha256", ENV.APP_ENCRYPTION_KEY).update("ayotka:email-kontak:v1").digest();
    const tandai = (obj: unknown) => {
      const muatan = Buffer.from(JSON.stringify(obj)).toString("base64url");
      return `${muatan}.${createHmac("sha256", kunci).update(muatan).digest().toString("base64url")}`;
    };
    expect(periksaTokenEmailKontak(tandai({ s: "bukan-uuid", e: "a@b.id", x: 9_999_999_999 }), SEKARANG, ENV).ok).toBe(false);
    expect(periksaTokenEmailKontak(tandai({ s: ID, e: "", x: 9_999_999_999 }), SEKARANG, ENV).ok).toBe(false);
    expect(periksaTokenEmailKontak(tandai({ s: ID, e: "a@b.id", x: "besok" }), SEKARANG, ENV).ok).toBe(false);
    expect(periksaTokenEmailKontak(tandai(null), SEKARANG, ENV).ok).toBe(false);
    expect(periksaTokenEmailKontak(tandai({ s: ID, e: "a@b.id", x: 9_999_999_999 }), SEKARANG, ENV).ok).toBe(true);
  });
});

describe("ringkasan dan label", () => {
  it("ringkasEmailKontak: null bila tidak ada; belum terverifikasi tetap ditampilkan dengan penanda", () => {
    expect(ringkasEmailKontak({ emailKontak: null, emailKontakVerifiedAt: null })).toBeNull();
    expect(ringkasEmailKontak({ emailKontak: "a@b.id", emailKontakVerifiedAt: null })).toEqual({ alamat: "a@b.id", terverifikasi: false });
    expect(ringkasEmailKontak({ emailKontak: "a@b.id", emailKontakVerifiedAt: SEKARANG })).toEqual({ alamat: "a@b.id", terverifikasi: true });
  });

  it("emailKontakTerverifikasi: hanya alamat yang sudah diverifikasi yang boleh dipakai mengirim hal sensitif", () => {
    expect(emailKontakTerverifikasi({ emailKontak: "a@b.id", emailKontakVerifiedAt: SEKARANG })).toBe("a@b.id");
    expect(emailKontakTerverifikasi({ emailKontak: "a@b.id", emailKontakVerifiedAt: null })).toBeNull();
    expect(emailKontakTerverifikasi({ emailKontak: null, emailKontakVerifiedAt: SEKARANG })).toBeNull();
  });

  it("labelNisnTersamar: empat digit terakhir saja", () => {
    expect(labelNisnTersamar("3155213156")).toBe("NISN ******3156");
    expect(labelNisnTersamar("1234")).toBe("NISN 1234");
    expect(labelNisnTersamar("12")).toBe("akun NISN");
    expect(labelNisnTersamar(null)).toBe("akun NISN");
    expect(labelNisnTersamar("")).toBe("akun NISN");
  });

  it("samarkanEmail", () => {
    expect(samarkanEmail("budi@contoh.id")).toBe("b***@contoh.id");
    expect(samarkanEmail("tanpa-at")).toBe("***");
  });
});

describe("skema email kontak", () => {
  it("simpan: alamat dirapikan (huruf kecil, dipangkas) dan password wajib", () => {
    const r = emailKontakSchema.safeParse({ aksi: "simpan", email: "  Orang.Tua@Contoh.ID ", password: "x" });
    expect(r.success && r.data).toMatchObject({ aksi: "simpan", email: "orang.tua@contoh.id" });
    expect(emailKontakSchema.safeParse({ aksi: "simpan", email: "a@b.id" }).success).toBe(false);
    expect(emailKontakSchema.safeParse({ aksi: "simpan", email: "a@b.id", password: "" }).success).toBe(false);
  });

  it.each(["", "bukan-email", "a@", "@b.id", "a b@c.id", `${"x".repeat(250)}@b.id`])("simpan: alamat tidak sah '%s' ditolak", (email) => {
    expect(emailKontakSchema.safeParse({ aksi: "simpan", email, password: "x" }).success).toBe(false);
  });

  it.each(["3155213156@nisn.ayotka.id", "3155213156@NISN.AYOTKA.ID", "s0123abcd@bayar.ayotka.id", " x@bayar.ayotka.id "])(
    "simpan: alamat internal AyoTKA tanpa kotak surat '%s' ditolak",
    (email) => {
      const r = emailKontakSchema.safeParse({ aksi: "simpan", email, password: "x" });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.message).toContain("bukan alamat internal AyoTKA");
    },
  );

  it("domain mirip tetapi bukan domain internal tetap boleh", () => {
    expect(emailKontakSchema.safeParse({ aksi: "simpan", email: "a@nisn.ayotka.id.contoh.com", password: "x" }).success).toBe(true);
    expect(emailKontakSchema.safeParse({ aksi: "simpan", email: "a@ayotka.id", password: "x" }).success).toBe(true);
    expect(adalahDomainTanpaKotakSurat("a@gmail.com")).toBe(false);
    expect(adalahDomainTanpaKotakSurat("a@nisn.ayotka.id")).toBe(true);
    expect(adalahDomainTanpaKotakSurat("a@bayar.ayotka.id")).toBe(true);
  });

  it("kirim_ulang tanpa password; hapus wajib password; aksi lain ditolak", () => {
    expect(emailKontakSchema.safeParse({ aksi: "kirim_ulang" }).success).toBe(true);
    expect(emailKontakSchema.safeParse({ aksi: "hapus" }).success).toBe(false);
    expect(emailKontakSchema.safeParse({ aksi: "hapus", password: "x" }).success).toBe(true);
    expect(emailKontakSchema.safeParse({ aksi: "ganti", email: "a@b.id", password: "x" }).success).toBe(false);
    expect(emailKontakSchema.safeParse({}).success).toBe(false);
    expect(emailKontakSchema.safeParse(null).success).toBe(false);
  });

  it("verifikasiEmailKontakSchema: token 20-700 karakter", () => {
    expect(verifikasiEmailKontakSchema.safeParse({ token: "a".repeat(40) }).success).toBe(true);
    expect(verifikasiEmailKontakSchema.safeParse({ token: "pendek" }).success).toBe(false);
    expect(verifikasiEmailKontakSchema.safeParse({ token: "a".repeat(701) }).success).toBe(false);
    expect(verifikasiEmailKontakSchema.safeParse({}).success).toBe(false);
  });
});

describe("isi email", () => {
  it("verifikasi: memuat tautan, label akun tersamar, masa berlaku; nilai pengguna di-escape", () => {
    const e = buatEmailVerifikasiEmailKontak({
      nama: "<b>Budi</b>",
      email: "ortu@contoh.id",
      labelAkun: "NISN ******3156",
      tautan: "https://ayotka.id/verifikasi-email-kontak?token=abc.def&x=1",
      berlakuJam: 48,
    });
    expect(e.subject).toBe("Verifikasi email kontak akun AyoTKA kamu");
    expect(e.html).toContain("ortu@contoh.id");
    expect(e.html).toContain("NISN ******3156");
    expect(e.html).toContain("48 jam");
    expect(e.html).toContain('href="https://ayotka.id/verifikasi-email-kontak?token=abc.def&amp;x=1"');
    expect(e.html).not.toContain("<b>Budi</b>");
    expect(e.html).toContain("&lt;b&gt;Budi&lt;/b&gt;");
  });

  it("perubahan ke alamat lama: diganti dan dilepas punya subjek serta kalimat berbeda", () => {
    const dasar = { nama: "Budi", emailLama: "lama@contoh.id", labelAkun: "NISN ******3156", waktu: SEKARANG, asal: "https://ayotka.id" };
    const diganti = buatEmailEmailKontakBerubah({ ...dasar, emailBaru: "baru@contoh.id" });
    expect(diganti.subject).toBe("Email kontak akun AyoTKA kamu diganti");
    expect(diganti.html).toContain("lama@contoh.id");
    expect(diganti.html).toContain("baru@contoh.id");
    expect(diganti.html).toContain("Bukan kamu yang melakukannya?");
    const dilepas = buatEmailEmailKontakBerubah({ ...dasar, emailBaru: null });
    expect(dilepas.subject).toBe("Email kontak akun AyoTKA kamu dilepas");
    expect(dilepas.html).toContain("dilepas");
    expect(dilepas.html).not.toContain("baru@contoh.id");
  });

  it("struk top up: jumlah, akun tersamar, tautan riwayat; semua nilai di-escape", () => {
    const e = buatEmailStrukPembayaran({
      nama: "Budi <i>X</i>",
      labelAkun: "NISN ******3156",
      ringkasan: { jenis: "topup", nominal: 25_000 },
      waktu: SEKARANG,
      asal: "https://ayotka.id",
    });
    expect(e.subject).toBe("Bukti pembayaran AyoTKA: Top up saldo");
    expect(e.html).toContain("Rp25.000");
    expect(e.html).toContain("NISN ******3156");
    expect(e.html).toContain('href="https://ayotka.id/siswa/pembayaran"');
    expect(e.html).toContain("saldo sudah ditambahkan");
    expect(e.html).not.toContain("<i>X</i>");
  });

  it("struk langganan: nama paket, harga, tanggal berlaku (WIB); nama paket berisi tag atau baris baru tidak merusak subjek/isi", () => {
    const e = buatEmailStrukPembayaran({
      nama: "Budi",
      labelAkun: "NISN ******3156",
      ringkasan: { jenis: "langganan", namaPaket: 'Semester\r\nBcc: x@y.z <script>', harga: 150_000, berlakuSampai: new Date("2027-04-14T17:30:00.000Z") },
      waktu: SEKARANG,
      asal: "https://ayotka.id",
    });
    expect(e.subject).not.toMatch(/[\r\n]/);
    expect(e.subject).toContain("Paket Semester");
    expect(e.html).toContain("Rp150.000");
    expect(e.html).toContain("15 April 2027"); // 14 Apr 2027 17.30 UTC = 15 Apr 2027 00.30 WIB
    expect(e.html).toContain("paket sudah aktif");
    expect(e.html).not.toContain("<script>");
  });
});
