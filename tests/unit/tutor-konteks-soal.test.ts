import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shuffleWithSeed } from "@/lib/exam/shuffle";
import { susunKonteksTutor, type SoalUntukTutor } from "@/lib/tutor/konteks-soal";
import { MAKS_TEKS_SOAL, MAKS_TEKS_STIMULUS } from "@/lib/tutor/konstanta";

const ATTEMPT = "att-123";

const soalPg = (o: Partial<SoalUntukTutor> = {}): SoalUntukTutor => ({
  id: "q1",
  format: "pg",
  teks: "Hasil dari 2 + 3 adalah ...",
  pembahasan: "2 + 3 = 5.",
  options: [
    { id: "o1", teks: "4", isCorrect: false, urutan: 1 },
    { id: "o2", teks: "5", isCorrect: true, urutan: 2 },
    { id: "o3", teks: "6", isCorrect: false, urutan: 3 },
    { id: "o4", teks: "7", isCorrect: false, urutan: 4 },
  ],
  statements: [],
  categories: [],
  stimulus: null,
  ...o,
});

const susun = (soal: SoalUntukTutor, jawabanJson: unknown, acakOpsi = false, attemptId = ATTEMPT) =>
  susunKonteksTutor({ attemptId, acakOpsi, jenjang: "SMP", mapel: "Matematika", soal, jawabanJson });

describe("susunKonteksTutor - pilihan ganda", () => {
  it("tanpa pengacakan: label A-D menurut urutan, kunci dan jawaban siswa berupa label", () => {
    const k = susun(soalPg(), { option_id: "o3" });
    expect(k.opsi).toEqual([
      { label: "A", text: "4" },
      { label: "B", text: "5" },
      { label: "C", text: "6" },
      { label: "D", text: "7" },
    ]);
    expect(k.kunci_jawaban).toBe("B");
    expect(k.jawaban_siswa).toBe("C");
  });

  it("opsi diurutkan menurut `urutan`, bukan menurut urutan array masukan", () => {
    const soal = soalPg({ options: [...soalPg().options].reverse() });
    expect(susun(soal, null).opsi?.map((o) => o.text)).toEqual(["4", "5", "6", "7"]);
  });

  it("dengan pengacakan: label mengikuti urutan acak yang SAMA dengan yang dilihat siswa (benih per percobaan + soal)", () => {
    const soal = soalPg();
    const acak = shuffleWithSeed(soal.options, `${ATTEMPT}:opsi:${soal.id}`);
    const labelKunci = String.fromCharCode(65 + acak.findIndex((o) => o.isCorrect));
    const labelPilih = String.fromCharCode(65 + acak.findIndex((o) => o.id === "o3"));
    const k = susun(soal, { option_id: "o3" }, true);
    expect(k.opsi?.map((o) => o.text)).toEqual(acak.map((o) => o.teks));
    expect(k.kunci_jawaban).toBe(labelKunci);
    expect(k.jawaban_siswa).toBe(labelPilih);
  });

  it("hasilnya deterministik untuk percobaan yang sama, dan teks kunci selalu tetap menunjuk opsi yang benar", () => {
    const soal = soalPg();
    const a = susun(soal, null, true);
    const b = susun(soal, null, true);
    expect(a).toEqual(b);
    const teksKunci = a.opsi?.find((o) => o.label === a.kunci_jawaban)?.text;
    expect(teksKunci).toBe("5");
  });

  it("percobaan berbeda boleh punya urutan berbeda, tetapi kunci tetap menunjuk teks yang benar", () => {
    for (const id of ["att-a", "att-b", "att-c", "att-d", "att-e"]) {
      const k = susun(soalPg(), { option_id: "o2" }, true, id);
      expect(k.opsi?.find((o) => o.label === k.kunci_jawaban)?.text).toBe("5");
      expect(k.jawaban_siswa).toBe(k.kunci_jawaban); // siswa memilih opsi kunci
    }
  });

  it("belum dijawab atau jawaban tak masuk akal: tidak ada jawaban_siswa dan tidak melempar galat", () => {
    for (const j of [null, undefined, {}, [], "x", 5, { option_id: 7 }, { option_id: "tidak-ada" }, { option_id: "" }]) {
      expect(susun(soalPg(), j).jawaban_siswa).toBeUndefined();
    }
  });

  it("mode selalu socratic, jenjang dan mapel diteruskan, soalId tidak pernah dikirim", () => {
    const k = susun(soalPg(), null) as Record<string, unknown>;
    expect(k.mode).toBe("socratic");
    expect(k.jenjang).toBe("SMP");
    expect(k.mapel).toBe("Matematika");
    expect("soalId" in k).toBe(false);
  });

  it("pembahasan dan stimulus ikut bila ada; judul stimulus ditaruh di depan", () => {
    const k = susun(soalPg({ stimulus: { konten: "Wacana panjang.", judul: "Kebun" } }), null);
    expect(k.pembahasan).toBe("2 + 3 = 5.");
    expect(k.stimulus).toBe("Kebun\nWacana panjang.");
    const tanpa = susun(soalPg({ pembahasan: null }), null);
    expect(tanpa.pembahasan).toBeUndefined();
    expect(tanpa.stimulus).toBeUndefined();
  });

  it("teks yang sangat panjang dipotong agar permintaan tidak membengkak", () => {
    const k = susun(soalPg({ teks: "x".repeat(MAKS_TEKS_SOAL + 500), stimulus: { konten: "y".repeat(MAKS_TEKS_STIMULUS + 500), judul: null } }), null);
    expect(k.soal_text.length).toBe(MAKS_TEKS_SOAL + 3);
    expect(k.stimulus!.length).toBe(MAKS_TEKS_STIMULUS + 3);
  });
});

