import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  masterFindMany: vi.fn(),
  kompetensiFindMany: vi.fn(),
  importLogFindMany: vi.fn(),
  getPackageById: vi.fn(),
  getQuestionsForPackage: vi.fn(),
  getStimulusByIds: vi.fn(),
  buildImportPreview: vi.fn(),
  tx: [] as unknown[],
  createManySoal: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    indikatorResmi: { findMany: m.masterFindMany },
    kompetensi: { findMany: m.kompetensiFindMany },
    soalImportLog: { findMany: m.importLogFindMany, create: vi.fn((a: unknown) => ({ jenis: "log", a })) },
    subject: { findUnique: vi.fn(async () => ({ id: "subj-1", nama: "Matematika", jenjang: "SMP" })) },
    package: {
      create: vi.fn((a: unknown) => ({ jenis: "paket", a })),
      findUniqueOrThrow: vi.fn(async () => ({ id: "paket-baru" })),
    },
    packageVisibility: { createMany: vi.fn((a: unknown) => ({ jenis: "visibility", a })) },
    stimulus: { createMany: vi.fn((a: unknown) => ({ jenis: "stimulus", a })) },
    question: {
      createMany: vi.fn((a: unknown) => {
        m.createManySoal(a);
        return { jenis: "soal", a };
      }),
    },
    questionOption: { createMany: vi.fn((a: unknown) => ({ jenis: "opsi", a })) },
    questionCategory: { createMany: vi.fn((a: unknown) => ({ jenis: "kategori", a })) },
    questionStatement: { createMany: vi.fn((a: unknown) => ({ jenis: "pernyataan", a })) },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));
vi.mock("@/lib/soal-import/source-db", () => ({
  getPackageById: m.getPackageById,
  getQuestionsForPackage: m.getQuestionsForPackage,
  getStimulusByIds: m.getStimulusByIds,
}));
vi.mock("@/lib/soal-import/taxonomy-resolver", () => ({
  resolveTaxonomyMapping: vi.fn(async () => null),
  autoResolveOrCreateTaxonomy: vi.fn(async () => ({ kompetensiId: "komp-1", elemenId: "elem-1" })),
}));
vi.mock("@/lib/soal-import/media", () => ({
  precheckSourceGambar: vi.fn(() => null),
  previewImageSrc: vi.fn(() => null),
  resolveSourceImage: vi.fn(async () => ({ status: "none" })),
}));
vi.mock("@/lib/supabase/storage", () => ({
  importImagePath: vi.fn(),
  publicImageUrl: vi.fn(),
  uploadImportImages: vi.fn(async () => null),
}));
vi.mock("@/lib/exam/seri-mandiri", () => ({
  simpanDenganUrutanSeri: vi.fn(async ({ simpan }: { simpan: (u: number | null) => Promise<unknown> }) => simpan(1)),
  urutanSeriTerpakai: vi.fn(async () => []),
}));
vi.mock("@/lib/exam/seri-jadwal", () => ({ urutanSeriBerikutnya: vi.fn(() => 1) }));

