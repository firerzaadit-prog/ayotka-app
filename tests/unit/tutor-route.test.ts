import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  loadOwnedAttempt: vi.fn(),
  checkRateLimit: vi.fn(),
  ringkasanTutor: vi.fn(),
  infoTutorHalaman: vi.fn(),
  simpanPercakapan: vi.fn(),
  bersihkanBilaPerlu: vi.fn(),
  reservasiPesan: vi.fn(),
  lepasReservasi: vi.fn(),
  batasHarianTutor: vi.fn(),
  tanyaTutorAi: vi.fn(),
  answerFindUnique: vi.fn(),
  packageFindUniqueOrThrow: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    attemptAnswer: { findUnique: m.answerFindUnique },
    package: { findUniqueOrThrow: m.packageFindUniqueOrThrow },
  },
}));
vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/exam/attempt-access", () => ({ loadOwnedAttempt: m.loadOwnedAttempt }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.checkRateLimit }));
vi.mock("@/lib/tutor/penyimpanan", () => ({
  infoTutorHalaman: m.infoTutorHalaman,
  simpanPercakapan: m.simpanPercakapan,
  bersihkanBilaPerlu: m.bersihkanBilaPerlu,
}));
vi.mock("@/lib/tutor/penggunaan", () => ({
  ringkasanTutor: m.ringkasanTutor,
  reservasiPesan: m.reservasiPesan,
  lepasReservasi: m.lepasReservasi,
  batasHarianTutor: m.batasHarianTutor,
}));
vi.mock("@/lib/tutor/klien-ai", () => ({ tanyaTutorAi: m.tanyaTutorAi }));

import { GET, POST } from "@/app/api/siswa/attempts/[id]/tutor/route";

const QID = "0f8d3acf-76bd-4d04-871c-769e0124a500";
const ATTEMPT = { id: "att-1", studentId: "siswa-1", packageId: "paket-1", status: "selesai" };
const params = { params: Promise.resolve({ id: "att-1" }) };
const req = (body: unknown) =>
  new Request("https://ayotka.id/api/siswa/attempts/att-1/tutor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const BODY = { questionId: QID, messages: [{ role: "user", content: "Kenapa jawabanku salah?" }] };

const SOAL = {
  jawabanJson: { option_id: "o1" },
  question: {
    id: QID,
    format: "pg",
    teks: "2 + 3 = ...",
    pembahasan: "Hasilnya 5.",
    options: [
      { id: "o1", teks: "4", isCorrect: false, urutan: 1 },
      { id: "o2", teks: "5", isCorrect: true, urutan: 2 },
    ],
    statements: [],
    categories: [],
    stimulus: null,
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "user-1", role: "siswa" });
  m.loadOwnedAttempt.mockResolvedValue(ATTEMPT);
  m.checkRateLimit.mockReturnValue(true);
  m.ringkasanTutor.mockResolvedValue({ aktif: true, sisaHariIni: 20, batasHarian: 20 });
  m.infoTutorHalaman.mockResolvedValue({ aktif: true, sisaHariIni: 20, batasHarian: 20, soalBerriwayat: ["q-a"], hariSimpan: 7 });
  m.simpanPercakapan.mockResolvedValue(undefined);
  m.batasHarianTutor.mockReturnValue(20);
  m.answerFindUnique.mockResolvedValue(SOAL);
  m.packageFindUniqueOrThrow.mockResolvedValue({ acakOpsi: false, jenjang: "SMP", subject: { nama: "Matematika" } });
  m.reservasiPesan.mockResolvedValue({ ok: true, id: "res-1", sisaSetelah: 19 });
  m.lepasReservasi.mockResolvedValue(undefined);
  m.tanyaTutorAi.mockResolvedValue({ ok: true, balasan: "Ayo kita telusuri bersama." });
});

