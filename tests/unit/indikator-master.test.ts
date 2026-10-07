import { describe, expect, it } from "vitest";
import { hierarkiIndikator, jumlahTingkatHierarki, MAKS_BARIS_MASTER, parseMasterJson } from "@/lib/indikator/master";
import { kodeJenjangMaster, kunciMaster, kunciTeksIndikator } from "@/lib/indikator/normalisasi";

const MAT = {
  jenjang: "SMP",
  kd_mapel: "MATP",
  nama_mapel: "Matematika",
  elemen: "Bilangan",
  subelemen: "Bilangan Real",
  kompetensi: "Kemampuan memahami, mengaplikasikan, dan bernalar yang lebih tinggi untuk menyelesaikan permasalahan",
  subkompetensi: "-",
  indikator: "Menyelesaikan operasi bilangan bentuk pangkat (1)",
  urutan: 1,
  nilai_nasional: 34.09,
};
const BIN = {
  jenjang: "SMP",
  kd_mapel: "BINP",
  nama_mapel: "Bahasa Indonesia",
  elemen: "Pemahaman Tekstual",
  subelemen: "Mengidentifikasi penggunaan istilah dalam berbagai bidang.",
  kompetensi: "Mengidentifikasi penggunaan istilah dalam berbagai bidang.",
  indikator: "Mengidentifikasi makna penggunaan istilah bidang tertentu dalam teks. (1)",
  urutan: 1,
  nilai_nasional: 60.05,
};

describe("kunciTeksIndikator", () => {
  it("spasi berurutan dan di tepi dirapikan, huruf dibuat kecil", () => {
    expect(kunciTeksIndikator("  Menyelesaikan   operasi\tbilangan\n pangkat (1) ")).toBe("menyelesaikan operasi bilangan pangkat (1)");
  });
  it("null/undefined/kosong -> string kosong", () => {
    expect(kunciTeksIndikator(null)).toBe("");
    expect(kunciTeksIndikator(undefined)).toBe("");
    expect(kunciTeksIndikator("   ")).toBe("");
  });
  it("TIDAK mengabaikan tanda baca atau nomor: teks beda tetap beda", () => {
    expect(kunciTeksIndikator("Menilai x. (12)")).not.toBe(kunciTeksIndikator("Menilai x (12)"));
    expect(kunciTeksIndikator("Menilai x (11)")).not.toBe(kunciTeksIndikator("Menilai x (12)"));
  });
});

describe("kodeJenjangMaster", () => {
  it("mengenali nama jenjang dari generator maupun ayotka", () => {
    expect(kodeJenjangMaster("SD/MI")).toBe("SD");
    expect(kodeJenjangMaster("SMP/MTs")).toBe("SMP");
    expect(kodeJenjangMaster("SD")).toBe("SD");
    expect(kodeJenjangMaster(" smp ")).toBe("SMP");
    expect(kodeJenjangMaster("SMA")).toBe("SMA");
  });
  it("tak dikenali -> null (SMK/SMAxx tidak dianggap SMA)", () => {
    expect(kodeJenjangMaster("SMK")).toBeNull();
    expect(kodeJenjangMaster("SMAN 1")).toBeNull();
    expect(kodeJenjangMaster("")).toBeNull();
    expect(kodeJenjangMaster(null)).toBeNull();
  });
});

describe("kunciMaster", () => {
  it("nama mapel dibandingkan tanpa beda huruf besar/spasi tepi", () => {
    expect(kunciMaster("SD", " Matematika ", "x")).toBe(kunciMaster("SD", "matematika", "x"));
  });
  it("jenjang dan mapel berbeda -> kunci berbeda", () => {
    expect(kunciMaster("SD", "Matematika", "x")).not.toBe(kunciMaster("SMP", "Matematika", "x"));
    expect(kunciMaster("SD", "Matematika", "x")).not.toBe(kunciMaster("SD", "Bahasa Indonesia", "x"));
  });
});

