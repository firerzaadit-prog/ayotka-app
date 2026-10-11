import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  loadOwnedAttempt: vi.fn(),
  checkAndClaimSession: vi.fn(),
  buildHasil: vi.fn(),
  hitungOpsi: vi.fn(),
  infoTutor: vi.fn(),
  attemptFindMany: vi.fn(),
  packageFind: vi.fn(),
  questionFindMany: vi.fn(),
  answerFindMany: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/exam/attempt-access", () => ({
  loadOwnedAttempt: m.loadOwnedAttempt,
  sanitizeAttemptForClient: (a: { id: string; status: string }) => ({ id: a.id, status: a.status }),
}));
vi.mock("@/lib/exam/timing", () => ({ getRemainingSeconds: () => 600 }));
vi.mock("@/lib/exam/shuffle", () => ({ shuffleWithSeed: <T,>(daftar: T[]) => daftar }));
vi.mock("@/lib/exam/hasil", () => ({ buildHasil: m.buildHasil }));
vi.mock("@/lib/billing/la-susulan", () => ({ hitungOpsiLaSusulan: m.hitungOpsi }));
vi.mock("@/lib/tutor/penyimpanan", () => ({ infoTutorHalaman: m.infoTutor }));
vi.mock("@/lib/exam/session-guard", () => ({ checkAndClaimSession: m.checkAndClaimSession }));
vi.mock("@/lib/exam/percobaan", () => ({ susunRiwayatPercobaan: () => [] }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    attempt: { findMany: m.attemptFindMany },
    package: { findUniqueOrThrow: m.packageFind },
    question: { findMany: m.questionFindMany },
    attemptAnswer: { findMany: m.answerFindMany },
  },
}));

import { GET } from "@/app/api/siswa/attempts/[id]/route";
import { formatQuestionMedia, parseQuestionMedia } from "@/lib/soal/media-types";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>`;
const FOTO = "https://ayotka.id/media/soal-media/abc.jpg";
const KUNCI_BOCOR = "kedua diagonal berpotongan tegak lurus";
const KETERANGAN = `Dua bangun datar segiempat: ${KUNCI_BOCOR}.`;
const MEDIA_GANDA = formatQuestionMedia({
  tipe: "multi",
  caption: KETERANGAN,
  items: [
    { tipe: "svg", label: "Diagram Presisi (SVG)", svgContent: SVG, alt: KETERANGAN },
    { tipe: "foto", label: "Foto Ilustrasi", url: FOTO, alt: KETERANGAN },
  ],
});

const ctx = { params: Promise.resolve({ id: "att-1" }) };
const minta = (tabToken?: string) => GET(new NextRequest(`http://localhost/api/siswa/attempts/att-1${tabToken ? `?tabToken=${tabToken}` : ""}`), ctx);
const attempt = (status: string) => ({ id: "att-1", status, studentId: "s1", packageId: "p1", assignmentId: null });

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "user-1", role: "siswa" });
  m.checkAndClaimSession.mockResolvedValue(true);
  m.attemptFindMany.mockResolvedValue([]);
  m.hitungOpsi.mockResolvedValue(null);
  m.infoTutor.mockResolvedValue(null);
});