describe("GET status Tutor", () => {
  it("bukan siswa -> 403; bukan miliknya -> 404", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await GET(req(""), params)).status).toBe(403);
    m.requireRole.mockResolvedValue({ id: "user-1", role: "siswa" });
    m.loadOwnedAttempt.mockResolvedValue(null);
    expect((await GET(req(""), params)).status).toBe(404);
  });

  it("mengembalikan ringkasan dengan no-store", async () => {
    const res = await GET(req(""), params);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ aktif: true, sisaHariIni: 20, batasHarian: 20, soalBerriwayat: ["q-a"], hariSimpan: 7 });
  });

  it("memicu pembersihan cadangan riwayat kedaluwarsa", async () => {
    await GET(req(""), params);
    expect(m.bersihkanBilaPerlu).toHaveBeenCalledTimes(1);
  });
});

describe("POST Tanya Tutor AI - penolakan (tidak ada reservasi, tidak ada panggilan AI)", () => {
  const tidakMenyentuh = () => {
    expect(m.reservasiPesan).not.toHaveBeenCalled();
    expect(m.tanyaTutorAi).not.toHaveBeenCalled();
  };

  it("bukan siswa -> 403", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await POST(req(BODY), params)).status).toBe(403);
    tidakMenyentuh();
  });

  it("percobaan bukan milik siswa / tidak ada -> 404", async () => {
    m.loadOwnedAttempt.mockResolvedValue(null);
    expect((await POST(req(BODY), params)).status).toBe(404);
    tidakMenyentuh();
  });

  it.each(["berjalan", "paused"])("ujian berstatus %s -> 409 BELUM_SELESAI", async (status) => {
    m.loadOwnedAttempt.mockResolvedValue({ ...ATTEMPT, status });
    const res = await POST(req(BODY), params);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("BELUM_SELESAI");
    tidakMenyentuh();
  });

  it("percobaan kedaluwarsa (waktu habis) boleh bertanya", async () => {
    m.loadOwnedAttempt.mockResolvedValue({ ...ATTEMPT, status: "kedaluwarsa" });
    expect((await POST(req(BODY), params)).status).toBe(200);
  });

  it("terlalu sering (pembatas laju per siswa) -> 429 TERLALU_SERING", async () => {
    m.checkRateLimit.mockReturnValue(false);
    const res = await POST(req(BODY), params);
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("TERLALU_SERING");
    expect(m.checkRateLimit).toHaveBeenCalledWith("tutor:siswa-1", 10, 60_000);
    tidakMenyentuh();
  });

  it("badan bukan JSON atau tak sah -> 400 dengan pesan yang jelas", async () => {
    for (const badan of ["bukan json", {}, { questionId: "x", messages: [] }, { ...BODY, messages: [{ role: "assistant", content: "hai" }] }]) {
      const res = await POST(req(badan), params);
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("DATA_TIDAK_VALID");
    }
    tidakMenyentuh();
  });

  it("Learning Analytics belum jadi -> 403 TUTOR_TIDAK_AKTIF", async () => {
    m.ringkasanTutor.mockResolvedValue({ aktif: false, sisaHariIni: 20, batasHarian: 20 });
    const res = await POST(req(BODY), params);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("TUTOR_TIDAK_AKTIF");
    tidakMenyentuh();
  });

  it("soal bukan bagian percobaan ini -> 404 SOAL_TIDAK_ADA", async () => {
    m.answerFindUnique.mockResolvedValue(null);
    const res = await POST(req(BODY), params);
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("SOAL_TIDAK_ADA");
    tidakMenyentuh();
  });

  it("batas harian tercapai -> 429 BATAS_HARIAN tanpa memanggil AI", async () => {
    m.reservasiPesan.mockResolvedValue({ ok: false });
    const res = await POST(req(BODY), params);
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body).toMatchObject({ code: "BATAS_HARIAN", sisaHariIni: 0 });
    expect(body.error).toContain("20");
    expect(m.tanyaTutorAi).not.toHaveBeenCalled();
    expect(m.lepasReservasi).not.toHaveBeenCalled();
  });
});

