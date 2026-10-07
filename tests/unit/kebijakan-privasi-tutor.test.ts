import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import KebijakanPrivasiPage from "@/app/(public)/kebijakan-privasi/page";
import { HARI_SIMPAN_RIWAYAT } from "@/lib/tutor/konstanta";

// Kebijakan Privasi harus mencerminkan perilaku sistem yang sebenarnya (aturan di berkas halamannya). Tes ini menjaga
// agar keterangan percakapan Tanya Tutor AI tidak hilang atau menyimpang dari angka yang sebenarnya dipakai.
const html = renderToStaticMarkup(createElement(KebijakanPrivasiPage));
const teks = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("Kebijakan Privasi - Tanya Tutor AI", () => {
  it("menyebut percakapan sebagai data yang dikumpulkan dengan lama simpan yang sama dengan kode", () => {
    expect(teks).toContain("Percakapan Tanya Tutor AI");
    expect(teks).toContain(`${HARI_SIMPAN_RIWAYAT} hari sejak dikirim`);
  });

  it("lama simpan disebut di DUA tempat (data yang dikumpulkan dan lama penyimpanan) dan keduanya sama dengan kode", () => {
    const angka = [...teks.matchAll(/(\d+) hari sejak dikirim/g)].map((m) => m[1]);
    expect(angka).toEqual([String(HARI_SIMPAN_RIWAYAT), String(HARI_SIMPAN_RIWAYAT)]);
  });

  it("menyatakan foto tidak disimpan dan penghapusan dilakukan otomatis", () => {
    expect(teks).toMatch(/Foto coretan yang dilampirkan tidak disimpan/);
    expect(teks).toMatch(/dihapus otomatis/);
  });

  it("menyebut layanan Tutor AI sebagai pihak yang menerima data, dengan data yang TIDAK dikirim", () => {
    expect(teks).toContain("Layanan Tutor AI");
    expect(teks).toMatch(/tidak mengirim nama, NISN, tanggal lahir, surel, atau nama sekolah/);
  });

  it("menyebut siapa yang dapat membaca percakapan", () => {
    expect(teks).toMatch(/Admin Sekolah dan Dinas Pendidikan tidak memiliki tampilan untuk membacanya/);
  });

  it("lama penyimpanan umum memuat pengecualian percakapan Tutor", () => {
    expect(teks).toMatch(/Pengecualiannya isi percakapan Tanya Tutor AI/);
  });

  it("tanggal pembaruan memuat tanggal perubahan ini", () => {
    expect(teks).toContain("7 Oktober 2026");
  });

  it("menyebut hak siswa menghapus percakapan sendiri (di data yang dikumpulkan dan di hak atas data) dan jatah harian tak kembali", () => {
    expect([...teks.matchAll(/tombol Hapus percakapan/g)]).toHaveLength(2);
    expect(teks).toMatch(/jumlah itu tidak berkurang saat percakapan dihapus/);
  });
});

describe("Kebijakan Privasi - tempat data berjalan dan cadangan", () => {
  it("menyebut server VPS sendiri, bukan Supabase/Vercel (sejak 7 Oktober 2026 aplikasi, basis data, dan autentikasi berjalan di VPS)", () => {
    expect(teks).toContain("Penyedia server (VPS)");
    expect(teks).toMatch(/kami jalankan sendiri di server tersebut/);
    expect(teks).not.toMatch(/Supabase|Vercel|Singapura/);
  });

  it("lama cadangan yang disebut sama dengan skrip cadangan di server", () => {
    const skrip = readFileSync(join(process.cwd(), "deploy/self-host/skrip/backup-harian.sh"), "utf8");
    const hari = skrip.match(/^SIMPAN_HARI=(\d+)/m)?.[1];
    expect(hari).toBeDefined();
    expect(teks).toContain(`disimpan sampai ${hari} hari`);
    expect(teks).toMatch(/dapat masih ada di cadangan sampai cadangan itu sendiri dihapus/);
  });
});
