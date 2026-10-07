import { describe, expect, it } from "vitest";
import { buatPencocokIndikator, cocokkanSoalDenganSumber, type MasterRingkas } from "@/lib/indikator/pencocokan";
import { kunciTeksIndikator } from "@/lib/indikator/normalisasi";

const m = (id: string, jenjang: string, namaMapel: string, indikator: string): MasterRingkas => ({
  id,
  jenjang,
  namaMapel,
  teksKunci: kunciTeksIndikator(indikator),
});

const MASTER = [
  m("sd-mat-1", "SD", "Matematika", "Menentukan representasi pecahan dari bagian suatu objek utuh. (1)"),
  m("smp-mat-1", "SMP", "Matematika", "Menyelesaikan operasi bilangan bentuk pangkat (1)"),
  m("smp-bin-12", "SMP", "Bahasa Indonesia", "Menilai ketepatan antara ilustrasi dengan isi teks. (12)"),
  m("smp-bin-1", "SMP", "Bahasa Indonesia", "Menyelesaikan operasi bilangan bentuk pangkat (1)"), // teks sama, mapel beda
];

describe("buatPencocokIndikator", () => {
  const cocok = buatPencocokIndikator(MASTER);

  it("teks persis sama pada jenjang dan mapel yang sama -> id indikator resmi", () => {
    expect(cocok({ jenjang: "SD/MI", mapel: "Matematika", indikator: "Menentukan representasi pecahan dari bagian suatu objek utuh. (1)" })).toBe("sd-mat-1");
    expect(cocok({ jenjang: "SMP/MTs", mapel: "Matematika", indikator: "Menyelesaikan operasi bilangan bentuk pangkat (1)" })).toBe("smp-mat-1");
  });

  it("perbedaan spasi dan huruf besar/kecil tidak menghalangi kecocokan", () => {
    expect(cocok({ jenjang: "SMP", mapel: "Matematika", indikator: "  MENYELESAIKAN operasi   bilangan bentuk pangkat (1) " })).toBe("smp-mat-1");
    expect(cocok({ jenjang: "SMP", mapel: " matematika ", indikator: "Menyelesaikan operasi bilangan bentuk pangkat (1)" })).toBe("smp-mat-1");
  });

  it("jenjang berbeda -> tidak cocok walau teks dan mapel sama", () => {
    expect(cocok({ jenjang: "SD/MI", mapel: "Matematika", indikator: "Menyelesaikan operasi bilangan bentuk pangkat (1)" })).toBeNull();
  });

  it("mapel berbeda memilih master mapel itu sendiri (teks yang sama di dua mapel tidak tertukar)", () => {
    expect(cocok({ jenjang: "SMP", mapel: "Bahasa Indonesia", indikator: "Menyelesaikan operasi bilangan bentuk pangkat (1)" })).toBe("smp-bin-1");
    expect(cocok({ jenjang: "SMP", mapel: "Matematika", indikator: "Menyelesaikan operasi bilangan bentuk pangkat (1)" })).toBe("smp-mat-1");
  });

  it("TIDAK mencocokkan lewat nomor: nomor (12) yang sama tetapi teks beda = tidak cocok (kasus nyata generator vs resmi)", () => {
    expect(cocok({ jenjang: "SMP", mapel: "Bahasa Indonesia", indikator: "Menilai dampak sosial ekonomi berdasarkan isi teks bacaan. (12)" })).toBeNull();
    expect(cocok({ jenjang: "SD", mapel: "Matematika", indikator: "Menentukan pecahan senilai dari suatu gambar (1)" })).toBeNull();
  });

  it("TIDAK mencocokkan teks yang hanya mirip (beda tanda baca atau satu kata)", () => {
    expect(cocok({ jenjang: "SMP", mapel: "Bahasa Indonesia", indikator: "Menilai ketepatan antara ilustrasi dengan isi teks (12)" })).toBeNull(); // titik hilang
    expect(cocok({ jenjang: "SMP", mapel: "Bahasa Indonesia", indikator: "Menilai ketepatan antara gambar dengan isi teks. (12)" })).toBeNull();
  });

  it("indikator kosong/null/spasi, mapel kosong, atau jenjang tak dikenal -> null", () => {
    expect(cocok({ jenjang: "SMP", mapel: "Matematika", indikator: null })).toBeNull();
    expect(cocok({ jenjang: "SMP", mapel: "Matematika", indikator: undefined })).toBeNull();
    expect(cocok({ jenjang: "SMP", mapel: "Matematika", indikator: "   " })).toBeNull();
    expect(cocok({ jenjang: "SMP", mapel: "", indikator: "Menyelesaikan operasi bilangan bentuk pangkat (1)" })).toBeNull();
    expect(cocok({ jenjang: "SMK", mapel: "Matematika", indikator: "Menyelesaikan operasi bilangan bentuk pangkat (1)" })).toBeNull();
  });

  it("master kosong -> semua null (master belum diunggah)", () => {
    expect(buatPencocokIndikator([])({ jenjang: "SMP", mapel: "Matematika", indikator: "apa saja" })).toBeNull();
  });
});

