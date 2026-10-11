import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  buildImportPreview: vi.fn(),
  getQuestionsForPackage: vi.fn(),
  resolveAll: vi.fn(),
  createManySoal: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    soalImportLog: { create: vi.fn((a: unknown) => ({ jenis: "log", a })) },
    subject: { findUnique: vi.fn(async () => ({ id: "subj-1", nama: "Matematika", jenjang: "SD" })) },
    package: { create: vi.fn((a: unknown) => ({ jenis: "paket", a })), findUniqueOrThrow: vi.fn(async () => ({ id: "paket-baru" })) },
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
vi.mock("@/lib/soal-import/preview", () => ({ buildImportPreview: m.buildImportPreview }));
vi.mock("@/lib/soal-import/source-db", () => ({ getQuestionsForPackage: m.getQuestionsForPackage }));
vi.mock("@/lib/soal-import/taxonomy-resolver", () => ({
  autoResolveOrCreateTaxonomy: vi.fn(async () => ({ kompetensiId: "komp-1", elemenId: "elem-1" })),
}));
vi.mock("@/lib/soal-import/media", () => ({ resolveAllSourceImages: m.resolveAll }));
vi.mock("@/lib/supabase/storage", () => ({
  importImagePath: (hash: string, ext: string) => `soal-import/${hash}.${ext}`,
  publicImageUrl: (path: string) => `https://ayotka.id/media/${path}`,
  uploadImportImages: m.upload,
}));
vi.mock("@/lib/exam/seri-mandiri", () => ({
  simpanDenganUrutanSeri: vi.fn(async ({ simpan }: { simpan: (u: number | null) => Promise<unknown> }) => simpan(1)),
  urutanSeriTerpakai: vi.fn(async () => []),
}));
vi.mock("@/lib/exam/seri-jadwal", () => ({ urutanSeriBerikutnya: vi.fn(() => 1) }));

