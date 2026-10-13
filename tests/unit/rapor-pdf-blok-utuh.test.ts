import PDFDocument from "pdfkit";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buatHasilContoh } from "../helpers/rapor-fixture";
import { bangunHierarkiKompetensi, type SkorKompetensi } from "@/lib/exam/hierarki-kompetensi";
import { setupFonts } from "@/lib/pdf/pdf-umum";
import { gambarTabelHierarki } from "@/lib/pdf/rapor-komponen";
import { gambarSoal } from "@/lib/pdf/rapor-renderer";

afterEach(() => vi.restoreAllMocks());

/**
 * Aturan tata letak rapor PDF: sebuah blok yang muat dalam satu halaman tidak boleh terbelah antar halaman, dan judulnya tidak
 * boleh tertinggal sendirian di dasar halaman. Tes isi (rapor-pdf-isi) hanya memeriksa apa yang tercetak; di sini yang diperiksa
 * adalah letak pindah halaman pada banyak posisi awal berbeda (rapat, tiap 1pt), sebab pelanggarannya hanya muncul bila blok
 * kebetulan jatuh di dasar halaman dan jendela pelanggarannya bisa sesempit 1-2pt.
 */

/**
 * Satu dokumen yang dipakai berulang: tiap percobaan dimulai di halaman baru pada tinggi y0, lalu urutan teks ("T:...") dan pindah
 * halaman ("HALAMAN") yang terjadi dikembalikan. Teks dicatat SESUDAH digambar: bila PDFKit sendiri pindah halaman di tengah
 * `text()` (teks tidak muat), "HALAMAN" tercatat lebih dulu daripada teksnya, sesuai kenyataan di kertas.
 */
function dokumenUji() {
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  let kejadian: string[] = [];
  const teksAsli = doc.text.bind(doc);
  const tambahAsli = doc.addPage.bind(doc);
  vi.spyOn(doc, "text").mockImplementation(((...args: unknown[]) => {
    const hasil = (teksAsli as (...a: unknown[]) => unknown)(...args);
    if (typeof args[0] === "string") kejadian.push(`T:${args[0]}`);
    return hasil;
  }) as never);
  vi.spyOn(doc, "addPage").mockImplementation(((...args: unknown[]) => {
    kejadian.push("HALAMAN");
    return (tambahAsli as (...a: unknown[]) => unknown)(...args);
  }) as never);
  const fonts = setupFonts(doc);
  doc.font(fonts.regular);
  return {
    doc,
    fonts,
    /** Mulai percobaan baru di halaman kosong pada tinggi y0; mengembalikan fungsi pengambil kejadian percobaan itu. */
    mulai(y0: number) {
      tambahAsli();
      kejadian = [];
      doc.x = 48;
      doc.y = y0;
      return () => [...kejadian];
    },
  };
}

function skorSedang(): SkorKompetensi[] {
  const daftar: SkorKompetensi[] = [];
  for (let e = 1; e <= 4; e++) {
    for (let s = 1; s <= 2; s++) {
      for (let k = 1; k <= 2; k++) {
        daftar.push({
          kompetensiId: `k${e}${s}${k}`,
          elemenId: `e${e}`,
          elemenNama: `Elemen Nomor ${e}`,
          elemenUrutan: e,
          subElemen: `Subelemen ${e}.${s}`,
          kompetensi: `Kompetensi ${e}.${s}.${k} yang menguraikan kemampuan siswa dalam menyelesaikan permasalahan kontekstual`,
          level: `L${k}`,
          jmlBenar: (e + s + k) % 3,
          jmlSoal: 2,
        });
      }
    }
  }
  return daftar;
}

describe("PDF rapor: tabel hierarki di berbagai posisi halaman", () => {
  it("baris elemen tidak pernah tertinggal sendirian di dasar halaman, dan kepala kolom selalu digambar ulang di halaman baru", () => {
    const { doc, fonts, mulai } = dokumenUji();
    const baris = bangunHierarkiKompetensi(skorSedang());
    let adaPindahHalaman = false;
    let adaElemenDipindah = false;
    for (let y0 = 120; y0 <= 770; y0 += 1) {
      const ambil = mulai(y0);
      gambarTabelHierarki(doc, fonts, baris);
      const kejadian = ambil();
      kejadian.forEach((e, i) => {
        if (e === "HALAMAN") {
          adaPindahHalaman = true;
          const teksBerikut = kejadian.slice(i + 1).find((x) => x.startsWith("T:"));
          expect(teksBerikut, `y0=${y0}: halaman baru tanpa kepala kolom`).toBe("T:HIERARKI");
        }
        if (!/^T:\d+\. Elemen Nomor/.test(e)) return;
        const berikut = kejadian.slice(i + 1);
        const iHalaman = berikut.indexOf("HALAMAN");
        const iBarisBerikut = berikut.findIndex((x) => x.startsWith("T:› "));
        expect(iBarisBerikut, `y0=${y0}: ${e} tanpa baris sesudahnya`).toBeGreaterThan(-1);
        if (iHalaman !== -1) expect(iBarisBerikut, `y0=${y0}: ${e} terpisah dari baris sesudahnya oleh pindah halaman`).toBeLessThan(iHalaman);
        // baris elemen yang nyaris jatuh di dasar halaman dipindahkan bersama kepala kolom di halaman baru
        if (kejadian[i - 1] === "T:SKOR KAMU" && kejadian[i - 2] === "T:HIERARKI" && kejadian[i - 3] === "HALAMAN") adaElemenDipindah = true;
      });
    }
    // pemindaian harus benar-benar melewati batas halaman, kalau tidak tes ini tidak membuktikan apa-apa
    expect(adaPindahHalaman).toBe(true);
    expect(adaElemenDipindah).toBe(true);
  }, 120_000);
});

