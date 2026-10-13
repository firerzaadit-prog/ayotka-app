import { describe, expect, it } from "vitest";
import {
  KARAKTER_LABEL_SALAH,
  KARAKTER_PER_TOKEN,
  KARAKTER_TETAP_PER_SOAL,
  KARAKTER_TETAP_PROMPT,
  RASIO_SALAH,
  perkiraanSoalDariBeban,
  taksirBebanAi,
  type SoalUntukTaksiran,
} from "@/lib/billing/beban-ai";
import { buildAnalisisPrompt } from "@/lib/ai/prompt";
import { renderKerangkaAsesmenRingkas } from "@/lib/content/kerangka-asesmen";

const soalBiasa = (n: number, o: Partial<SoalUntukTaksiran> = {}): SoalUntukTaksiran[] =>
  Array.from({ length: n }, () => ({ teks: "a".repeat(300), pembahasan: "b".repeat(500), opsi: Array.from({ length: 4 }, () => "c".repeat(40)), ...o }));

describe("taksirBebanAi", () => {
  it("paket tanpa soal tetap punya beban tetap prompt (aturan, kerangka, blok indikator)", () => {
    expect(taksirBebanAi([])).toBe(Math.round(KARAKTER_TETAP_PROMPT / KARAKTER_PER_TOKEN));
  });

  it("satu soal biasa: tetap + teks + jawaban siswa + separuh (label + kunci + pembahasan)", () => {
    // 7.500 + 160 + 300 + 40 + 0,5 x (40 + 40 + 500) = 8.290 karakter -> 2.368,57 token
    expect(taksirBebanAi(soalBiasa(1))).toBe(2_369);
    expect(KARAKTER_TETAP_PER_SOAL).toBe(160);
    expect(KARAKTER_LABEL_SALAH).toBe(40);
    expect(RASIO_SALAH).toBe(0.5);
  });

  it("spasi dan baris kosong dirapatkan seperti di prompt (teks.replace(/\\s+/g, ' '))", () => {
    const rapat = taksirBebanAi([{ teks: "a b c", pembahasan: null, opsi: [] }]);
    const longgar = taksirBebanAi([{ teks: "  a \n\n  b\t\t c  ", pembahasan: null, opsi: [] }]);
    expect(longgar).toBe(rapat);
  });

  it("pembahasan kosong atau null dan tanpa pilihan jawaban dihitung nol, tanpa NaN", () => {
    const tanpa = taksirBebanAi([{ teks: "", pembahasan: null, opsi: [] }]);
    const kosong = taksirBebanAi([{ teks: "", pembahasan: "", opsi: [] }]);
    expect(Number.isFinite(tanpa)).toBe(true);
    expect(kosong).toBe(tanpa);
    expect(tanpa).toBe(Math.round((KARAKTER_TETAP_PROMPT + KARAKTER_TETAP_PER_SOAL + RASIO_SALAH * KARAKTER_LABEL_SALAH) / KARAKTER_PER_TOKEN));
  });

  it("bertambah seiring banyaknya soal dan panjangnya teks, pilihan, dan pembahasan", () => {
    const dasar = taksirBebanAi(soalBiasa(10));
    expect(taksirBebanAi(soalBiasa(11))).toBeGreaterThan(dasar);
    expect(taksirBebanAi(soalBiasa(10, { teks: "a".repeat(600) }))).toBeGreaterThan(dasar);
    expect(taksirBebanAi(soalBiasa(10, { pembahasan: "b".repeat(1_000) }))).toBeGreaterThan(dasar);
    expect(taksirBebanAi(soalBiasa(10, { opsi: Array.from({ length: 4 }, () => "c".repeat(80)) }))).toBeGreaterThan(dasar);
    expect(taksirBebanAi(soalBiasa(10, { pembahasan: null }))).toBeLessThan(dasar);
  });

  it("pembahasan hanya dihitung separuh (asumsi separuh soal salah): 700 karakter lebih panjang x 10 soal = 1.000 token", () => {
    const a = taksirBebanAi(soalBiasa(10, { pembahasan: "b".repeat(100) }));
    const b = taksirBebanAi(soalBiasa(10, { pembahasan: "b".repeat(800) }));
    expect(b - a).toBe(Math.round((10 * 700 * RASIO_SALAH) / KARAKTER_PER_TOKEN));
  });

  it("urutan soal tidak memengaruhi hasil", () => {
    const campur: SoalUntukTaksiran[] = [
      { teks: "satu", pembahasan: "x".repeat(50), opsi: ["a", "bb"] },
      { teks: "dua dua dua", pembahasan: null, opsi: [] },
      { teks: "tiga", pembahasan: "y".repeat(900), opsi: ["ccc"] },
    ];
    expect(taksirBebanAi([...campur].reverse())).toBe(taksirBebanAi(campur));
  });
});

