import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireRole: vi.fn(),
  loadOwnedAttempt: vi.fn(),
  muatRiwayat: vi.fn(),
  hapusPercakapan: vi.fn(),
  bersihkanBilaPerlu: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireRole: m.requireRole }));
vi.mock("@/lib/exam/attempt-access", () => ({ loadOwnedAttempt: m.loadOwnedAttempt }));
vi.mock("@/lib/tutor/penyimpanan", () => ({
  muatRiwayat: m.muatRiwayat,
  hapusPercakapan: m.hapusPercakapan,
  bersihkanBilaPerlu: m.bersihkanBilaPerlu,
}));

import { DELETE, GET } from "@/app/api/siswa/attempts/[id]/tutor/riwayat/route";

const QID = "0f8d3acf-76bd-4d04-871c-769e0124a500";
const ATTEMPT = { id: "att-1", studentId: "siswa-1", status: "selesai" };
const params = { params: Promise.resolve({ id: "att-1" }) };
const req = (qs: string) => new Request(`https://ayotka.id/api/siswa/attempts/att-1/tutor/riwayat${qs}`);

beforeEach(() => {
  vi.resetAllMocks();
  m.requireRole.mockResolvedValue({ id: "user-1", role: "siswa" });
  m.loadOwnedAttempt.mockResolvedValue(ATTEMPT);
  m.muatRiwayat.mockResolvedValue([]);
  m.hapusPercakapan.mockResolvedValue(0);
});

describe("GET riwayat percakapan Tutor", () => {
  it("bukan siswa -> 403, tidak membaca apa pun", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await GET(req(`?questionId=${QID}`), params)).status).toBe(403);
    expect(m.muatRiwayat).not.toHaveBeenCalled();
  });

  it("percobaan bukan milik siswa (siswa lain tidak bisa membaca percakapan orang lain) -> 404", async () => {
    m.loadOwnedAttempt.mockResolvedValue(null);
    const res = await GET(req(`?questionId=${QID}`), params);
    expect(res.status).toBe(404);
    expect(m.muatRiwayat).not.toHaveBeenCalled();
  });

  it.each(["", "?questionId=", "?questionId=bukan-uuid", "?questionId=1;DROP TABLE"])("id soal tak sah (%s) -> 400", async (qs) => {
    const res = await GET(req(qs), params);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("DATA_TIDAK_VALID");
    expect(m.muatRiwayat).not.toHaveBeenCalled();
  });

  it("membaca hanya untuk siswa dan percobaan DARI SESI (bukan dari permintaan), soal dari kueri", async () => {
    await GET(req(`?questionId=${QID}&studentId=orang-lain&attemptId=lain`), params);
    expect(m.muatRiwayat).toHaveBeenCalledWith({ attemptId: "att-1", studentId: "siswa-1", questionId: QID });
  });

  it("mengembalikan giliran dan lama simpan 7 hari dengan no-store", async () => {
    const giliran = [{ id: "b1:u", role: "user", content: "Halo", adaFoto: false, waktu: "2026-10-13T01:00:00.000Z" }];
    m.muatRiwayat.mockResolvedValue(giliran);
    const res = await GET(req(`?questionId=${QID}`), params);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ pesan: giliran, hariSimpan: 7 });
  });

  it("memicu pembersihan cadangan tanpa menunggunya", async () => {
    await GET(req(`?questionId=${QID}`), params);
    expect(m.bersihkanBilaPerlu).toHaveBeenCalledTimes(1);
  });
});

const hapus = (qs: string) => DELETE(new Request(`https://ayotka.id/api/siswa/attempts/att-1/tutor/riwayat${qs}`, { method: "DELETE" }), params);

describe("DELETE riwayat percakapan Tutor (tombol Hapus percakapan)", () => {
  it("bukan siswa -> 403, tidak menghapus apa pun", async () => {
    m.requireRole.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await hapus(`?questionId=${QID}`)).status).toBe(403);
    expect(m.hapusPercakapan).not.toHaveBeenCalled();
  });

  it("percobaan bukan milik siswa (tidak bisa menghapus percakapan orang lain) -> 404", async () => {
    m.loadOwnedAttempt.mockResolvedValue(null);
    expect((await hapus(`?questionId=${QID}`)).status).toBe(404);
    expect(m.hapusPercakapan).not.toHaveBeenCalled();
  });

  it.each(["", "?questionId=", "?questionId=bukan-uuid", "?questionId=1;DROP TABLE"])("id soal tak sah (%s) -> 400 dan tidak menghapus", async (qs) => {
    const res = await hapus(qs);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("DATA_TIDAK_VALID");
    expect(m.hapusPercakapan).not.toHaveBeenCalled();
  });

  it("menghapus hanya untuk siswa dan percobaan DARI SESI, soal dari kueri (id lain di kueri diabaikan)", async () => {
    await hapus(`?questionId=${QID}&studentId=orang-lain&attemptId=lain`);
    expect(m.hapusPercakapan).toHaveBeenCalledTimes(1);
    expect(m.hapusPercakapan).toHaveBeenCalledWith({ attemptId: "att-1", studentId: "siswa-1", questionId: QID });
  });

  it("melaporkan jumlah yang dikosongkan dengan no-store", async () => {
    m.hapusPercakapan.mockResolvedValue(4);
    const res = await hapus(`?questionId=${QID}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ dihapus: 4 });
  });

  it("menghapus tidak membaca riwayat dan sebaliknya membaca tidak menghapus", async () => {
    await hapus(`?questionId=${QID}`);
    expect(m.muatRiwayat).not.toHaveBeenCalled();
    await GET(req(`?questionId=${QID}`), params);
    expect(m.hapusPercakapan).toHaveBeenCalledTimes(1);
  });
});
