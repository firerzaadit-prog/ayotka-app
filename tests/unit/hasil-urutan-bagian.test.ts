import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Urutan bagian pada halaman hasil siswa (permintaan user, 16 Okt 2026): kartu Learning Analytics ditaruh TEPAT di bawah
 * "Percobaan pada Paket Ini" dan di atas peringkat, "Peta Kompetensi", dan bagian lain. Diuji dari urutan di berkas
 * sumber (satu-satunya tempat urutan itu ditetapkan); uji peramban memeriksa urutan nyata di layar.
 */
const sumber = readFileSync(join(process.cwd(), "app/siswa/(shell)/hasil/[id]/page.tsx"), "utf8");
const pos = (potongan: string) => sumber.indexOf(potongan);

describe("urutan bagian halaman hasil siswa", () => {
  it("Learning Analytics persis setelah kartu percobaan dan sebelum peringkat, peta kompetensi, rincian", () => {
    const percobaan = pos("<RiwayatPercobaanCard");
    const la = pos("<LearningAnalyticsSiswa");
    const peringkat = pos("<RankingBoardCard");
    const peta = pos("Peta Kompetensi</h2>");
    const rincian = pos("Rincian Jawaban</h2>");
    for (const [nama, p] of Object.entries({ percobaan, la, peringkat, peta, rincian })) expect(p, nama).toBeGreaterThan(-1);
    expect(percobaan).toBeLessThan(la);
    expect(la).toBeLessThan(peringkat);
    expect(peringkat).toBeLessThan(peta);
    expect(peta).toBeLessThan(rincian);
  });

  // Permintaan user (17 Okt 2026): Peta Kompetensi dan Daya Serap per Indikator dijadikan satu kartu dengan satu tabel.
  it("Peta Kompetensi dan Daya Serap per Indikator satu kartu: satu judul, tabel resmi bila ada indikator, peta lama hanya cadangan", () => {
    expect(sumber.match(/Peta Kompetensi<\/h2>/g)).toHaveLength(1);
    expect(sumber).not.toContain("Daya Serap per Indikator</h2>");
    // satu-satunya kartu capaian: tabel resmi dulu, peta lama hanya di cabang tanpa indikator atau di laci semua soal
    const kartu = sumber.slice(pos("Peta Kompetensi</h2>") - 200, pos("Rincian Jawaban</h2>"));
    expect(kartu.indexOf("<DayaSerapIndikator")).toBeGreaterThan(-1);
    expect(kartu.indexOf("<DayaSerapIndikator")).toBeLessThan(kartu.indexOf("<HierarkiKompetensiTabel"));
    expect(kartu).toContain("hasil.indikator.soalTercakup < hasil.indikator.soalTotal");
    expect(kartu).toContain("data-peta-semua-soal");
    expect(kartu.match(/<Card/g)).toHaveLength(1);
  });

  it("hanya satu kartu Learning Analytics di halaman (tidak ada salinan lama di bagian bawah)", () => {
    expect(sumber.match(/<LearningAnalyticsSiswa/g)?.length).toBe(1);
  });

  it("tidak ada elemen lain di antara kartu percobaan dan Learning Analytics selain komentar penjelasnya", () => {
    const antara = sumber.slice(pos("<RiwayatPercobaanCard"), pos("<LearningAnalyticsSiswa"));
    expect(antara).not.toMatch(/<Card|<RankingBoardCard|<DayaSerapIndikator|<RincianJawaban/);
  });
});

describe("Prioritas belajar & Kekuatanmu = fitur berbayar: pemasangan di halaman hasil siswa", () => {
  it("kartu fokus mengikuti bendera dari server (bawaan terbuka untuk respons lama) atau pembukaan di sesi ini", () => {
    expect(sumber).toContain("tampilkanFokus={fokusDibukaSesi || hasil.fokusBelajarDibuka !== false}");
    // satu-satunya pemakaian DayaSerapIndikator di halaman: tidak ada jalur kedua yang lupa digerbang
    expect(sumber.match(/<DayaSerapIndikator/g)?.length).toBe(1);
  });

  it("kartu terbuka otomatis saat analisis selesai atau saat opsi baru menunjukkan ada jatah/saldo, dan tidak pernah ditutup lagi", () => {
    expect(sumber).toContain("onAnalisisSiap={saatAnalisisSiap}");
    expect(sumber).toContain("onOpsiBerubah={saatOpsiBerubah}");
    expect(sumber).toContain("bisaLihatFokusBelajar(opsi)");
    expect(sumber).toContain("setFokusDibukaSesi(true)");
    expect(sumber).not.toContain("setFokusDibukaSesi(false)");
    // searah: opsi baru hanya bisa MEMBUKA (pernyataan bersyarat), tidak pernah menyetel nilai menurut opsi (yang bisa menutup lagi)
    expect(sumber).toContain("if (bisaLihatFokusBelajar(opsi)) setFokusDibukaSesi(true);");
    expect(sumber).not.toMatch(/setFokusDibukaSesi\((?!true\))/);
  });
});

describe("pelapor opsi pada komponen Learning Analytics siswa", () => {
  const komponen = readFileSync(join(process.cwd(), "components/ai/learning-analytics-siswa.tsx"), "utf8");

  it("setiap opsi baru dari server diteruskan ke halaman (muat ulang saat kembali ke tab, dan sesudah pesanan gagal)", () => {
    expect(komponen).toContain("onOpsiBerubah");
    expect(komponen.match(/onOpsiBerubahRef\.current\?\.\(baru\)/g)?.length).toBe(2);
  });
});