describe("PDF rapor: blok per soal di berbagai posisi halaman", () => {
  type Soal = Parameters<typeof gambarSoal>[2];

  /** Syarat satu blok: sesudah `judul` harus menyusul `jumlah` teks yang cocok dengan `harus` sebelum pindah halaman berikutnya. */
  type Syarat = { judul: string; harus: RegExp; jumlah: number };

  const syaratSoal = (nomor: number, soal: { format: string }): Syarat[] => {
    const syarat: Syarat[] = [
      { judul: `T:Soal ${nomor}`, harus: /^T:(Hasil dari|Pilihlah|Tentukan)/, jumlah: 1 },
      { judul: "T:Pembahasan", harus: /^T:Langkah penyelesaian soal nomor/, jumlah: 1 },
    ];
    if (soal.format === "pg_kategori") syarat.push({ judul: "T:Kunci & Jawaban Siswa", harus: /^T:Siswa: /, jumlah: 2 });
    else syarat.push({ judul: "T:Pilihan jawaban", harus: /^T:[A-D]\. /, jumlah: 4 });
    return syarat;
  };

  it("kepala soal, pilihan jawaban, kunci kategori, dan pembahasan tidak terpotong atau tertinggal sendirian di dasar halaman", async () => {
    const hasil = await buatHasilContoh({ jumlahSoal: 4 });
    const contoh = hasil.perSoal.slice(0, 3); // pg, pg_kompleks, pg_kategori
    expect(contoh.map((s) => s.format)).toEqual(["pg", "pg_kompleks", "pg_kategori"]);
    const { doc, fonts, mulai } = dokumenUji();

    // Berapa kali tiap blok terpaksa dipindah ke halaman baru oleh penjaganya (bukti bahwa pemindaian menyentuh dasar halaman).
    const dipindah: Record<string, number> = {};
    for (const [indeks, soal] of contoh.entries()) {
      const nomor = indeks + 1;
      // Satu soal setinggi sekitar 250pt: di atas y0 = 500 tidak ada batas halaman yang tersentuh, jadi pemindaian dimulai dari sana.
      for (let y0 = 500; y0 <= 780; y0 += 1) {
        const ambil = mulai(y0);
        await gambarSoal(doc, fonts, soal as unknown as Soal, nomor, true);
        const kejadian = ambil();
        for (const s of syaratSoal(nomor, soal)) {
          const i = kejadian.indexOf(s.judul);
          expect(i, `soal ${nomor} y0=${y0}: ${s.judul} tidak tercetak`).toBeGreaterThan(-1);
          // blok yang tidak muat dipindah oleh penjaganya: halaman baru dibuat tepat sebelum judul blok digambar
          if (kejadian[i - 1] === "HALAMAN") dipindah[s.judul.replace(/\d+$/, "N")] = (dipindah[s.judul.replace(/\d+$/, "N")] ?? 0) + 1;
          let ditemukan = 0;
          for (let j = i + 1; j < kejadian.length && ditemukan < s.jumlah; j++) {
            expect(kejadian[j], `soal ${nomor} y0=${y0}: pindah halaman di tengah blok ${s.judul}`).not.toBe("HALAMAN");
            if (s.harus.test(kejadian[j]!)) ditemukan++;
          }
          expect(ditemukan, `soal ${nomor} y0=${y0}: blok ${s.judul} tidak lengkap`).toBe(s.jumlah);
        }
      }
    }
    for (const judul of ["T:Soal N", "T:Pilihan jawaban", "T:Kunci & Jawaban Siswa", "T:Pembahasan"]) {
      expect(dipindah[judul] ?? 0, `penjaga blok ${judul} tidak pernah teruji (pemindaian tidak menyentuh dasar halaman)`).toBeGreaterThan(0);
    }
  }, 180_000);
});