describe("GET /api/siswa/attempts/[id]: keterangan gambar tidak sampai ke siswa", () => {
  it("UJIAN BERJALAN: media ganda dikirim tanpa keterangan (dua gambar utuh); media lain tidak berubah", async () => {
    m.loadOwnedAttempt.mockResolvedValue(attempt("berjalan"));
    m.packageFind.mockResolvedValue({ id: "p1", nama: "Paket", durasiMenit: 60, acakSoal: false, acakOpsi: false, subject: { nama: "Matematika" } });
    m.answerFindMany.mockResolvedValue([]);
    const dasar = { format: "pg", bobot: 1, stimulus: null, categories: [], statements: [{ id: "st1", teks: "p", media: FOTO, urutan: 0, correctCategoryId: null }] };
    m.questionFindMany.mockResolvedValue([
      { ...dasar, id: "q1", teks: "Soal 1", media: MEDIA_GANDA, options: [{ id: "o1", teks: "A", media: FOTO, urutan: 0, isCorrect: true }] },
      { ...dasar, id: "q2", teks: "Soal 2", media: FOTO, options: [] },
      { ...dasar, id: "q3", teks: "Soal 3", media: null, options: [] },
    ]);

    const res = await minta("tab-1");
    expect(res.status).toBe(200);
    const badan = await res.json();
    const mentah = JSON.stringify(badan);
    expect(mentah).not.toContain(KUNCI_BOCOR);
    expect(mentah).not.toContain("Dua bangun datar");

    const media = parseQuestionMedia(badan.questions[0].media)!;
    expect(media.tipe).toBe("multi");
    expect(media.caption).toBeNull();
    expect(media.items.map((i) => i.label)).toEqual(["Diagram Presisi (SVG)", "Foto Ilustrasi"]);
    expect(media.items[0]!.svgContent).toBe(SVG);
    expect(media.items[1]!.url).toBe(FOTO);

    expect(badan.questions[1].media).toBe(FOTO);
    expect(badan.questions[2].media).toBeNull();
    // media opsi dan pernyataan tidak disentuh
    expect(badan.questions[0].options[0].media).toBe(FOTO);
    expect(badan.questions[0].statements[0].media).toBe(FOTO);
    // dan kunci jawaban tetap tidak ikut terkirim selama ujian
    expect(badan.questions[0].options[0]).not.toHaveProperty("isCorrect");
  });

  it("HALAMAN HASIL siswa: media tiap soal tanpa keterangan; selebihnya (jawaban, pembahasan) apa adanya; hasil asli buildHasil tidak diubah", async () => {
    m.loadOwnedAttempt.mockResolvedValue(attempt("selesai"));
    const hasilAsli = {
      attempt: { id: "att-1", status: "selesai" },
      skor: 80,
      perSoal: [
        { questionId: "q1", teks: "Soal 1", media: MEDIA_GANDA, pembahasan: "Karena begitu.", skor: 1 },
        { questionId: "q2", teks: "Soal 2", media: FOTO, pembahasan: null, skor: 0 },
        { questionId: "q3", teks: "Soal 3", media: null, pembahasan: null, skor: 0 },
      ],
    };
    m.buildHasil.mockResolvedValue(hasilAsli);

    const badan = await (await minta()).json();
    expect(JSON.stringify(badan)).not.toContain(KUNCI_BOCOR);
    expect(badan.skor).toBe(80);
    expect(badan.perSoal).toHaveLength(3);
    expect(badan.perSoal[0]).toMatchObject({ questionId: "q1", pembahasan: "Karena begitu.", skor: 1 });
    const media = parseQuestionMedia(badan.perSoal[0].media)!;
    expect(media.items).toHaveLength(2);
    expect(media.caption).toBeNull();
    expect(badan.perSoal[1].media).toBe(FOTO);
    expect(badan.perSoal[2].media).toBeNull();
    // buildHasil dipakai juga oleh halaman admin dan rapor PDF: hasilnya sendiri tetap memuat keterangan
    expect(hasilAsli.perSoal[0]!.media).toBe(MEDIA_GANDA);
  });

  it("percobaan kedaluwarsa juga lewat jalur hasil yang sama", async () => {
    m.loadOwnedAttempt.mockResolvedValue(attempt("kedaluwarsa"));
    m.buildHasil.mockResolvedValue({ perSoal: [{ questionId: "q1", media: MEDIA_GANDA }] });
    const badan = await (await minta()).json();
    expect(JSON.stringify(badan)).not.toContain(KUNCI_BOCOR);
    expect(parseQuestionMedia(badan.perSoal[0].media)!.items).toHaveLength(2);
  });

  it("tanpa tabToken atau saat dijeda: tidak ada soal sama sekali (perilaku lama tidak berubah)", async () => {
    m.loadOwnedAttempt.mockResolvedValue(attempt("berjalan"));
    expect((await (await minta()).json()).questions).toEqual([]);
    m.loadOwnedAttempt.mockResolvedValue(attempt("paused"));
    expect((await (await minta("tab-1")).json()).questions).toEqual([]);
    expect(m.questionFindMany).not.toHaveBeenCalled();
  });
});
