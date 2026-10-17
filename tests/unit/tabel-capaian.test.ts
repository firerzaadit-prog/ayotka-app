import { describe, expect, it } from "vitest";
import { hitungLaporanSiswa, type InfoIndikator, type JawabanBerindikator } from "@/lib/indikator/daya-serap";
import masterResmi from "@/lib/indikator/kemendikdasmen-official.json";
import type { RawIndicatorItem } from "@/lib/indikator/hierarki-resmi";

/** Data master Kemendikdasmen apa adanya (30 indikator per jenjang dan mapel). */
const daftarIndikatorResmi = (jenjang: "SD" | "SMP", mapel: "matematika" | "bahasa-indonesia"): RawIndicatorItem[] =>
  (masterResmi as RawIndicatorItem[]).filter(
    (d) => d.jenjang.toUpperCase() === jenjang && d.nama_mapel.toLowerCase().includes(mapel === "matematika" ? "matematika" : "bahasa indonesia"),
  );
import { bangunBarisDiuji, type BarisTabelCapaian } from "@/lib/indikator/tabel-capaian";

// Tabel capaian siswa: satu tampilan, hanya indikator yang muncul di soal percobaan ini (permintaan pemilik, 17 Okt 2026).
// Tes memakai data master Kemendikdasmen yang sungguhan.

const info = (item: RawIndicatorItem): InfoIndikator => ({
  id: `${item.jenjang}-${item.kd_mapel}-${item.urutan}`,
  jenjang: item.jenjang,
  namaMapel: item.nama_mapel,
  elemen: item.elemen,
  subelemen: item.subelemen,
  kompetensi: item.kompetensi,
  indikator: item.indikator,
  urutan: item.urutan,
  nilaiNasional: item.nilai_nasional,
});
const jawab = (item: RawIndicatorItem, soal: number, benar: number): JawabanBerindikator[] =>
  Array.from({ length: soal }, (_, i) => ({ indikator: info(item), skor: i < benar ? 1 : 0, skorMaks: 1 }));

const smpMat = daftarIndikatorResmi("SMP", "matematika");
const laporanDari = (jawaban: JawabanBerindikator[]) => hitungLaporanSiswa(jawaban)!;
const daun = (baris: BarisTabelCapaian[], level: 3 | 4) => baris.filter((b) => b.level === level);

describe("bangunBarisDiuji", () => {
  it("hanya indikator yang diuji, dengan skor, jumlah benar (skor/skorMaks), dan nama kelompok di tingkat 1", () => {
    const l = laporanDari([...jawab(smpMat[0]!, 3, 2), ...jawab(smpMat[10]!, 2, 2)]);
    const baris = bangunBarisDiuji(l);
    expect(daun(baris, 4)).toHaveLength(2);
    const el = baris.filter((b) => b.level === 1);
    expect(el.map((b) => b.kelompokNama)).toEqual(l.kelompok.map((k) => k.nama));
    expect(el[0]!.skor).toBe(l.kelompok[0]!.skor);
    expect(el[0]!.skorMaks).toBe(l.kelompok[0]!.skorMaks);
  });

  it("setiap baris punya skor dan jumlah soal (tidak ada baris tanpa nilai)", () => {
    const baris = bangunBarisDiuji(laporanDari([...jawab(smpMat[0]!, 3, 2), ...jawab(smpMat[10]!, 2, 2), ...jawab(smpMat[25]!, 1, 0)]));
    for (const b of baris) {
      expect(typeof b.dayaSerap).toBe("number");
      expect(b.jmlSoal).toBeGreaterThan(0);
    }
  });

  it("baris Elemen mengambil angka resmi kelompok (nasional terbobot, bukan rata-rata biasa)", () => {
    const l = laporanDari([...jawab({ ...smpMat[0]!, nilai_nasional: 30 }, 1, 1), ...jawab({ ...smpMat[1]!, nilai_nasional: 60 }, 3, 1)]);
    const el = bangunBarisDiuji(l).find((b) => b.level === 1)!;
    expect(el.nasional).toBe(l.kelompok[0]!.nasional);
    expect(el.nasional).toBeCloseTo((30 * 1 + 60 * 3) / 4);
  });

  it("skor Elemen terbobot menurut soal (bukan rata-rata biasa skor indikator): 1/1 benar dan 1/4 benar = 40%, bukan 62,5%", () => {
    const [a, b] = [smpMat[0]!, smpMat[1]!];
    expect(a.elemen).toBe(b.elemen);
    const l = laporanDari([...jawab(a, 1, 1), ...jawab(b, 4, 1)]);
    const el = bangunBarisDiuji(l).find((r) => r.level === 1)!;
    expect(el.dayaSerap).toBeCloseTo(40);
    expect(el.dayaSerap).toBe(l.kelompok[0]!.dayaSerap);
  });

  it("id baris unik (kunci React)", () => {
    const baris = bangunBarisDiuji(laporanDari([...jawab(smpMat[0]!, 2, 1), ...jawab(smpMat[10]!, 2, 2), ...jawab(smpMat[25]!, 1, 1)]));
    expect(new Set(baris.map((b) => b.id)).size).toBe(baris.length);
  });

  it("Bahasa Indonesia: tiga tingkat (tanpa tingkat 4), indikator di tingkat 3, tanpa kata Elemen/Subelemen", () => {
    const bin = daftarIndikatorResmi("SMP", "bahasa-indonesia");
    const l = laporanDari([...jawab(bin[0]!, 3, 2), ...jawab(bin[20]!, 2, 2)]);
    expect(l.jumlahTingkat).toBe(3);
    const baris = bangunBarisDiuji(l);
    expect(baris.some((b) => b.level === 4)).toBe(false);
    expect(daun(baris, 3).filter((b) => b.rawIndikatorTeks)).toHaveLength(2);
    expect(JSON.stringify(baris)).not.toMatch(/Elemen|Subelemen/);
  });

  it("SD Matematika: nama elemen mengikuti Kerangka Asesmen ('Data')", () => {
    const sd = daftarIndikatorResmi("SD", "matematika");
    const itemData = sd.find((d) => d.elemen === "Data dan Ketidakpastian")!;
    const baris = bangunBarisDiuji(laporanDari(jawab(itemData, 3, 3)));
    expect(baris.filter((b) => b.level === 1).map((b) => b.judulTampil)).toEqual(["Data"]);
  });
});
