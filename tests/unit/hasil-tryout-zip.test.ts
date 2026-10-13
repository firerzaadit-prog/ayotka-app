import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { MAKS_BERKAS_UNDUH_MASSAL, namaDariKepala, unduhMassal, type ItemUnduh } from "@/lib/hasil-tryout/unduh-massal";
import { bersihkanNamaZip, buatZip, namaUnik } from "@/lib/hasil-tryout/zip";

const enc = (t: string) => new TextEncoder().encode(t);
const WAKTU = new Date(2026, 9, 13, 14, 30, 44);

describe("buatZip", () => {
  it("menghasilkan ZIP sah yang bisa dibaca pustaka lain: nama, isi, dan CRC tiap berkas cocok", async () => {
    const isi = new Uint8Array(70_000).map((_, i) => (i * 31) % 251); // lebih dari 64 KB
    const zip = buatZip(
      [
        { nama: "Rapor-Budi.pdf", isi: enc("%PDF-1.7 isi budi") },
        { nama: "Rapor-Besar.pdf", isi },
        { nama: "kosong.txt", isi: new Uint8Array(0) },
      ],
      WAKTU,
    );
    const baca = await JSZip.loadAsync(zip, { checkCRC32: true });
    expect(Object.keys(baca.files)).toEqual(["Rapor-Budi.pdf", "Rapor-Besar.pdf", "kosong.txt"]);
    expect(await baca.file("Rapor-Budi.pdf")!.async("string")).toBe("%PDF-1.7 isi budi");
    expect(Array.from(await baca.file("Rapor-Besar.pdf")!.async("uint8array"))).toEqual(Array.from(isi));
    expect((await baca.file("kosong.txt")!.async("uint8array")).length).toBe(0);
  });

  it("nama berkas UTF-8 (huruf non-Latin, aksen) terbaca utuh", async () => {
    const zip = buatZip([{ nama: "Rapor-Siti-Nurhaliza-Ça-é-日本.pdf", isi: enc("x") }], WAKTU);
    const baca = await JSZip.loadAsync(zip);
    expect(Object.keys(baca.files)).toEqual(["Rapor-Siti-Nurhaliza-Ça-é-日本.pdf"]);
  });

  it("ZIP kosong tetap sah (22 byte)", async () => {
    const zip = buatZip([], WAKTU);
    expect(zip.length).toBe(22);
    expect(Object.keys((await JSZip.loadAsync(zip)).files)).toEqual([]);
  });

  it("tanggal dan jam berkas tersimpan (gaya DOS, ketelitian 2 detik)", async () => {
    const baca = await JSZip.loadAsync(buatZip([{ nama: "a.pdf", isi: enc("a") }], WAKTU));
    const d = baca.file("a.pdf")!.date;
    // jszip membaca bidang DOS apa adanya sebagai UTC: yang ditulis memang jam setempat 14.30.44
    expect([d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]).toEqual([2026, 9, 13, 14, 30, 44]);
  });

  it("banyak berkas (300) tetap benar dan berurutan", async () => {
    const berkas = Array.from({ length: 300 }, (_, i) => ({ nama: `b${i}.txt`, isi: enc(`isi ${i}`) }));
    const baca = await JSZip.loadAsync(buatZip(berkas, WAKTU), { checkCRC32: true });
    expect(Object.keys(baca.files)).toHaveLength(300);
    expect(await baca.file("b299.txt")!.async("string")).toBe("isi 299");
  });

  it("melebihi batas format ZIP biasa ditolak dengan pesan jelas", () => {
    const banyak = Array.from({ length: 65_536 }, (_, i) => ({ nama: `${i}`, isi: new Uint8Array(0) }));
    expect(() => buatZip(banyak)).toThrow(/paling banyak/);
  });
});

describe("nama berkas di dalam ZIP", () => {
  it("bersihkanNamaZip: tanpa jalur, karakter kendali, titik di awal; tidak pernah kosong; dipotong", () => {
    expect(bersihkanNamaZip("a/b\\c.pdf")).toBe("a-b-c.pdf");
    expect(bersihkanNamaZip(".rahasia")).toBe("rahasia");
    expect(bersihkanNamaZip("x\u0000y\u001f.pdf")).toBe("xy.pdf");
    expect(bersihkanNamaZip('a<b>c:"d"|e?f*.pdf')).toBe("abcdef.pdf");
    expect(bersihkanNamaZip("   ")).toBe("berkas");
    expect(bersihkanNamaZip("x".repeat(400)).length).toBe(150);
    expect(bersihkanNamaZip("../../etc/passwd")).not.toContain("/");
  });

  it("namaUnik: nama kembar diberi nomor sebelum ekstensi tanpa membedakan huruf besar kecil, urutan tetap", () => {
    expect(namaUnik(["a.pdf", "a.pdf", "A.PDF", "b.pdf", "a.pdf"])).toEqual(["a.pdf", "a (2).pdf", "A (3).PDF", "b.pdf", "a (4).pdf"]);
    expect(namaUnik(["a.pdf", "a (2).pdf", "a.pdf"])).toEqual(["a.pdf", "a (2).pdf", "a (3).pdf"]);
    expect(namaUnik(["tanpa-ekstensi", "tanpa-ekstensi"])).toEqual(["tanpa-ekstensi", "tanpa-ekstensi (2)"]);
    expect(namaUnik([])).toEqual([]);
  });
});

