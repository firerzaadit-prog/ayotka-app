import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  executeRaw: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  analisisFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => {
  const tx = { $executeRaw: m.executeRaw, tutorAiPesan: { count: m.count, create: m.create } };
  return {
    prisma: {
      $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
      tutorAiPesan: { count: m.count, deleteMany: m.deleteMany },
      aiAnalysis: { findUnique: m.analisisFindUnique },
    },
  };
});

import { tanyaTutorAi, urlTutorAi } from "@/lib/tutor/klien-ai";
import { awalHariWIB, batasHarianTutor, lepasReservasi, reservasiPesan, ringkasanTutor } from "@/lib/tutor/penggunaan";

const KONTEKS = { jenjang: "SMP", mapel: "Matematika", soal_text: "2+3?", mode: "socratic" as const };
const PESAN = [{ role: "user" as const, content: "Halo" }];

describe("tanyaTutorAi", () => {
  const fetchAsli = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = fetchAsli;
    delete process.env.TUTOR_AI_URL;
    vi.restoreAllMocks();
  });

  const tiru = (res: Partial<Response> & { json?: () => Promise<unknown> }) => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}), ...res }) as Response);
    globalThis.fetch = f as never;
    return f;
  };

  it("alamat bawaan ai.ayotka.id dan bisa diganti lewat env", () => {
    expect(urlTutorAi()).toBe("https://ai.ayotka.id/api/ai/tutor/chat");
    process.env.TUTOR_AI_URL = " https://lain.example/tutor ";
    expect(urlTutorAi()).toBe("https://lain.example/tutor");
  });

  it("mengirim soalContext + messages (tanpa soalId) dan mengembalikan balasan dari data.reply", async () => {
    const f = tiru({ json: async () => ({ success: true, data: { reply: "Ayo kita mulai." } }) });
    const hasil = await tanyaTutorAi({ konteks: KONTEKS, pesan: PESAN });
    expect(hasil).toEqual({ ok: true, balasan: "Ayo kita mulai." });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ai.ayotka.id/api/ai/tutor/chat");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.soalContext).toEqual(KONTEKS);
    expect(body.messages).toEqual([{ role: "user", content: "Halo" }]);
    expect("soalId" in body).toBe(false);
  });

  it("foto hanya melekat pada pesan siswa TERAKHIR", async () => {
    const f = tiru({ json: async () => ({ reply: "ok" }) });
    await tanyaTutorAi({
      konteks: KONTEKS,
      pesan: [
        { role: "user", content: "satu" },
        { role: "assistant", content: "dua" },
        { role: "user", content: "tiga" },
      ],
      gambar: "data:image/png;base64,AAAA",
    });
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.messages[0].images).toBeUndefined();
    expect(body.messages[1].images).toBeUndefined();
    expect(body.messages[2].images).toEqual(["data:image/png;base64,AAAA"]);
  });

  it("tanpa foto: tidak ada kunci images sama sekali", async () => {
    const f = tiru({ json: async () => ({ reply: "ok" }) });
    await tanyaTutorAi({ konteks: KONTEKS, pesan: PESAN });
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).messages[0]).toEqual({ role: "user", content: "Halo" });
  });

  it("menerima balasan di data.reply maupun reply, dan membersihkan gambar markdown", async () => {
    tiru({ json: async () => ({ reply: "A ![x](http://evil/p.png) B" }) });
    expect(await tanyaTutorAi({ konteks: KONTEKS, pesan: PESAN })).toEqual({ ok: true, balasan: "A x B" });
  });

  it("layanan menjawab galat HTTP -> gagal 'http' tanpa meneruskan pesan galatnya", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    tiru({ ok: false, status: 500, json: async () => ({ success: false, error: "rahasia internal" }) });
    expect(await tanyaTutorAi({ konteks: KONTEKS, pesan: PESAN })).toEqual({ ok: false, alasan: "http", status: 500 });
  });

  it("status 200 tetapi success=false -> gagal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    tiru({ json: async () => ({ success: false, error: "x" }) });
    expect((await tanyaTutorAi({ konteks: KONTEKS, pesan: PESAN })).ok).toBe(false);
  });

  it("success=false dianggap gagal WALAU ada isi balasan (layanan sendiri menyatakan gagal)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    tiru({ json: async () => ({ success: false, error: "model gagal", data: { reply: "balasan setengah jadi" } }) });
    expect(await tanyaTutorAi({ konteks: KONTEKS, pesan: PESAN })).toEqual({ ok: false, alasan: "http", status: 200 });
  });

  it("balasan kosong atau tak berbentuk -> gagal 'isi_tidak_valid'", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const isi of [{}, { data: {} }, { data: { reply: "   " } }, { reply: 5 }]) {
      tiru({ json: async () => isi });
      expect(await tanyaTutorAi({ konteks: KONTEKS, pesan: PESAN })).toEqual({ ok: false, alasan: "isi_tidak_valid" });
    }
  });

  it("badan jawaban bukan JSON -> gagal, tidak melempar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    tiru({ json: async () => { throw new Error("bukan json"); } });
    expect((await tanyaTutorAi({ konteks: KONTEKS, pesan: PESAN })).ok).toBe(false);
  });

  it("jaringan putus -> gagal 'jaringan'; waktu habis -> 'waktu_habis' (tidak melempar)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => { throw new TypeError("fetch failed"); }) as never;
    expect(await tanyaTutorAi({ konteks: KONTEKS, pesan: PESAN })).toEqual({ ok: false, alasan: "jaringan" });
    const habis = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    globalThis.fetch = vi.fn(async () => { throw habis; }) as never;
    expect(await tanyaTutorAi({ konteks: KONTEKS, pesan: PESAN })).toEqual({ ok: false, alasan: "waktu_habis" });
  });

  it("memasang batas waktu pada permintaan", async () => {
    const f = tiru({ json: async () => ({ reply: "ok" }) });
    await tanyaTutorAi({ konteks: KONTEKS, pesan: PESAN });
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].signal).toBeInstanceOf(AbortSignal);
  });
});