describe("taksiran selaras dengan prompt sungguhan (pagar agar konstanta tidak melenceng saat prompt berubah)", () => {
  const dasarPrompt = (kerangka: string | null, soal: Parameters<typeof buildAnalisisPrompt>[0]["soal"] = []) =>
    buildAnalisisPrompt({ namaSiswa: "Budi", paketNama: "Paket Uji", skorAkhir: 50, kerangkaAsesmen: kerangka, kompetensi: [], levelKognitif: [], format: [], soal });

  it("bagian tetap prompt (aturan + kerangka asesmen) muat dalam KARAKTER_TETAP_PROMPT dan tidak jauh lebih kecil", () => {
    for (const [jenjang, mapel] of [["SD", "matematika"], ["SMP", "matematika"]] as const) {
      const kerangka = renderKerangkaAsesmenRingkas(jenjang, mapel);
      expect(kerangka, `${jenjang} ${mapel}`).toBeTruthy();
      const panjang = dasarPrompt(kerangka).length;
      // sisa (blok indikator resmi) hanya sebagian kecil; taksiran tidak boleh di bawah prompt tetapnya, tidak boleh berlebihan
      expect(panjang, `${jenjang} ${mapel}`).toBeLessThanOrEqual(KARAKTER_TETAP_PROMPT);
      expect(panjang, `${jenjang} ${mapel}`).toBeGreaterThanOrEqual(KARAKTER_TETAP_PROMPT * 0.6);
    }
  });

  it("pertumbuhan prompt per soal (separuh salah) tidak melebihi taksiran dan taksiran tidak berlebihan", () => {
    const n = 40;
    const soal = Array.from({ length: n }, (_, i) => ({
      nomor: i + 1,
      benar: i % 2 === 0,
      teksSoal: "a".repeat(300),
      elemenNama: "Bilangan",
      subElemen: "Operasi Hitung Bilangan",
      levelBloom: "L2",
      jawabanSiswa: "c".repeat(40),
      kunciJawaban: "c".repeat(40),
      pembahasan: "b".repeat(500),
    }));
    const tumbuhNyata = (dasarPrompt(null, soal).length - dasarPrompt(null).length) / n;
    const taksiran = (taksirBebanAi(soalBiasa(n)) - taksirBebanAi([])) * KARAKTER_PER_TOKEN / n;
    expect(taksiran).toBeGreaterThanOrEqual(tumbuhNyata);
    // selisih = bagian peta kompetensi/indikator per soal yang tidak ikut dibangun di sini; wajar sampai sekitar sepertiga
    expect(taksiran).toBeLessThanOrEqual(tumbuhNyata * 1.35);
  });
});

describe("perkiraanSoalDariBeban", () => {
  it("beban di bawah bagian tetap = 0 soal; naik seiring beban; batas bawaan kira-kira 19 dan 50 soal", () => {
    expect(perkiraanSoalDariBeban(0)).toBe(0);
    expect(perkiraanSoalDariBeban(-10)).toBe(0);
    expect(perkiraanSoalDariBeban(Math.round(KARAKTER_TETAP_PROMPT / KARAKTER_PER_TOKEN))).toBe(0);
    expect(perkiraanSoalDariBeban(6_500)).toBe(19);
    expect(perkiraanSoalDariBeban(13_500)).toBe(50);
    expect(perkiraanSoalDariBeban(20_000)).toBeGreaterThan(perkiraanSoalDariBeban(13_500));
  });

  it("selaras dengan taksirBebanAi: beban 30 soal biasa dibaca kembali sebagai sekitar 30 soal", () => {
    const beban = taksirBebanAi(soalBiasa(30));
    expect(Math.abs(perkiraanSoalDariBeban(beban) - 30)).toBeLessThanOrEqual(1);
  });
});
