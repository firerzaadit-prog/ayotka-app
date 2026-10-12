import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { emailPembayaranSiswa, emailUntukCheckout, studentIdDariEmailPembayaran } from "@/lib/billing/email-pembayaran";
import { adalahEmailPembayaran } from "@/lib/billing/pembayaran-affiliate";

const ENV = { APP_ENCRYPTION_KEY: "kunci-enkripsi-server-uji-1234567890" };
const ENV_LAIN = { APP_ENCRYPTION_KEY: "kunci-server-lain-sama-sekali-0987654321" };
const ID = "71b222eb-472c-4b11-9bc2-170adc610384";

describe("emailPembayaranSiswa / studentIdDariEmailPembayaran", () => {
  it("bolak-balik untuk banyak ID acak: alamat yang dibuat selalu kembali ke ID yang sama", () => {
    for (let i = 0; i < 200; i++) {
      const id = randomUUID();
      const alamat = emailPembayaranSiswa(id, ENV)!;
      expect(studentIdDariEmailPembayaran(alamat, ENV), alamat).toBe(id);
    }
  });

  it("bentuk alamat: s + 32 heksadesimal + @bayar.ayotka.id; dikenali pemeriksa bentuk klien", () => {
    const alamat = emailPembayaranSiswa(ID, ENV)!;
    expect(alamat).toMatch(/^s[0-9a-f]{32}@bayar\.ayotka\.id$/);
    expect(adalahEmailPembayaran(alamat)).toBe(true);
  });

  it("tidak memuat ID siswa (dengan atau tanpa tanda hubung) dan tidak bisa ditebak dari ID", () => {
    const alamat = emailPembayaranSiswa(ID, ENV)!;
    expect(alamat).not.toContain(ID);
    expect(alamat).not.toContain(ID.replace(/-/g, ""));
    // blok terenkripsi tidak sama dengan ID mentah di posisi mana pun
    expect(alamat.slice(1, 33)).not.toBe(ID.replace(/-/g, ""));
  });

  it("deterministik; ID berbeda memberi alamat berbeda; kunci server berbeda memberi alamat berbeda", () => {
    expect(emailPembayaranSiswa(ID, ENV)).toBe(emailPembayaranSiswa(ID, ENV));
    expect(emailPembayaranSiswa(randomUUID(), ENV)).not.toBe(emailPembayaranSiswa(ID, ENV));
    expect(emailPembayaranSiswa(ID, ENV_LAIN)).not.toBe(emailPembayaranSiswa(ID, ENV));
  });

  it("alamat dari server lain TIDAK kembali ke ID aslinya (tidak bisa dipalsukan tanpa kunci)", () => {
    const alamat = emailPembayaranSiswa(ID, ENV_LAIN)!;
    expect(studentIdDariEmailPembayaran(alamat, ENV)).not.toBe(ID);
  });

  it("huruf besar dan spasi di sekitar alamat dimaklumi (affiliate.id bisa mengubah huruf)", () => {
    const alamat = emailPembayaranSiswa(ID, ENV)!;
    expect(studentIdDariEmailPembayaran(alamat.toUpperCase(), ENV)).toBe(ID);
    expect(studentIdDariEmailPembayaran(`  ${alamat}\n`, ENV)).toBe(ID);
    expect(adalahEmailPembayaran(alamat.toUpperCase())).toBe(true);
  });

  it("bukan alamat pembayaran: null (email biasa, email NISN, domain lain, panjang atau isi salah, kosong)", () => {
    const sah = emailPembayaranSiswa(ID, ENV)!;
    const salah = [
      "budi@example.com",
      "3155213156@nisn.ayotka.id",
      sah.replace("bayar.ayotka.id", "example.com"),
      sah.replace("@bayar", "x@bayar"),
      sah.replace(/^s/, ""),
      `${sah.slice(0, 20)}${sah.slice(21)}`,
      sah.replace(/[0-9a-f]/, "z"),
      `x${sah}`,
      "",
      "   ",
    ];
    for (const email of salah) {
      expect(studentIdDariEmailPembayaran(email, ENV), email).toBeNull();
      expect(adalahEmailPembayaran(email), email).toBe(false);
    }
    expect(studentIdDariEmailPembayaran(null, ENV)).toBeNull();
    expect(studentIdDariEmailPembayaran(undefined, ENV)).toBeNull();
  });

  it("tanpa kunci server: tidak bisa membuat maupun membaca alamat (gagal tertutup)", () => {
    expect(emailPembayaranSiswa(ID, {})).toBeNull();
    expect(studentIdDariEmailPembayaran(emailPembayaranSiswa(ID, ENV), {})).toBeNull();
  });

  it("ID yang bukan UUID: null", () => {
    for (const id of ["", "siswa-1", "71b222eb472c4b119bc2170adc610384", `${ID}0`, "zzzzzzzz-472c-4b11-9bc2-170adc610384"]) {
      expect(emailPembayaranSiswa(id, ENV), id).toBeNull();
    }
  });

  it("kunci cadangan (SUPABASE_SERVICE_ROLE_KEY) dipakai bila APP_ENCRYPTION_KEY kosong, sama seperti rahasia webhook", () => {
    const cadangan = { APP_ENCRYPTION_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "kunci-cadangan-uji-1234567890" };
    const alamat = emailPembayaranSiswa(ID, cadangan)!;
    expect(alamat).toMatch(/@bayar\.ayotka\.id$/);
    expect(studentIdDariEmailPembayaran(alamat, cadangan)).toBe(ID);
  });
});

describe("emailUntukCheckout", () => {
  it("email sungguhan dibawa apa adanya", () => {
    expect(emailUntukCheckout("budi@example.com", ID, ENV)).toBe("budi@example.com");
    expect(emailUntukCheckout("budi@nisn.ayotka.id.contoh.com", ID, ENV)).toBe("budi@nisn.ayotka.id.contoh.com");
  });

  it("akun NISN (email sintetis, huruf besar atau kecil) memakai alamat pembayaran khusus", () => {
    const alamat = emailPembayaranSiswa(ID, ENV)!;
    expect(emailUntukCheckout("3155213156@nisn.ayotka.id", ID, ENV)).toBe(alamat);
    expect(emailUntukCheckout("3155213156@NISN.AYOTKA.ID", ID, ENV)).toBe(alamat);
  });

  it("akun NISN tanpa kunci server atau ID tak valid: email sintetis dikembalikan (pembangun tautan yang membuangnya)", () => {
    expect(emailUntukCheckout("3155213156@nisn.ayotka.id", ID, {})).toBe("3155213156@nisn.ayotka.id");
    expect(emailUntukCheckout("3155213156@nisn.ayotka.id", "bukan-uuid", ENV)).toBe("3155213156@nisn.ayotka.id");
  });
});