describe("batasHarianTutor / awalHariWIB", () => {
  afterEach(() => {
    delete process.env.TUTOR_AI_BATAS_HARIAN;
  });

  it("bawaan 20; env bilangan bulat >= 1 dipakai; nilai aneh jatuh ke bawaan", () => {
    expect(batasHarianTutor()).toBe(20);
    process.env.TUTOR_AI_BATAS_HARIAN = "35";
    expect(batasHarianTutor()).toBe(35);
    for (const v of ["0", "-3", "abc", "", " "]) {
      process.env.TUTOR_AI_BATAS_HARIAN = v;
      expect(batasHarianTutor(), v).toBe(20);
    }
  });

  it("hari berganti tengah malam WIB (UTC+7), bukan tengah malam UTC", () => {
    // 23:30 WIB tanggal 7 Okt = 16:30 UTC tanggal 7 Okt -> awal hari = 7 Okt 00:00 WIB = 6 Okt 17:00 UTC
    expect(awalHariWIB(new Date("2026-10-07T16:30:00Z")).toISOString()).toBe("2026-10-06T17:00:00.000Z");
    // 00:30 WIB tanggal 8 Okt = 17:30 UTC tanggal 7 Okt -> sudah hari baru: awal hari = 8 Okt 00:00 WIB = 7 Okt 17:00 UTC
    expect(awalHariWIB(new Date("2026-10-07T17:30:00Z")).toISOString()).toBe("2026-10-07T17:00:00.000Z");
    // tepat 00:00 WIB termasuk hari baru
    expect(awalHariWIB(new Date("2026-10-07T17:00:00Z")).toISOString()).toBe("2026-10-07T17:00:00.000Z");
    // satu milidetik sebelumnya masih hari lama
    expect(awalHariWIB(new Date("2026-10-07T16:59:59.999Z")).toISOString()).toBe("2026-10-06T17:00:00.000Z");
  });
});

