import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KeteranganLamaSimpan } from "@/components/tutor/keterangan-lama-simpan";
import { AMBANG_TANPA_BATAS_HARI, HARI_SIMPAN_RIWAYAT } from "@/lib/tutor/konstanta";

const teks = (hari: number) => renderToStaticMarkup(createElement(KeteranganLamaSimpan, { hariSimpan: hari })).replace(/<[^>]+>/g, "");

describe("KeteranganLamaSimpan (kalimat lama simpan percakapan Tutor untuk siswa)", () => {
  it("tanpa batas waktu: tidak menyebut jumlah hari maupun penghapusan otomatis, menunjuk tombol Hapus percakapan", () => {
    const t = teks(36500);
    expect(t).toContain("disimpan agar bisa kamu lanjutkan kapan saja");
    expect(t).toContain("Hapus percakapan");
    expect(t).not.toMatch(/36500|36\.500/);
    expect(t).not.toMatch(/dihapus otomatis/i);
    expect(t).not.toMatch(/\bhari\b/);
  });

  it("dengan batas nyata: menyebut jumlah hari dan penghapusan otomatis", () => {
    const t = teks(7);
    expect(t).toBe("Percakapan ini disimpan 7 hari sejak dikirim agar bisa kamu lanjutkan, lalu dihapus otomatis.");
  });

  it("batas nyata yang panjang pun (30 hari, 1 tahun, hampir 10 tahun) tetap disebut jumlah harinya dan dihapus otomatis", () => {
    for (const hari of [30, 365, 1000, AMBANG_TANPA_BATAS_HARI - 1]) {
      const t = teks(hari);
      expect(t, String(hari)).toContain(`${hari} hari`);
      expect(t, String(hari)).toContain("lalu dihapus otomatis");
    }
  });

  it("batas beralih tepat di AMBANG_TANPA_BATAS_HARI", () => {
    expect(teks(AMBANG_TANPA_BATAS_HARI - 1)).toContain("dihapus otomatis");
    expect(teks(AMBANG_TANPA_BATAS_HARI)).not.toContain("dihapus otomatis");
  });

  it("janji ke siswa selalu cocok dengan HARI_SIMPAN_RIWAYAT yang sungguh dipakai server", () => {
    const t = teks(HARI_SIMPAN_RIWAYAT);
    if (HARI_SIMPAN_RIWAYAT >= AMBANG_TANPA_BATAS_HARI) {
      expect(t).not.toMatch(/dihapus otomatis/i);
    } else {
      expect(t).toContain(`${HARI_SIMPAN_RIWAYAT} hari`);
      expect(t).toContain("dihapus otomatis");
    }
  });
});