vi.mock("@/lib/soal-import/preview", async (impor) => {
  const asli = await impor<typeof import("@/lib/soal-import/preview")>();
  return { ...asli, buildImportPreview: (...a: unknown[]) => (m.buildImportPreview.getMockImplementation() ? m.buildImportPreview(...a) : asli.buildImportPreview(a[0] as string)) };
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { buildImportPreview as previewAsli } from "@/lib/soal-import/preview";
import { executeImport } from "@/lib/soal-import/execute";
import { kunciTeksIndikator } from "@/lib/indikator/normalisasi";

const PAKET = { id: "src-1", code: "A01-SMP-MAT", nama: "Paket A1", jenjang: "SMP/MTs", mapel: "Matematika", status: "diterbitkan", jumlahSoal: 3 };
const soalSumber = (id: string, indikator: string | null) => ({
  id,
  code: `A01-SMP-MAT-${id}`,
  nomorUrut: 1,
  jenjang: "SMP/MTs",
  mapel: "Matematika",
  elemen: "Bilangan",
  subElemen: "Bilangan Real",
  kompetensi: "Operasi pangkat",
  indikator,
  levelKognitif: "Aplikasi",
  tingkatKesulitan: "sedang",
  bentukSoal: "PG",
  stimulusId: null,
  paketId: "src-1",
  payload: {
    soal_text: `Teks soal ${id}`,
    opsi: [
      { label: "A", text: "satu" },
      { label: "B", text: "dua" },
    ],
    kunci_jawaban: ["A"],
    pembahasan: "Karena begitu.",
    gambar: null,
  },
});
const MASTER = [{ id: "ind-1", jenjang: "SMP", namaMapel: "Matematika", teksKunci: kunciTeksIndikator("Menyelesaikan operasi bilangan bentuk pangkat (1)") }];

beforeEach(() => {
  vi.clearAllMocks();
  m.buildImportPreview.mockReset();
  m.masterFindMany.mockResolvedValue(MASTER);
  m.kompetensiFindMany.mockResolvedValue([]);
  m.importLogFindMany.mockResolvedValue([]);
  m.getPackageById.mockResolvedValue(PAKET);
  m.getStimulusByIds.mockResolvedValue([]);
  m.getQuestionsForPackage.mockResolvedValue([
    soalSumber("a", "Menyelesaikan operasi bilangan bentuk pangkat (1)"),
    soalSumber("b", "Indikator bebas buatan generator (1)"),
    soalSumber("c", null),
  ]);
});

describe("buildImportPreview - indikator resmi", () => {
  it("soal yang indikatornya PERSIS sama dengan master diberi id indikator resmi; bebas dan kosong tidak", async () => {
    const p = (await previewAsli("A01-SMP-MAT"))!;
    expect(p.questions.map((q) => q.indikatorResmiId)).toEqual(["ind-1", null, null]);
    expect(p.questions.map((q) => q.indikator)).toEqual([
      "Menyelesaikan operasi bilangan bentuk pangkat (1)",
      "Indikator bebas buatan generator (1)",
      null,
    ]);
    expect(p.indikatorRingkas).toEqual({ masterTersedia: true, total: 3, cocok: 1, tidakCocok: 1, tanpa: 1 });
  });

  it("master dicari menurut jenjang dan mapel paket sumber (huruf besar-kecil mapel diabaikan)", async () => {
    await previewAsli("A01-SMP-MAT");
    expect(m.masterFindMany).toHaveBeenCalledWith({
      where: { jenjang: "SMP", namaMapel: { equals: "Matematika", mode: "insensitive" } },
      select: { id: true, jenjang: true, namaMapel: true, teksKunci: true },
    });
  });

  it("master belum diunggah: impor tetap bisa dipratinjau, semua tidak tertaut, ringkasan menandai master kosong", async () => {
    m.masterFindMany.mockResolvedValue([]);
    const p = (await previewAsli("A01-SMP-MAT"))!;
    expect(p.questions.every((q) => q.indikatorResmiId === null)).toBe(true);
    expect(p.indikatorRingkas).toMatchObject({ masterTersedia: false, cocok: 0, tidakCocok: 2, tanpa: 1 });
    expect(p.readyToImport).toBe(true); // master kosong TIDAK memblokir impor
  });

  it("jenjang yang tidak ada di master (mis. SMK) tidak memicu pencarian master dan tidak menjatuhkan pratinjau", async () => {
    m.getPackageById.mockResolvedValue({ ...PAKET, jenjang: "SMK/MAK" });
    const p = (await previewAsli("A01-SMP-MAT"))!;
    expect(m.masterFindMany).not.toHaveBeenCalled();
    expect(p.indikatorRingkas.masterTersedia).toBe(false);
    expect(p.questions.every((q) => q.indikatorResmiId === null)).toBe(true);
  });

  it("jenjang SMA dikenal (master punya baris SMA): dicari menurut jenjang SMA, bukan dicampur dengan SMP", async () => {
    m.getPackageById.mockResolvedValue({ ...PAKET, jenjang: "SMA/MA" });
    m.masterFindMany.mockResolvedValue([]);
    await previewAsli("A01-SMP-MAT");
    expect(m.masterFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ jenjang: "SMA" }) }));
  });

  it("indikator di sumber dirapikan spasinya di tepi tetapi isinya tidak diubah", async () => {
    m.getQuestionsForPackage.mockResolvedValue([soalSumber("a", "  Indikator   dengan  spasi (1)  ")]);
    const p = (await previewAsli("A01-SMP-MAT"))!;
    expect(p.questions[0]!.indikator).toBe("Indikator   dengan  spasi (1)");
  });

  it("indikator berbeda hanya spasi/huruf besar tetap dicocokkan; beda tanda baca atau nomor tidak", async () => {
    m.getQuestionsForPackage.mockResolvedValue([
      soalSumber("a", "  MENYELESAIKAN operasi   bilangan bentuk PANGKAT (1) "),
      soalSumber("b", "Menyelesaikan operasi bilangan bentuk pangkat (2)"),
      soalSumber("c", "Menyelesaikan operasi bilangan bentuk pangkat. (1)"),
    ]);
    const p = (await previewAsli("A01-SMP-MAT"))!;
    expect(p.questions.map((q) => q.indikatorResmiId)).toEqual(["ind-1", null, null]);
  });
});

