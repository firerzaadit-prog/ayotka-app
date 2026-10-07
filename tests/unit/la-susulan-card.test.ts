import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LaSusulanCard } from "@/components/ai/la-susulan-card";
import { jalurKembaliHasil } from "@/lib/utils/kembali-hasil";
import type { OpsiLaSusulan } from "@/lib/billing/learning-analytics";

const ID = "0f8d3acf-76bd-4d04-871c-769e0124a500";
type Tersedia = Extract<OpsiLaSusulan, { tersedia: true }>;
const render = (opsi: Tersedia, catatan?: string) =>
  renderToStaticMarkup(createElement(LaSusulanCard, { attemptId: ID, opsi, catatan, onMulai: () => {}, onSegarkan: () => {} }));

describe("LaSusulanCard", () => {
  it("jatah paket tersedia: tombol 'Lakukan Learning Analytics' tanpa harga, menyebut sisa jatah", () => {
    const html = render({ tersedia: true, pendanaan: "kuota", kuotaSisa: 1, batasTercapai: false, batasMaks: 3 });
    expect(html).toContain("Lakukan Learning Analytics");
    expect(html).toContain("sisa 1");
    expect(html).not.toMatch(/Rp\s*\d/);
    expect(html).not.toContain("Isi saldo");
  });

  it("batas tercapai: tanpa tombol aksi, menjelaskan batasnya", () => {
    const html = render({ tersedia: true, pendanaan: "kuota", kuotaSisa: 1, batasTercapai: true, batasMaks: 3 });
    expect(html).toContain("Batas Learning Analytics");
    expect(html).toContain("3 kali");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Isi saldo");
  });

  it("saldo cukup: menyebut harga dan saldo, tombol ada, belum ada konfirmasi pemotongan", () => {
    const html = render({ tersedia: true, pendanaan: "saldo", harga: 9000, saldo: 20000, cukup: true, kurang: 0 });
    expect(html).toMatch(/Rp\s*9\.000/);
    expect(html).toMatch(/Rp\s*20\.000/);
    expect(html).toContain("Lakukan Learning Analytics");
    expect(html).not.toContain("Ya, lakukan");
    expect(html).not.toContain("Isi saldo");
  });

  it("saldo kurang: menyebut kekurangan, tautan Isi saldo membawa jalur kembali ke halaman hasil, tanpa tombol jalankan", () => {
    const html = render({ tersedia: true, pendanaan: "saldo", harga: 9000, saldo: 4000, cukup: false, kurang: 5000 });
    expect(html).toMatch(/kurang\s*<b>Rp\s*5\.000/);
    expect(html).toContain("Isi saldo");
    expect(html).toContain(`/siswa/wallet?kembali=${encodeURIComponent(`/siswa/hasil/${ID}`)}`);
    expect(html).toContain("/siswa/langganan");
    expect(html).not.toContain("<button");
  });

  it("jalur kembali yang dibuat kartu lolos validasi halaman Wallet", () => {
    const html = render({ tersedia: true, pendanaan: "saldo", harga: 9000, saldo: 0, cukup: false, kurang: 9000 });
    const href = html.match(/href="\/siswa\/wallet\?kembali=([^"]+)"/)?.[1];
    expect(href).toBeTruthy();
    expect(jalurKembaliHasil(decodeURIComponent(href!))).toBe(`/siswa/hasil/${ID}`);
  });

  it("menampilkan catatan dari percobaan sebelumnya (mis. analisis gagal, saldo dikembalikan)", () => {
    const html = render(
      { tersedia: true, pendanaan: "saldo", harga: 9000, saldo: 20000, cukup: true, kurang: 0 },
      "Analisis belum berhasil diproses. Saldo sudah dikembalikan.",
    );
    expect(html).toContain("Saldo sudah dikembalikan");
  });

  it("cuplikan buram disembunyikan dari pembaca layar (hanya contoh, bukan hasil AI)", () => {
    const html = render({ tersedia: true, pendanaan: "kuota", kuotaSisa: 1, batasTercapai: false, batasMaks: 3 });
    expect(html).toMatch(/aria-hidden="true"[^>]*>\s*<p[^>]*>Kelebihan/);
  });
});

describe("jalurKembaliHasil", () => {
  it("menerima jalur hasil ujian yang sah (huruf besar atau kecil)", () => {
    expect(jalurKembaliHasil(`/siswa/hasil/${ID}`)).toBe(`/siswa/hasil/${ID}`);
    expect(jalurKembaliHasil(`/siswa/hasil/${ID.toUpperCase()}`)).toBe(`/siswa/hasil/${ID.toUpperCase()}`);
  });

  it.each([
    ["alamat luar", "https://evil.example/siswa/hasil/" + ID],
    ["protokol-relatif", "//evil.example"],
    ["jalur lain", "/admin-pusat/dashboard"],
    ["tambahan di belakang", `/siswa/hasil/${ID}/../../x`],
    ["query di belakang", `/siswa/hasil/${ID}?a=1`],
    ["tambahan di depan", `x/siswa/hasil/${ID}`],
    ["id bukan uuid", "/siswa/hasil/abc"],
    ["id terlalu panjang", `/siswa/hasil/${ID}0`],
    ["kosong", ""],
  ])("menolak %s", (_nama, nilai) => {
    expect(jalurKembaliHasil(nilai)).toBeNull();
  });

  it("menolak null, undefined, dan bukan teks", () => {
    expect(jalurKembaliHasil(null)).toBeNull();
    expect(jalurKembaliHasil(undefined)).toBeNull();
    expect(jalurKembaliHasil(123 as unknown as string)).toBeNull();
  });
});