describe("susunKonteksTutor - pilihan ganda kompleks", () => {
  const kompleks = soalPg({
    format: "pg_kompleks",
    options: [
      { id: "a", teks: "Satu", isCorrect: true, urutan: 1 },
      { id: "b", teks: "Dua", isCorrect: false, urutan: 2 },
      { id: "c", teks: "Tiga", isCorrect: true, urutan: 3 },
    ],
  });

  it("kunci berupa daftar label terurut; jawaban siswa digabung dengan koma", () => {
    const k = susun(kompleks, { option_ids: ["c", "b"] });
    expect(k.kunci_jawaban).toEqual(["A", "C"]);
    expect(k.jawaban_siswa).toBe("B, C");
  });

  it("label tetap benar saat opsi diacak", () => {
    const acak = shuffleWithSeed(kompleks.options, `${ATTEMPT}:opsi:${kompleks.id}`);
    const kunci = acak.map((o, i) => (o.isCorrect ? String.fromCharCode(65 + i) : null)).filter(Boolean).sort();
    expect(susun(kompleks, null, true).kunci_jawaban).toEqual(kunci);
  });

  it("id opsi yang tidak dikenal diabaikan; semuanya tak dikenal = tidak ada jawaban", () => {
    expect(susun(kompleks, { option_ids: ["a", "tidak-ada", 5] }).jawaban_siswa).toBe("A");
    expect(susun(kompleks, { option_ids: ["x"] }).jawaban_siswa).toBeUndefined();
    expect(susun(kompleks, { option_ids: [] }).jawaban_siswa).toBeUndefined();
    expect(susun(kompleks, { option_ids: "a" }).jawaban_siswa).toBeUndefined();
  });
});