describe("executeImport - indikator disalin ke soal", () => {
  const hitungan = (id: string, indikator: string | null, indikatorResmiId: string | null) => ({
    sourceId: id,
    code: `A01-SMP-MAT-${id}`,
    nomorUrut: 1,
    format: "pg" as const,
    tingkatKesulitan: "sedang" as const,
    teks: `Teks soal ${id}`,
    pembahasan: "Karena begitu.",
    gambarTipe: null,
    gambarPreviewUrl: null,
    gambarAlt: null,
    opsi: [
      { label: "A", teks: "satu", isCorrect: true },
      { label: "B", teks: "dua", isCorrect: false },
    ],
    kategoriRespons: [],
    pernyataan: [],
    elemen: "Bilangan",
    subElemen: "Bilangan Real",
    kompetensi: "Operasi pangkat",
    indikator,
    indikatorResmiId,
    taxonomyMapped: false,
    taxonomyKompetensiId: null,
    taxonomyElemenId: null,
    taxonomyKompetensiLabel: null,
    levelKognitifSumber: "Aplikasi",
    levelBloom: "L2" as const,
    stimulusId: null,
    blockedReasons: [],
  });

  it("Question dibuat dengan indikatorId (hanya bila resmi) dan indikatorTeks (apa adanya) dari pratinjau", async () => {
    m.buildImportPreview.mockResolvedValue({
      sourcePaket: PAKET,
      stimulusList: [],
      questions: [
        hitungan("a", "Menyelesaikan operasi bilangan bentuk pangkat (1)", "ind-1"),
        hitungan("b", "Indikator bebas buatan generator (1)", null),
        hitungan("c", null, null),
      ],
      readyToImport: true,
      previousImports: [],
      indikatorRingkas: { masterTersedia: true, total: 3, cocok: 1, tidakCocok: 1, tanpa: 1 },
    });
    m.getQuestionsForPackage.mockResolvedValue([soalSumber("a", null), soalSumber("b", null), soalSumber("c", null)]);

    const hasil = await executeImport({
      sourcePaketId: "src-1",
      subjectId: "subj-1",
      durasiMenit: 60,
      kategori: "mandiri",
      levelBloomOverrides: {},
      importedBy: "admin-1",
    });
    expect(hasil.jumlahSoal).toBe(3);

    expect(m.createManySoal).toHaveBeenCalledTimes(1);
    const { data } = m.createManySoal.mock.calls[0]![0] as { data: Array<{ teks: string; indikatorId: string | null; indikatorTeks: string | null }> };
    expect(data.map((d) => ({ teks: d.teks, id: d.indikatorId, ind: d.indikatorTeks }))).toEqual([
      { teks: "Teks soal a", id: "ind-1", ind: "Menyelesaikan operasi bilangan bentuk pangkat (1)" },
      { teks: "Teks soal b", id: null, ind: "Indikator bebas buatan generator (1)" },
      { teks: "Teks soal c", id: null, ind: null },
    ]);
  });
});

describe("source-db.ts (SQL mentah, tidak tertangkap tes lain)", () => {
  const sumber = readFileSync(path.resolve(__dirname, "../../lib/soal-import/source-db.ts"), "utf8");

  it("pembacaan soal sumber ikut mengambil kolom indikator", () => {
    expect(sumber).toMatch(/kompetensi, indikator, level_kognitif AS "levelKognitif"/);
  });

  it("pembaca ringan untuk sinkronisasi hanya mengambil teks soal dan indikator (bukan seluruh payload), terbatas pada satu paket", () => {
    const mulai = sumber.indexOf("export async function getIndikatorPaket");
    const akhir = sumber.indexOf("export async function", mulai + 10);
    const blok = sumber.slice(mulai, akhir);
    expect(blok).toMatch(/SELECT payload->>'soal_text' AS teks, indikator\s+FROM soal\.questions/);
    expect(blok).toContain("WHERE paket_id = ${paketId}");
    // tidak menarik payload utuh (penyebab kuota Supabase habis dulu): hanya satu kolom turunan dari payload
    expect(blok.match(/payload/g)?.length).toBe(2);
    expect(blok).not.toMatch(/SELECT \*|payload,|payload AS/);
  });
});
