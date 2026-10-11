import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, refresh() {} }),
  usePathname: () => "/registrasi/mandiri",
  useSearchParams: () => new URLSearchParams(),
}));

import RegistrasiPage from "@/app/(auth)/registrasi/page";
import RegistrasiMandiriPage from "@/app/(auth)/registrasi/mandiri/page";

// Permintaan pemilik (12 Okt 2026): kalimat "Berbayar per mata pelajaran, termasuk beberapa kali Try Out" diganti "Gratis*",
// dan kalimat "Dipakai untuk memetakan nilai per wilayah dan jenis sekolah, seperti di portal hasil TKA." dihapus.
const baca = (relatif: string) => readFileSync(join(process.cwd(), relatif), "utf8");
const teks = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ").trim();

const BERKAS = ["app/(auth)/registrasi/page.tsx", "app/(auth)/registrasi/mandiri/page.tsx"];
const CATATAN = "*Gratis untuk 1x Try Out per mata pelajaran.";

describe("teks halaman pendaftaran siswa", () => {
  it.each(BERKAS)("%s tidak lagi mengatakan siswa mandiri 'berbayar per mata pelajaran'", (berkas) => {
    expect(baca(berkas)).not.toMatch(/Berbayar per mata pelajaran/i);
  });

  it("kalimat 'Dipakai untuk memetakan nilai per wilayah...' sudah dihapus dari formulir siswa mandiri", () => {
    const sumber = baca("app/(auth)/registrasi/mandiri/page.tsx");
    expect(sumber).not.toContain("Dipakai untuk memetakan nilai");
    expect(sumber).not.toContain("seperti di portal hasil TKA");
    // bagiannya sendiri (pilihan negeri/swasta) tetap ada
    expect(sumber).toContain("Sekolahmu negeri atau swasta?");
  });

  it("pilih jalur: kartu siswa mandiri berbunyi 'Gratis*' dan tanda bintang dijelaskan", () => {
    const t = teks(renderToStaticMarkup(createElement(RegistrasiPage)));
    expect(t).toContain("Sekolahmu belum berlangganan, atau kamu belajar sendiri. Gratis*");
    expect(t).toContain(CATATAN);
    expect(t).not.toMatch(/Berbayar/i);
  });

  it("formulir siswa mandiri: judul diikuti 'Gratis*' dan penjelasan tanda bintang", () => {
    const t = teks(renderToStaticMarkup(createElement(RegistrasiMandiriPage)));
    expect(t).toContain("Daftar - Siswa Mandiri Gratis*");
    expect(t).toContain(CATATAN);
    expect(t).not.toMatch(/Berbayar/i);
    expect(t).not.toContain("Dipakai untuk memetakan");
  });

  it("jalur sekolah tetap 'Gratis' (tanpa tanda bintang) karena syaratnya jelas: butuh Kode Sekolah", () => {
    const t = teks(renderToStaticMarkup(createElement(RegistrasiPage)));
    expect(t).toContain("Sekolahmu sudah pakai AyoTKA. Gratis - butuh Kode Sekolah dari admin.");
  });

  it("catatan tanda bintang konsisten dengan jatah gratis yang berlaku di aplikasi dan di halaman harga", () => {
    // halaman harga (landing) dan layar mulai ujian menyebut jatah yang sama: 1x per mata pelajaran
    expect(baca("components/public/landing/harga.tsx")).toMatch(/1x Try Out per mata pelajaran/);
    expect(baca("app/siswa/(shell)/ujian/mulai/page.tsx")).toMatch(/1× ujian untuk setiap mata pelajaran/);
  });
});