describe("susunKonteksTutor - pilihan ganda kategori", () => {
  const kategori = soalPg({
    format: "pg_kategori",
    teks: "Tentukan kategori pernyataan berikut.",
    options: [],
    categories: [
      { id: "kb", label: "Benar", urutan: 1 },
      { id: "ks", label: "Salah", urutan: 2 },
    ],
    statements: [
      { id: "s1", teks: "2 + 2 = 4", correctCategoryId: "kb", urutan: 1 },
      { id: "s2", teks: "3 x 3 = 6", correctCategoryId: "ks", urutan: 2 },
      { id: "s3", teks: "10 - 5 = 5", correctCategoryId: "kb", urutan: 3 },
      { id: "s4", teks: "7 + 8 = 16", correctCategoryId: "ks", urutan: 4 },
      { id: "s5", teks: "9 - 4 = 5", correctCategoryId: "kb", urutan: 5 },
      { id: "s6", teks: "6 x 2 = 13", correctCategoryId: "ks", urutan: 6 },
    ],
  });

  it("penjaga: fixture ini memang menghasilkan urutan acak yang BERBEDA dari urutan asli (kalau tidak, tes pengacakan tak berarti)", () => {
    const acak = shuffleWithSeed(kategori.statements, `${ATTEMPT}:baris:${kategori.id}`);
    expect(acak.map((s) => s.id)).not.toEqual(kategori.statements.map((s) => s.id));
  });

  it("pernyataan memakai urutan acak yang sama dengan halaman pembahasan, kunci dan jawaban berpasangan dengan nomornya", () => {
    const acak = shuffleWithSeed(kategori.statements, `${ATTEMPT}:baris:${kategori.id}`);
    const k = susun(kategori, { s1: "kb", s2: "kb", s3: "ks", s4: "kb", s5: "ks", s6: "ks" });
    expect(k.opsi).toEqual(acak.map((s, i) => ({ label: String(i + 1), text: s.teks })));
    const nama = (id: string) => (id === "kb" ? "Benar" : "Salah");
    expect(k.kunci_jawaban).toEqual(acak.map((s, i) => `${i + 1}: ${nama(s.correctCategoryId)}`));
    const dipilih: Record<string, string> = { s1: "kb", s2: "kb", s3: "ks", s4: "kb", s5: "ks", s6: "ks" };
    expect(k.jawaban_siswa).toBe(acak.map((s, i) => `${i + 1}: ${nama(dipilih[s.id]!)}`).join("; "));
  });

  it("urutan array masukan dari database tidak memengaruhi hasil (selalu diurutkan menurut urutan dulu, baru diacak)", () => {
    const terbalik = { ...kategori, statements: [...kategori.statements].reverse(), categories: [...kategori.categories].reverse() };
    const jawab = { s1: "kb", s2: "kb", s3: "ks", s4: "kb", s5: "ks", s6: "ks" };
    expect(susun(terbalik, jawab)).toEqual(susun(kategori, jawab));
  });

  it("teks soal diberi keterangan kategori yang tersedia", () => {
    expect(susun(kategori, null).soal_text).toContain("Benar / Salah");
  });

  it("jawaban sebagian: pernyataan yang tak dijawab ditulis (kosong)", () => {
    const acak = shuffleWithSeed(kategori.statements, `${ATTEMPT}:baris:${kategori.id}`);
    const k = susun(kategori, { s1: "kb" });
    const nomorS1 = acak.findIndex((s) => s.id === "s1") + 1;
    expect(k.jawaban_siswa).toContain(`${nomorS1}: Benar`);
    expect(k.jawaban_siswa).toContain("(kosong)");
  });

  it("tanpa jawaban sama sekali atau kategori tak dikenal: tidak ada jawaban_siswa", () => {
    expect(susun(kategori, null).jawaban_siswa).toBeUndefined();
    expect(susun(kategori, {}).jawaban_siswa).toBeUndefined();
    expect(susun(kategori, { s1: "kategori-aneh" }).jawaban_siswa).toBeUndefined();
  });

  it("pernyataan TIDAK mengikuti pengaturan acakOpsi (selalu diacak, sama seperti halaman pembahasan)", () => {
    const a = susun(kategori, null, false);
    const b = susun(kategori, null, true);
    expect(a.opsi).toEqual(b.opsi);
  });
});

describe("kunci kontrak dengan halaman pembahasan", () => {
  // Bila benih pengacakan di lib/exam/hasil.ts diubah, label opsi yang dibahas Tutor akan berbeda dari yang dilihat
  // siswa. Tes ini sengaja gagal supaya konteks Tutor ikut diperbarui.
  const sumber = readFileSync("lib/exam/hasil.ts", "utf8");

  it("hasil.ts memakai benih opsi `${attempt.id}:opsi:${q.id}` hanya bila paket diacak", () => {
    expect(sumber).toContain("pkg.acakOpsi");
    expect(sumber).toContain("shuffleWithSeed(q.options, `${attempt.id}:opsi:${q.id}`)");
  });

  it("hasil.ts memakai benih pernyataan `${attempt.id}:baris:${q.id}` tanpa syarat", () => {
    expect(sumber).toContain("shuffleWithSeed(q.statements, `${attempt.id}:baris:${q.id}`)");
  });

  it("label dihitung dari posisi tampil (A, B, C ...)", () => {
    expect(sumber).toContain("String.fromCharCode(65 + idx)");
  });
});