describe("parseMasterJson", () => {
  it("baris Matematika dan Bahasa yang sah diterima dan dipetakan ke bentuk database", () => {
    const r = parseMasterJson([MAT, BIN]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.baris).toHaveLength(2);
    expect(r.baris[0]).toEqual({
      jenjang: "SMP",
      kdMapel: "MATP",
      namaMapel: "Matematika",
      elemen: "Bilangan",
      subelemen: "Bilangan Real",
      kompetensi: MAT.kompetensi,
      subkompetensi: null, // "-" berarti tidak ada
      indikator: "Menyelesaikan operasi bilangan bentuk pangkat (1)",
      teksKunci: "menyelesaikan operasi bilangan bentuk pangkat (1)",
      urutan: 1,
      nilaiNasional: 34.09,
    });
    expect(r.baris[1]!.subkompetensi).toBeNull(); // kunci subkompetensi tidak ada sama sekali di baris Bahasa
  });

  it("subkompetensi berisi teks dipertahankan; kosong atau '-' menjadi null", () => {
    const r = parseMasterJson([
      { ...MAT, subkompetensi: "Sub A" },
      { ...MAT, indikator: "Lain (2)", subkompetensi: "" },
      { ...MAT, indikator: "Lain (3)", subkompetensi: "-" },
      { ...MAT, indikator: "Lain (4)", subkompetensi: null },
    ]);
    expect(r.ok && r.baris.map((b) => b.subkompetensi)).toEqual(["Sub A", null, null, null]);
  });

  it("nilai_nasional kosong/null diterima sebagai null; di luar 0-100 ditolak", () => {
    const tanpa: Record<string, unknown> = { ...MAT };
    delete tanpa.nilai_nasional;
    const ok = parseMasterJson([tanpa, { ...MAT, indikator: "B (2)", nilai_nasional: null }, { ...MAT, indikator: "C (3)", nilai_nasional: 0 }, { ...MAT, indikator: "D (4)", nilai_nasional: 100 }]);
    expect(ok.ok && ok.baris.map((b) => b.nilaiNasional)).toEqual([null, null, 0, 100]);
    for (const buruk of [-0.1, 100.1, "60", NaN]) {
      const r = parseMasterJson([{ ...MAT, nilai_nasional: buruk }]);
      expect(r.ok, String(buruk)).toBe(false);
    }
  });

  it("teks dirapikan (trim) dan kunci teks dihitung dari teks yang sudah dirapikan", () => {
    const r = parseMasterJson([{ ...MAT, indikator: "  Menyelesaikan   operasi (1)  ", elemen: "  Bilangan " }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.baris[0]!.indikator).toBe("Menyelesaikan   operasi (1)");
    expect(r.baris[0]!.teksKunci).toBe("menyelesaikan operasi (1)");
    expect(r.baris[0]!.elemen).toBe("Bilangan");
  });

  it("bukan larik, larik kosong, atau terlalu banyak baris -> ditolak dengan pesan", () => {
    expect(parseMasterJson({ data: [] })).toEqual({ ok: false, galat: ["Isi berkas harus berupa larik (array) indikator."] });
    expect(parseMasterJson(null).ok).toBe(false);
    expect(parseMasterJson("teks").ok).toBe(false);
    expect(parseMasterJson([])).toEqual({ ok: false, galat: ["Berkas tidak berisi indikator."] });
    const r = parseMasterJson(new Array(MAKS_BARIS_MASTER + 1).fill(MAT));
    expect(r.ok).toBe(false);
  });

  it("kolom wajib hilang/kosong/salah tipe -> galat menyebut nomor baris dan kolomnya", () => {
    const { indikator: _hapus, ...tanpaIndikator } = MAT;
    void _hapus;
    const r = parseMasterJson([MAT, tanpaIndikator, { ...MAT, jenjang: "SMK" }, { ...MAT, urutan: "1" }, { ...MAT, elemen: "   " }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const semua = r.galat.join("\n");
    expect(semua).toMatch(/Baris 2: indikator/);
    expect(semua).toMatch(/Baris 3: jenjang/);
    expect(semua).toMatch(/Baris 4: urutan/);
    expect(semua).toMatch(/Baris 5: elemen/);
    expect(semua).not.toMatch(/Baris 1:/);
  });

  it("satu berkas dengan satu baris cacat ditolak SELURUHNYA (tidak mengimpor sebagian)", () => {
    const r = parseMasterJson([MAT, { ...BIN, jenjang: "XX" }]);
    expect(r.ok).toBe(false);
  });

  it("indikator ganda pada jenjang+mapel yang sama (walau beda spasi/huruf) ditolak; jenjang atau mapel lain boleh", () => {
    const dobel = parseMasterJson([MAT, { ...MAT, indikator: "  MENYELESAIKAN operasi   bilangan bentuk pangkat (1) " }]);
    expect(dobel.ok).toBe(false);
    if (!dobel.ok) expect(dobel.galat[0]).toMatch(/Baris 2: indikator sama dengan baris 1/);
    expect(parseMasterJson([MAT, { ...MAT, jenjang: "SD" }]).ok).toBe(true);
    expect(parseMasterJson([MAT, { ...MAT, nama_mapel: "Bahasa Indonesia" }]).ok).toBe(true);
  });

  it("daftar galat dibatasi 20 + ringkasan sisanya", () => {
    const r = parseMasterJson(new Array(50).fill({ ...MAT, jenjang: "XX" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.galat).toHaveLength(21);
    expect(r.galat[20]).toMatch(/dan \d+ galat lain/);
  });
});

describe("hierarkiIndikator", () => {
  it("Matematika: 4 tingkat Elemen > Subelemen > Kompetensi > Indikator", () => {
    expect(jumlahTingkatHierarki("Matematika")).toBe(4);
    const h = hierarkiIndikator({ namaMapel: "Matematika", elemen: "Bilangan", subelemen: "Bilangan Real", kompetensi: "Kemampuan X", indikator: "Ind (1)" });
    expect(h.label).toEqual(["Elemen", "Subelemen", "Kompetensi", "Indikator"]);
    expect(h.nilai).toEqual(["Bilangan", "Bilangan Real", "Kemampuan X", "Ind (1)"]);
  });

  it("Bahasa Indonesia: 3 tingkat Kompetensi > Subkompetensi > Indikator, TANPA label Elemen/Subelemen", () => {
    expect(jumlahTingkatHierarki("Bahasa Indonesia")).toBe(3);
    const h = hierarkiIndikator({
      namaMapel: "Bahasa Indonesia",
      elemen: "Pemahaman Tekstual",
      subelemen: "Mengidentifikasi istilah",
      kompetensi: "Mengidentifikasi istilah",
      indikator: "Ind (1)",
    });
    expect(h.label).toEqual(["Kompetensi", "Subkompetensi", "Indikator"]);
    expect(h.nilai).toEqual(["Pemahaman Tekstual", "Mengidentifikasi istilah", "Ind (1)"]);
    expect(h.label.join(" ")).not.toMatch(/Elemen|Subelemen/);
  });

  it("mapel lain (mis. Bahasa Inggris, PPKn) memakai 3 tingkat", () => {
    expect(jumlahTingkatHierarki("Bahasa Inggris")).toBe(3);
    expect(jumlahTingkatHierarki("PPKn")).toBe(3);
  });

  it("nama mapel Matematika dikenali tanpa peduli huruf besar", () => {
    expect(jumlahTingkatHierarki("matematika")).toBe(4);
    expect(jumlahTingkatHierarki("MATEMATIKA")).toBe(4);
  });
});