import { executeImport } from "@/lib/soal-import/execute";
import { MediaIlustrasi } from "@/components/soal/media-ilustrasi";
import { parseQuestionMedia } from "@/lib/soal/media-types";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>`;
const KETERANGAN = "Dua bangun datar segiempat.";
const PAKET = { id: "src-1", code: "A05-SD-MAT", nama: "Paket A5", jenjang: "SD/MI", mapel: "Matematika", status: "diterbitkan", jumlahSoal: 1 };

const soalPratinjau = {
  sourceId: "q1",
  code: "A05-SD-MAT-28",
  nomorUrut: 28,
  format: "pg_kompleks" as const,
  tingkatKesulitan: "sulit" as const,
  teks: "Di sanggar kriya sekolah, Bu Ratna menunjukkan dua potongan kayu.",
  pembahasan: "Karena begitu.",
  gambarTipe: "ilustrasi_kontekstual" as const,
  gambarPreviewUrl: null,
  gambarAlt: KETERANGAN,
  opsi: [
    { label: "A", teks: "satu", isCorrect: true },
    { label: "B", teks: "dua", isCorrect: false },
  ],
  kategoriRespons: [],
  pernyataan: [],
  elemen: "Geometri",
  subElemen: "Bangun Datar",
  kompetensi: "Sifat bangun datar",
  indikator: null,
  indikatorResmiId: null,
  taxonomyMapped: false,
  taxonomyKompetensiId: null,
  taxonomyElemenId: null,
  taxonomyKompetensiLabel: null,
  levelKognitifSumber: "Penalaran",
  levelBloom: "L3" as const,
  stimulusId: null,
  blockedReasons: [],
};

const jalankanImpor = () =>
  executeImport({ sourcePaketId: "src-1", subjectId: "subj-1", durasiMenit: 60, kategori: "mandiri", levelBloomOverrides: {}, importedBy: "admin-1" });
const mediaTersimpan = () => (m.createManySoal.mock.calls[0]![0] as { data: Array<{ media: string | null }> }).data[0]!.media;

beforeEach(() => {
  vi.clearAllMocks();
  m.buildImportPreview.mockResolvedValue({ sourcePaket: PAKET, stimulusList: [], questions: [soalPratinjau], readyToImport: true, previousImports: [], indikatorRingkas: { masterTersedia: false, total: 1, cocok: 0, tidakCocok: 0, tanpa: 1 } });
  m.getQuestionsForPackage.mockResolvedValue([{ id: "q1", payload: { gambar: { tipe: "ilustrasi_kontekstual" } } }]);
  m.upload.mockResolvedValue(null); // unggah berhasil
});

describe("impor BARU menyimpan dua gambar untuk soal ilustrasi kontekstual (jadi siswa melihat dua tab)", () => {
  it("diagram + foto tersimpan sebagai JSON dua item, alamat foto = alamat penyimpanan, keterangan ikut; siswa melihat dua tab", async () => {
    m.resolveAll.mockResolvedValue({
      status: "ready",
      caption: KETERANGAN,
      items: [
        { tipe: "svg", label: "Diagram Presisi (SVG)", bytes: Buffer.from(SVG), mime: "image/svg+xml", ext: "svg", svgContent: SVG },
        { tipe: "foto", label: "Foto Ilustrasi", bytes: Buffer.from("foto-biner"), mime: "image/jpeg", ext: "jpg", fallbackUrl: "https://soal.ayotka.id/soal-images/x.jpg" },
      ],
    });
    await jalankanImpor();

    const media = mediaTersimpan()!;
    const parsed = parseQuestionMedia(media)!;
    expect(parsed.tipe).toBe("multi");
    expect(parsed.caption).toBe(KETERANGAN);
    expect(parsed.items.map((i) => [i.tipe, i.label])).toEqual([
      ["svg", "Diagram Presisi (SVG)"],
      ["foto", "Foto Ilustrasi"],
    ]);
    expect(parsed.items[0]!.svgContent).toBe(SVG);
    expect(parsed.items[1]!.url).toMatch(/^https:\/\/ayotka\.id\/media\/soal-import\/[0-9a-f]{64}\.jpg$/);
    expect(media).not.toContain("soal.ayotka.id/soal-images"); // bukan alamat sumber

    const html = renderToStaticMarkup(createElement(MediaIlustrasi, { media }));
    expect(html).toContain('role="tablist"');
    expect(html).toContain("Diagram Presisi (SVG)");
    expect(html).toContain("Foto Ilustrasi");
  });

  it("unggah penyimpanan gagal: dua gambar tetap tersimpan (foto jatuh ke alamat sumber, diagram tetap dari markup)", async () => {
    m.upload.mockResolvedValue({ error: "disk penuh" });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    m.resolveAll.mockResolvedValue({
      status: "ready",
      caption: null,
      items: [
        { tipe: "svg", label: "Diagram Presisi (SVG)", bytes: Buffer.from(SVG), mime: "image/svg+xml", ext: "svg", svgContent: SVG },
        { tipe: "foto", label: "Foto Ilustrasi", bytes: Buffer.from("foto-biner"), mime: "image/jpeg", ext: "jpg", fallbackUrl: "https://soal.ayotka.id/soal-images/x.jpg" },
      ],
    });
    await jalankanImpor();
    const parsed = parseQuestionMedia(mediaTersimpan())!;
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[1]!.url).toBe("https://soal.ayotka.id/soal-images/x.jpg");
    expect(parsed.items[0]!.svgContent).toBe(SVG);
  });

  it("soal dengan satu foto tanpa keterangan tetap disimpan sebagai alamat gambar biasa (format lama tidak berubah)", async () => {
    m.resolveAll.mockResolvedValue({
      status: "ready",
      caption: null,
      items: [{ tipe: "foto", label: "Foto Ilustrasi", bytes: Buffer.from("foto-biner"), mime: "image/png", ext: "png" }],
    });
    await jalankanImpor();
    expect(mediaTersimpan()).toMatch(/^https:\/\/ayotka\.id\/media\/soal-import\/[0-9a-f]{64}\.png$/);
  });

  it("soal tanpa gambar: media kosong", async () => {
    m.resolveAll.mockResolvedValue({ status: "none" });
    await jalankanImpor();
    expect(mediaTersimpan()).toBeNull();
  });
});