describe("ringkasanTutor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.analisisFindUnique.mockResolvedValue(null);
    m.count.mockResolvedValue(0);
  });

  it("aktif hanya bila hasil analisis percobaan ini sudah ada", async () => {
    expect((await ringkasanTutor({ id: "a1", studentId: "s1" })).aktif).toBe(false);
    m.analisisFindUnique.mockResolvedValue({ attemptId: "a1" });
    expect((await ringkasanTutor({ id: "a1", studentId: "s1" })).aktif).toBe(true);
    expect(m.analisisFindUnique).toHaveBeenLastCalledWith({ where: { attemptId: "a1" }, select: { attemptId: true } });
  });

  it("sisa = batas - pesan hari ini (tidak pernah negatif), dihitung sejak awal hari WIB untuk siswa itu", async () => {
    m.count.mockResolvedValue(7);
    const sekarang = new Date("2026-10-07T03:00:00Z");
    expect(await ringkasanTutor({ id: "a1", studentId: "s1" }, sekarang)).toEqual({ aktif: false, sisaHariIni: 13, batasHarian: 20 });
    expect(m.count).toHaveBeenCalledWith({ where: { studentId: "s1", createdAt: { gte: awalHariWIB(sekarang) } } });
    m.count.mockResolvedValue(99);
    expect((await ringkasanTutor({ id: "a1", studentId: "s1" })).sisaHariIni).toBe(0);
  });
});

describe("reservasiPesan / lepasReservasi", () => {
  const p = { studentId: "s1", attemptId: "a1", questionId: "q1" };
  beforeEach(() => {
    vi.resetAllMocks();
    m.executeRaw.mockResolvedValue(0);
    m.create.mockResolvedValue({ id: "baris-1" });
    m.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("mengunci per siswa SEBELUM menghitung (dua permintaan serentak harus bergantian)", async () => {
    m.count.mockResolvedValue(3);
    await reservasiPesan(p, 20);
    expect(m.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(m.count.mock.invocationCallOrder[0]!);
    expect(m.executeRaw.mock.calls[0]!.slice(1)).toEqual(["tutor:s1"]);
    expect((m.executeRaw.mock.calls[0]![0] as string[]).join("")).toMatch(/pg_advisory_xact_lock/);
  });

  it("di bawah batas: mencatat satu baris dan melaporkan sisa setelahnya", async () => {
    m.count.mockResolvedValue(3);
    expect(await reservasiPesan(p, 20)).toEqual({ ok: true, id: "baris-1", sisaSetelah: 16 });
    expect(m.create).toHaveBeenCalledWith({ data: { studentId: "s1", attemptId: "a1", questionId: "q1" }, select: { id: true } });
  });

  it("pesan terakhir yang masih diizinkan: sisa 0", async () => {
    m.count.mockResolvedValue(19);
    expect(await reservasiPesan(p, 20)).toMatchObject({ ok: true, sisaSetelah: 0 });
  });

  it("tepat di batas atau lebih: ditolak dan TIDAK mencatat apa pun", async () => {
    for (const terpakai of [20, 21, 500]) {
      m.count.mockResolvedValue(terpakai);
      expect(await reservasiPesan(p, 20)).toEqual({ ok: false });
    }
    expect(m.create).not.toHaveBeenCalled();
  });

  it("menghitung hanya pesan siswa itu sejak awal hari WIB", async () => {
    m.count.mockResolvedValue(0);
    const sekarang = new Date("2026-10-07T20:00:00Z");
    await reservasiPesan(p, 20, sekarang);
    expect(m.count).toHaveBeenCalledWith({ where: { studentId: "s1", createdAt: { gte: awalHariWIB(sekarang) } } });
  });

  it("lepasReservasi menghapus baris itu saja, aman diulang", async () => {
    await lepasReservasi("baris-1");
    await lepasReservasi("baris-1");
    expect(m.deleteMany).toHaveBeenCalledWith({ where: { id: "baris-1" } });
  });
});
