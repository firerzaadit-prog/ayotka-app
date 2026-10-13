import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Keputusan user (12 Okt 2026): saldo kredit AyoTKA tidak bisa ditarik tunai. Penegasannya harus tampil di tempat siswa
 * mengisi dan melihat saldo (halaman Wallet) dan tercatat di Syarat & Ketentuan. Tes ini menjaga kalimatnya tidak hilang
 * diam-diam saat halaman diubah.
 */
const baca = (p: string) => readFileSync(p, "utf8").replace(/\s+/g, " ");

describe("saldo tidak dapat ditarik tunai", () => {
  const wallet = baca("app/siswa/(shell)/wallet/page.tsx");
  const syarat = baca("app/(public)/syarat-ketentuan/page.tsx");

  it("halaman Wallet: penegasan di kartu saldo dan di kartu top-up (sebelum siswa membayar)", () => {
    expect(wallet).toContain("<b>tidak dapat ditarik tunai</b>, ditransfer, atau diuangkan kembali");
    expect(wallet).toContain("Saldo hanya untuk membeli Learning Analytics di AyoTKA");
    expect(wallet).toContain("Saldo yang sudah diisi tidak dapat ditarik tunai.");
    // penegasan kartu top-up berada di kartu top-up (setelah judulnya, sebelum tombol nominal)
    const iJudul = wallet.indexOf("Top-up saldo</p>");
    const iPenegasan = wallet.indexOf("Saldo yang sudah diisi tidak dapat ditarik tunai.");
    const iTombol = wallet.indexOf("denominasi");
    expect(iJudul).toBeGreaterThan(-1);
    expect(iPenegasan).toBeGreaterThan(iJudul);
    expect(iPenegasan).toBeLessThan(wallet.indexOf("data.denominasi.map"));
    expect(iTombol).toBeGreaterThan(-1);
  });

  it("Syarat & Ketentuan: butir tersendiri soal saldo (tidak ditarik tunai, tidak ditransfer, pengembalian otomatis bila analisis gagal) dan tanggal pembaruan", () => {
    expect(syarat).toContain("Saldo kredit hanya dipakai untuk membeli Learning Analytics tambahan di AyoTKA.");
    expect(syarat).toContain("Saldo tidak dapat ditarik tunai, ditransfer ke pengguna lain, atau diuangkan kembali.");
    expect(syarat).toContain("Bila sebuah analisis gagal diproses, saldo yang terpotong untuk analisis itu dikembalikan otomatis ke saldo Anda.");
    expect(syarat).toContain('diperbarui="12 Oktober 2026"');
  });

  it("butir pengembalian dana lama tetap ada (kasus per kasus) dan berurutan sesudah butir saldo", () => {
    const iSaldo = syarat.indexOf("Saldo kredit hanya dipakai");
    const iRefund = syarat.indexOf("Pengembalian dana ditangani kasus per kasus.");
    expect(iSaldo).toBeGreaterThan(-1);
    expect(iRefund).toBeGreaterThan(iSaldo);
  });

  it("pengembalian otomatis saldo memang dilakukan kode bila analisis gagal (janji di S&K nyata)", () => {
    const worker = baca("lib/ai/queue-worker.ts");
    expect(worker).toContain("kembalikanSaldoAnalisis");
    const saldo = baca("lib/billing/saldo.ts");
    expect(saldo).toContain("Pengembalian saldo - Learning Analytics");
  });
});