describe("POST Tanya Tutor AI - berhasil", () => {
  it("mengembalikan balasan dan sisa pesan, dengan no-store", async () => {
    const res = await POST(req(BODY), params);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ balasan: "Ayo kita telusuri bersama.", sisaHariIni: 19 });
    expect(m.lepasReservasi).not.toHaveBeenCalled();
  });

  it("memuat jawaban untuk percobaan + soal yang diminta (bukan soal lain)", async () => {
    await POST(req(BODY), params);
    expect(m.answerFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { attemptId_questionId: { attemptId: "att-1", questionId: QID } } }),
    );
  });

  it("konteks yang dikirim ke AI disusun SERVER dari database (kunci dari DB, bukan dari klien)", async () => {
    // klien mencoba menyelundupkan konteks sendiri: harus diabaikan
    await POST(req({ ...BODY, soalContext: { kunci_jawaban: "Z" }, kunci_jawaban: "Z" }), params);
    const arg = m.tanyaTutorAi.mock.calls[0]![0];
    expect(arg.konteks).toMatchObject({
      jenjang: "SMP",
      mapel: "Matematika",
      soal_text: "2 + 3 = ...",
      kunci_jawaban: "B",
      jawaban_siswa: "A",
      pembahasan: "Hasilnya 5.",
      mode: "socratic",
    });
    expect(arg.pesan).toEqual([{ role: "user", content: "Kenapa jawabanku salah?" }]);
    expect(arg.gambar).toBeUndefined();
  });

  it("foto yang sah diteruskan; reservasi memakai id siswa, percobaan, dan soal yang benar", async () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    await POST(req({ ...BODY, gambar: png }), params);
    expect(m.tanyaTutorAi.mock.calls[0]![0].gambar).toBe(png);
    expect(m.reservasiPesan).toHaveBeenCalledWith({ studentId: "siswa-1", attemptId: "att-1", questionId: QID }, 20);
  });

  it("urutan: reservasi dulu, baru AI dipanggil", async () => {
    await POST(req(BODY), params);
    expect(m.reservasiPesan.mock.invocationCallOrder[0]).toBeLessThan(m.tanyaTutorAi.mock.invocationCallOrder[0]!);
  });
});

