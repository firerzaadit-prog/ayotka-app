import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CatatanRujukanNasional } from "@/components/hasil/catatan-rujukan-nasional";
import { DayaSerapIndikator } from "@/components/hasil/daya-serap-indikator";
import { hitungLaporanSiswa, type InfoIndikator, type JawabanBerindikator } from "@/lib/indikator/daya-serap";
import { CATATAN_RUJUKAN_NASIONAL, TAHUN_AJARAN_RUJUKAN_NASIONAL } from "@/lib/indikator/sumber-nasional";

const ROOT = path.resolve(__dirname, "..", "..");
const baca = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const mat = (n: number, o: Partial<InfoIndikator> = {}): InfoIndikator => ({
  id: `m${n}`,
  jenjang: "SMP",
  namaMapel: "Matematika",
  elemen: n <= 2 ? "Bilangan" : "Aljabar",
  subelemen: n <= 2 ? "Bilangan Real" : "Persamaan",
  kompetensi: `Kemampuan nomor ${n}`,
  indikator: `Indikator mat ${n} (${n})`,
  urutan: n,
  nilaiNasional: 40,
  ...o,
});
const jw = (ind: InfoIndikator | null, skor: number): JawabanBerindikator => ({ indikator: ind, skor, skorMaks: 1 });
const ulang = (ind: InfoIndikator, n: number, benar: number) => Array.from({ length: n }, (_, i) => jw(ind, i < benar ? 1 : 0));

describe("catatan sumber rujukan nasional", () => {
  it("satu kalimat baku: data hasil TKA tahun ajaran 2025/2026", () => {
    expect(TAHUN_AJARAN_RUJUKAN_NASIONAL).toBe("2025/2026");
    expect(CATATAN_RUJUKAN_NASIONAL).toBe("Rujukan nasional berdasarkan data hasil TKA tahun ajaran 2025/2026.");
  });

  it("komponen menampilkan kalimat itu dengan penanda untuk uji browser", () => {
    const h = renderToStaticMarkup(createElement(CatatanRujukanNasional, { className: "mt-2" }));
    expect(h).toContain("data-catatan-rujukan-nasional");
    expect(h).toContain(CATATAN_RUJUKAN_NASIONAL);
    expect(h).toContain("mt-2");
  });

  it("rapor siswa (web): satu tabel capaian, satu catatan tepat di bawahnya (kalimat sumber tidak diulang)", () => {
    const laporan = hitungLaporanSiswa([...ulang(mat(1, { nilaiNasional: 30 }), 4, 4), ...ulang(mat(3, { nilaiNasional: 80 }), 4, 1)])!;
    const h = renderToStaticMarkup(createElement(DayaSerapIndikator, { laporan }));

    // Sejak 17 Okt 2026 hanya ada satu tabel (permintaan user), jadi satu catatan bertanda dan kalimatnya sekali saja.
    expect(h.match(/<table/g)).toHaveLength(1);
    expect((h.match(/data-catatan-rujukan-nasional/g) ?? []).length).toBe(1);
    expect(h.split(CATATAN_RUJUKAN_NASIONAL).length - 1).toBe(1);
    expect(h.indexOf("data-catatan-rujukan-nasional")).toBeGreaterThan(h.indexOf("</table>"));
  });

  // Pagar untuk tampilan baru: setiap berkas yang menyajikan rerata nasional wajib memakai catatan/kalimat bakunya.
  it.each([
    ["components/hasil/daya-serap-indikator.tsx", "CatatanRujukanNasional"],
    ["components/analytics/kemendikdasmen-daya-serap-view.tsx", "CatatanRujukanNasional"],
    ["components/hasil/laporan-indikator-sekolah-view.tsx", "CatatanRujukanNasional"],
    ["app/admin-pusat/indikator/page.tsx", "CatatanRujukanNasional"],
    ["lib/pdf/rapor-renderer.ts", "CATATAN_RUJUKAN_NASIONAL"],
    ["lib/pdf/laporan-sekolah-renderer.ts", "CATATAN_RUJUKAN_NASIONAL"],
    ["lib/indikator/laporan-excel.ts", "CATATAN_RUJUKAN_NASIONAL"],
  ])("%s memakai %s", (berkas, penanda) => {
    expect(baca(berkas)).toContain(penanda);
  });

  // Memindai ratusan berkas: tiap berkas dibaca SEKALI, dan batas waktunya longgar supaya tidak gagal hanya karena
  // mesin sedang sibuk (uji penuh berjalan paralel dengan banyak pekerja).
  it(
    "tidak ada tampilan .tsx lain yang menyebut rerata/rujukan nasional tanpa catatan sumbernya",
    () => {
      const menyebutNasional = /Rerata nasional|RUJUKAN NASIONAL|TRY OUT NASIONAL|nilaiNasional|rerata nasional/;
      const adaCatatan = /CatatanRujukanNasional|CATATAN_RUJUKAN_NASIONAL/;
      const tanpaCatatan: string[] = [];
      const jelajah = (dir: string) => {
        for (const entri of readdirSync(dir, { withFileTypes: true })) {
          const penuh = path.join(dir, entri.name);
          if (entri.isDirectory()) jelajah(penuh);
          else if (entri.name.endsWith(".tsx")) {
            const isi = readFileSync(penuh, "utf8");
            if (menyebutNasional.test(isi) && !adaCatatan.test(isi)) tanpaCatatan.push(path.relative(ROOT, penuh).replaceAll("\\", "/"));
          }
        }
      };
      jelajah(path.join(ROOT, "components"));
      jelajah(path.join(ROOT, "app"));
      expect(tanpaCatatan).toEqual([]);
    },
    90_000,
  );
});
