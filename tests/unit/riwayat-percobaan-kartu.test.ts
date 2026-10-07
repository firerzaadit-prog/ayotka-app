import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RiwayatPercobaanKartu, type ItemRiwayatKartu } from "@/components/siswa/riwayat-percobaan-kartu";

const item = (id: string, percobaanKe: number, status: ItemRiwayatKartu["status"], skorAkhir: number | null, jam: number): ItemRiwayatKartu => ({
  id,
  percobaanKe,
  status,
  skorAkhir,
  mulaiAt: new Date(Date.UTC(2026, 9, 8, jam)).toISOString(),
});
const render = (items: ItemRiwayatKartu[]) => renderToStaticMarkup(createElement(RiwayatPercobaanKartu, { items }));
const hitung = (html: string, kata: string) => html.split(kata).length - 1;

describe("RiwayatPercobaanKartu - semua percobaan tampil, tidak ada yang disembunyikan", () => {
  it("tanpa percobaan: tidak menggambar apa pun", () => {
    expect(render([])).toBe("");
  });

  it("menampilkan SETIAP percobaan, urut dari yang pertama walau masukan tidak berurutan, dengan nomor dan nilai", () => {
    const html = render([item("c", 3, "selesai", 91.4, 5), item("a", 1, "selesai", 60, 1), item("b", 2, "kedaluwarsa", 75.6, 3)]);
    expect(hitung(html, "Percobaan ke-")).toBe(3);
    expect(html.indexOf("Percobaan ke-1")).toBeLessThan(html.indexOf("Percobaan ke-2"));
    expect(html.indexOf("Percobaan ke-2")).toBeLessThan(html.indexOf("Percobaan ke-3"));
    expect(html).toContain("Nilai 60");
    expect(html).toContain("Nilai 76"); // 75.6 dibulatkan seperti di halaman hasil
    expect(html).toContain("Nilai 91");
    expect(html).toContain("Riwayat percobaan (3)");
  });

  it("jam mulai ditampilkan dalam WIB", () => {
    expect(render([item("a", 1, "selesai", 60, 1)])).toContain("8 Oktober 2026 08:00 WIB");
  });

  it("hanya percobaan TERAKHIR yang bertanda 'Terbaru', dan hanya bila ada lebih dari satu", () => {
    const dua = render([item("a", 1, "selesai", 60, 1), item("b", 2, "selesai", 80, 3)]);
    expect(hitung(dua, "Terbaru")).toBe(1);
    expect(dua.indexOf("Percobaan ke-2")).toBeLessThan(dua.indexOf("Terbaru"));
    expect(render([item("a", 1, "selesai", 60, 1)])).not.toContain("Terbaru");
  });

  it("terbuka otomatis bila lebih dari satu percobaan; tertutup bila hanya satu", () => {
    expect(render([item("a", 1, "selesai", 60, 1), item("b", 2, "selesai", 80, 3)])).toMatch(/<details[^>]* open/);
    expect(render([item("a", 1, "selesai", 60, 1)])).not.toMatch(/<details[^>]* open/);
  });

  it("setiap percobaan yang berakhir punya tautan 'Lihat hasil' ke hasilnya sendiri", () => {
    const html = render([item("p1", 1, "selesai", 60, 1), item("p2", 2, "kedaluwarsa", 40, 3)]);
    expect(html).toContain('href="/siswa/hasil/p1"');
    expect(html).toContain('href="/siswa/hasil/p2"');
    expect(hitung(html, "Lihat hasil")).toBe(2);
  });

  it("percobaan berjalan: 'Lanjutkan' ke ujiannya, tanpa nilai; dijeda: tanpa tautan sama sekali", () => {
    const html = render([item("p1", 1, "selesai", 60, 1), item("p2", 2, "berjalan", null, 3), item("p3", 3, "paused", null, 5)]);
    expect(html).toContain('href="/siswa/attempt/p2"');
    expect(hitung(html, "Lanjutkan")).toBe(1);
    expect(html).toContain("Sedang berjalan");
    expect(html).toContain("Dijeda admin");
    expect(html).not.toContain('href="/siswa/hasil/p2"');
    expect(html).not.toContain('href="/siswa/hasil/p3"');
    expect(hitung(html, "Nilai ")).toBe(1);
  });

  it("selesai tanpa nilai (data cacat): tidak menulis 'Nilai null'", () => {
    expect(render([item("a", 1, "selesai", null, 1)])).not.toMatch(/Nilai (null|NaN)/);
  });
});