describe("POST Tanya Tutor AI - penyimpanan percakapan 7 hari", () => {
  it("setelah AI menjawab: menyimpan pesan siswa TERAKHIR dan balasan ke baris reservasi, tanpa foto", async () => {
    await POST(req(BODY), params);
    expect(m.simpanPercakapan).toHaveBeenCalledWith("res-1", {
      pesan: "Kenapa jawabanku salah?",
      balasan: "Ayo kita telusuri bersama.",
      adaFoto: false,
    });
  });

  it("percakapan beberapa giliran: yang disimpan hanya giliran baru (pesan terakhir), bukan seluruh riwayat", async () => {
    await POST(
      req({
        questionId: QID,
        messages: [
          { role: "user", content: "pertama" },
          { role: "assistant", content: "balasan pertama" },
          { role: "user", content: "lanjutan" },
        ],
      }),
      params,
    );
    expect(m.simpanPercakapan).toHaveBeenCalledTimes(1);
    expect(m.simpanPercakapan.mock.calls[0]![1].pesan).toBe("lanjutan");
  });

  it("dengan foto: hanya penanda adaFoto=true yang disimpan, fotonya tidak pernah", async () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    await POST(req({ ...BODY, gambar: png }), params);
    const [, isi] = m.simpanPercakapan.mock.calls[0]!;
    expect(isi.adaFoto).toBe(true);
    expect(JSON.stringify(isi)).not.toContain("iVBORw0KGgo");
    expect(JSON.stringify(isi)).not.toContain("data:image");
  });

  it("AI gagal: tidak ada yang disimpan", async () => {
    m.tanyaTutorAi.mockResolvedValue({ ok: false, alasan: "http", status: 500 });
    await POST(req(BODY), params);
    expect(m.simpanPercakapan).not.toHaveBeenCalled();
  });

  it("ditolak (batas harian / tidak aktif / validasi): tidak ada yang disimpan", async () => {
    m.reservasiPesan.mockResolvedValue({ ok: false });
    await POST(req(BODY), params);
    m.ringkasanTutor.mockResolvedValue({ aktif: false, sisaHariIni: 20, batasHarian: 20 });
    await POST(req(BODY), params);
    await POST(req({}), params);
    expect(m.simpanPercakapan).not.toHaveBeenCalled();
  });

  it("gagal menyimpan tidak menggagalkan jawaban: siswa tetap menerima balasan dan jatah terpakai", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.simpanPercakapan.mockRejectedValue(new Error("db sesaat bermasalah"));
    const res = await POST(req(BODY), params);
    expect(res.status).toBe(200);
    expect((await res.json()).balasan).toBe("Ayo kita telusuri bersama.");
    expect(m.lepasReservasi).not.toHaveBeenCalled();
  });

  it("urutan: AI menjawab dulu, baru disimpan", async () => {
    await POST(req(BODY), params);
    expect(m.tanyaTutorAi.mock.invocationCallOrder[0]).toBeLessThan(m.simpanPercakapan.mock.invocationCallOrder[0]!);
  });

  it("memicu pembersihan cadangan riwayat kedaluwarsa", async () => {
    await POST(req(BODY), params);
    expect(m.bersihkanBilaPerlu).toHaveBeenCalled();
  });
});

describe("POST Tanya Tutor AI - AI gagal: jatah siswa tidak hilang", () => {
  it("layanan terlalu lama menjawab -> 504 TUTOR_LAMBAT dengan pesan jelas, reservasi dilepas", async () => {
    m.tanyaTutorAi.mockResolvedValue({ ok: false, alasan: "waktu_habis" });
    const res = await POST(req(BODY), params);
    const body = await res.json();
    expect(res.status).toBe(504);
    expect(body.code).toBe("TUTOR_LAMBAT");
    expect(body.error).toMatch(/terlalu lama/);
    expect(body.error).toMatch(/tidak terpakai/);
    expect(m.lepasReservasi).toHaveBeenCalledWith("res-1");
  });

  it.each(["jaringan", "http", "isi_tidak_valid"] as const)("alasan %s -> 502, reservasi dilepas", async (alasan) => {
    m.tanyaTutorAi.mockResolvedValue({ ok: false, alasan });
    const res = await POST(req(BODY), params);
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.code).toBe("TUTOR_GAGAL");
    expect(body.error).toMatch(/tidak terpakai/);
    expect(m.lepasReservasi).toHaveBeenCalledWith("res-1");
  });

  it("galat tak terduga dari pemanggil AI tetap melepas reservasi (tidak menjadi 500)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.tanyaTutorAi.mockRejectedValue(new Error("meledak"));
    const res = await POST(req(BODY), params);
    expect(res.status).toBe(502);
    expect(m.lepasReservasi).toHaveBeenCalledWith("res-1");
  });

  it("gagal melepas reservasi tidak mengubah jawaban 502 kepada siswa", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.tanyaTutorAi.mockResolvedValue({ ok: false, alasan: "http", status: 500 });
    m.lepasReservasi.mockRejectedValue(new Error("db sesaat bermasalah"));
    expect((await POST(req(BODY), params)).status).toBe(502);
  });

  it("pesan galat ke siswa tidak pernah memuat detail dari layanan", async () => {
    m.tanyaTutorAi.mockResolvedValue({ ok: false, alasan: "http", status: 500 });
    const teks = JSON.stringify(await (await POST(req(BODY), params)).json());
    expect(teks).not.toMatch(/rahasia|stack|500/);
  });
});