describe("namaDariKepala", () => {
  it("membaca filename dari Content-Disposition", () => {
    expect(namaDariKepala('attachment; filename="Rapor-Budi-2026-10-13.pdf"')).toBe("Rapor-Budi-2026-10-13.pdf");
    expect(namaDariKepala("attachment; filename=rapor.pdf")).toBe("rapor.pdf");
    expect(namaDariKepala("attachment; filename*=UTF-8''Rapor%20Siti.pdf")).toBe("Rapor Siti.pdf");
    expect(namaDariKepala(null)).toBeNull();
    expect(namaDariKepala("inline")).toBeNull();
  });
});

describe("unduhMassal", () => {
  const items = (n: number): ItemUnduh[] => Array.from({ length: n }, (_, i) => ({ attemptId: `att-${i}`, nama: `Siswa ${i}` }));
  const pdf = (isi: string) => enc(`%PDF-1.7 ${isi}`);
  const balas = (o: { status?: number; isi?: Uint8Array; kepala?: string | null; json?: unknown }) => ({
    ok: (o.status ?? 200) < 400,
    status: o.status ?? 200,
    arrayBuffer: async () => (o.isi ?? pdf("x")).buffer.slice((o.isi ?? pdf("x")).byteOffset, (o.isi ?? pdf("x")).byteOffset + (o.isi ?? pdf("x")).byteLength) as ArrayBuffer,
    json: async () => {
      if (o.json === undefined) throw new Error("bukan json");
      return o.json;
    },
    headers: { get: (n: string) => (n.toLowerCase() === "content-disposition" ? (o.kepala ?? null) : null) },
  });
  const bacaIsi = async (zip: Uint8Array) => {
    const baca = await JSZip.loadAsync(zip, { checkCRC32: true });
    return Object.fromEntries(await Promise.all(Object.keys(baca.files).map(async (n) => [n, await baca.file(n)!.async("string")] as const)));
  };

  it("semua berhasil: ZIP berisi tiap PDF berurutan dengan nama dari server; kemajuan dilaporkan; memanggil rute rapor yang benar", async () => {
    const urls: string[] = [];
    const kemajuan: number[] = [];
    const hasil = await unduhMassal(items(3), {
      ambil: async (url) => {
        urls.push(url);
        const n = url.match(/att-(\d)/)![1];
        return balas({ isi: pdf(`rapor ${n}`), kepala: `attachment; filename="Rapor-Siswa-${n}.pdf"` });
      },
      padaKemajuan: (k) => kemajuan.push(k.selesai),
      jedaUlang: 0,
      sekarang: WAKTU,
    });
    expect(hasil).toMatchObject({ berhasil: 3, gagal: [], dibatalkan: false });
    expect(urls.sort()).toEqual(["/api/siswa/attempts/att-0/rapor", "/api/siswa/attempts/att-1/rapor", "/api/siswa/attempts/att-2/rapor"]);
    expect(await bacaIsi(hasil.zip!)).toEqual({
      "Rapor-Siswa-0.pdf": "%PDF-1.7 rapor 0",
      "Rapor-Siswa-1.pdf": "%PDF-1.7 rapor 1",
      "Rapor-Siswa-2.pdf": "%PDF-1.7 rapor 2",
    });
    expect(kemajuan[0]).toBe(0);
    expect(kemajuan.at(-1)).toBe(3);
    expect(kemajuan).toEqual([...kemajuan].sort((a, b) => a - b));
  });

  it("tanpa nama dari server: nama cadangan dari nama siswa; nama kembar diberi nomor", async () => {
    const hasil = await unduhMassal([{ attemptId: "a", nama: "Budi" }, { attemptId: "b", nama: "Budi" }], {
      ambil: async () => balas({ kepala: 'attachment; filename="Sama.pdf"' }),
      jedaUlang: 0,
    });
    expect(Object.keys(await bacaIsi(hasil.zip!))).toEqual(["Sama.pdf", "Sama (2).pdf"]);
    const cadangan = await unduhMassal([{ attemptId: "a", nama: "Budi" }], { ambil: async () => balas({}), jedaUlang: 0 });
    expect(Object.keys(await bacaIsi(cadangan.zip!))).toEqual(["Rapor-Budi.pdf"]);
  });

  it("satu rapor ditolak server (403/404/409): dicatat dengan pesan servernya, yang lain tetap masuk; tidak diulang", async () => {
    let panggilan = 0;
    const hasil = await unduhMassal(items(3), {
      ambil: async (url) => {
        if (url.includes("att-1")) {
          panggilan++;
          return balas({ status: 409, json: { error: "Rapor PDF hanya untuk percobaan pertama." } });
        }
        return balas({});
      },
      jedaUlang: 0,
    });
    expect(panggilan).toBe(1);
    expect(hasil.berhasil).toBe(2);
    expect(hasil.gagal).toEqual([{ nama: "Siswa 1", alasan: "Rapor PDF hanya untuk percobaan pertama." }]);
    expect(Object.keys(await bacaIsi(hasil.zip!))).toHaveLength(2);
  });

  it("galat jaringan dan 5xx dicoba ulang (sampai 3 kali) lalu berhasil atau dicatat gagal", async () => {
    const hitung: Record<string, number> = {};
    const hasil = await unduhMassal(items(3), {
      ambil: async (url) => {
        const id = url.match(/att-\d/)![0];
        hitung[id] = (hitung[id] ?? 0) + 1;
        if (id === "att-0" && hitung[id] < 3) throw new Error("jaringan putus");
        if (id === "att-1" && hitung[id] < 2) return balas({ status: 503, json: { error: "sibuk" } });
        if (id === "att-2") return balas({ status: 500 });
        return balas({});
      },
      jedaUlang: 0,
    });
    expect(hitung).toEqual({ "att-0": 3, "att-1": 2, "att-2": 3 });
    expect(hasil.berhasil).toBe(2);
    expect(hasil.gagal).toEqual([{ nama: "Siswa 2", alasan: "Server menjawab 500." }]);
  });

  it("jawaban yang bukan PDF (mis. halaman galat) ditolak", async () => {
    const hasil = await unduhMassal(items(1), { ambil: async () => balas({ isi: enc("<html>galat</html>") }), jedaUlang: 0 });
    expect(hasil.zip).toBeNull();
    expect(hasil.gagal).toEqual([{ nama: "Siswa 0", alasan: "Jawaban server bukan berkas PDF." }]);
  });

  it("semua gagal: tanpa ZIP; daftar kosong: tanpa permintaan dan tanpa ZIP", async () => {
    const semuaGagal = await unduhMassal(items(2), { ambil: async () => balas({ status: 403, json: { error: "Tidak diizinkan." } }), jedaUlang: 0 });
    expect(semuaGagal).toMatchObject({ zip: null, berhasil: 0, dibatalkan: false });
    expect(semuaGagal.gagal).toHaveLength(2);
    let dipanggil = false;
    const kosong = await unduhMassal([], { ambil: async () => { dipanggil = true; return balas({}); } });
    expect(kosong).toMatchObject({ zip: null, berhasil: 0, gagal: [] });
    expect(dipanggil).toBe(false);
  });

  it("paling banyak 2 permintaan berjalan bersamaan (bawaan) atau sesuai opsi", async () => {
    for (const [paralel, harap] of [[undefined, 2], [1, 1], [3, 3]] as const) {
      let jalan = 0;
      let maks = 0;
      await unduhMassal(items(9), {
        paralel,
        ambil: async () => {
          jalan++;
          maks = Math.max(maks, jalan);
          await new Promise((r) => setTimeout(r, 3));
          jalan--;
          return balas({});
        },
        jedaUlang: 0,
      });
      expect(maks, `paralel ${paralel}`).toBe(harap);
    }
  });

  it("dibatalkan: berhenti mengambil rapor baru dan tidak menghasilkan ZIP", async () => {
    const pembatal = new AbortController();
    let diambil = 0;
    const hasil = await unduhMassal(items(20), {
      sinyal: pembatal.signal,
      ambil: async () => {
        diambil++;
        if (diambil === 3) pembatal.abort();
        return balas({});
      },
      jedaUlang: 0,
    });
    expect(hasil).toMatchObject({ zip: null, dibatalkan: true });
    expect(diambil).toBeLessThan(20);
  });

  it("batas jumlah rapor per ZIP tercatat sebagai konstanta", () => {
    expect(MAKS_BERKAS_UNDUH_MASSAL).toBe(150);
  });
});
