import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RingkasanSeri } from "@/components/soal/ringkasan-seri";
import { ringkasSeri } from "@/lib/exam/seri-jadwal";

const MTK = { id: "mtk", nama: "Matematika" };
const p = (id: string, urutan: number, status: string, jenjang = "SMP") => ({
  id,
  nama: `Paket ${id}`,
  status,
  kategori: "mandiri",
  jenjang,
  urutanSeri: urutan,
  subject: MTK,
});
const render = (paket: ReturnType<typeof p>[], siswa: Record<string, number> | null) =>
  renderToStaticMarkup(createElement(RingkasanSeri, { kelompok: ringkasSeri(paket, siswa ?? {}), tampilkanSiswa: siswa != null }));

describe("RingkasanSeri - posisi urutan seri di halaman admin pusat", () => {
  it("menampilkan 'terbit sampai urutan ke-N', draft, nomor berikutnya, dan siswa terdepan", () => {
    const html = render([p("a", 1, "published"), p("b", 2, "published"), p("c", 3, "draft")], { a: 5, b: 2 });
    expect(html).toContain("Posisi Urutan Seri Try Out Mandiri");
    expect(html).toContain("Terbit sampai urutan ke-<b>2</b>");
    expect(html).toContain("draft: #3");
    expect(html).toContain("Urutan berikutnya: #4");
    expect(html).toContain("Siswa terdepan sudah menyelesaikan urutan ke-<b>2</b> (2 siswa)");
    expect(html).toContain("#1");
    expect(html).toContain("· 5 siswa");
  });

  it("jenjang tampil sebagai label, dan SD dan SMP berupa kartu terpisah", () => {
    const html = render([p("a", 1, "published"), p("x", 1, "published", "SD")], {});
    expect(html.match(/data-testid="kelompok-seri"/g)).toHaveLength(2);
    expect(html).toContain(">SD<");
    expect(html).toContain(">SMP<");
  });

  it("belum ada siswa yang menyelesaikan: pesan netral", () => {
    expect(render([p("a", 1, "published")], {})).toContain("Belum ada siswa yang menyelesaikan paket di seri ini");
  });

  it("celah nomor diberi catatan (rentang ringkas) yang menenangkan", () => {
    const html = render([p("a", 1, "published"), p("b", 6, "published")], {});
    expect(html).toContain("Nomor #2–5 belum dipakai paket mana pun");
    expect(html).toContain("Tidak masalah bagi siswa");
  });

  it("jumlah siswa gagal dimuat (null): angka siswa disembunyikan, bukan ditampilkan sebagai 0", () => {
    const html = render([p("a", 1, "published")], null);
    expect(html).not.toContain("siswa");
    expect(html).not.toContain('data-testid="posisi-siswa"');
    expect(html).toContain("Terbit sampai urutan ke-<b>1</b>");
  });

  it("tanpa paket berseri: tidak menampilkan apa pun", () => {
    expect(renderToStaticMarkup(createElement(RingkasanSeri, { kelompok: [], tampilkanSiswa: true }))).toBe("");
  });
});