describe("cocokkanSoalDenganSumber (backfill soal yang sudah diimpor)", () => {
  it("soal dengan teks yang sama persis diberi teks indikator sumbernya", () => {
    const r = cocokkanSoalDenganSumber(
      [{ id: "q1", teks: "Berapa 2+2?" }, { id: "q2", teks: "Siapa penulisnya?" }],
      [{ teks: "Berapa 2+2?", indikator: "Ind A (1)" }, { teks: "Siapa penulisnya?", indikator: "Ind B (2)" }],
    );
    expect(Object.fromEntries(r.cocok)).toEqual({ q1: "Ind A (1)", q2: "Ind B (2)" });
    expect(r).toMatchObject({ ambigu: 0, tanpaSumber: 0, sumberTanpaIndikator: 0 });
  });

  it("teks yang diubah sedikit saja (mis. spasi) TIDAK dicocokkan - lebih baik kosong daripada salah soal", () => {
    const r = cocokkanSoalDenganSumber([{ id: "q1", teks: "Berapa 2+2? " }], [{ teks: "Berapa 2+2?", indikator: "Ind A (1)" }]);
    expect(r.cocok.size).toBe(0);
    expect(r.tanpaSumber).toBe(1);
  });

  it("teks sama dengan indikator berbeda di sumber -> ambigu, dilewati", () => {
    const r = cocokkanSoalDenganSumber(
      [{ id: "q1", teks: "Soal kembar" }],
      [{ teks: "Soal kembar", indikator: "Ind A (1)" }, { teks: "Soal kembar", indikator: "Ind B (2)" }],
    );
    expect(r.cocok.size).toBe(0);
    expect(r.ambigu).toBe(1);
  });

  it("teks sama dengan indikator sama di sumber (duplikat murni) -> tetap cocok", () => {
    const r = cocokkanSoalDenganSumber(
      [{ id: "q1", teks: "Soal kembar" }],
      [{ teks: "Soal kembar", indikator: "Ind A (1)" }, { teks: "Soal kembar", indikator: "Ind A (1)" }],
    );
    expect(r.cocok.get("q1")).toBe("Ind A (1)");
  });

  it("dua soal ayotka berteks sama sama-sama mendapat indikator sumbernya", () => {
    const r = cocokkanSoalDenganSumber([{ id: "q1", teks: "T" }, { id: "q2", teks: "T" }], [{ teks: "T", indikator: "Ind (1)" }]);
    expect([...r.cocok.keys()].sort()).toEqual(["q1", "q2"]);
  });

  it("soal tanpa sumber dan sumber tanpa indikator dihitung terpisah", () => {
    const r = cocokkanSoalDenganSumber(
      [{ id: "q1", teks: "Hilang" }, { id: "q2", teks: "Tanpa indikator" }, { id: "q3", teks: "Ada" }],
      [{ teks: "Tanpa indikator", indikator: null }, { teks: "Ada", indikator: "  Ind (3) " }, { teks: "Lain", indikator: "Ind (4)" }],
    );
    expect(Object.fromEntries(r.cocok)).toEqual({ q3: "Ind (3)" });
    expect(r.tanpaSumber).toBe(1);
    expect(r.sumberTanpaIndikator).toBe(1);
  });

  it("teks sama dengan satu sumber berindikator dan satu tanpa indikator -> memakai yang berindikator", () => {
    const r = cocokkanSoalDenganSumber([{ id: "q1", teks: "T" }], [{ teks: "T", indikator: null }, { teks: "T", indikator: "Ind (1)" }]);
    expect(r.cocok.get("q1")).toBe("Ind (1)");
  });

  it("masukan kosong aman", () => {
    expect(cocokkanSoalDenganSumber([], []).cocok.size).toBe(0);
    expect(cocokkanSoalDenganSumber([{ id: "q", teks: "x" }], []).tanpaSumber).toBe(1);
  });
});
