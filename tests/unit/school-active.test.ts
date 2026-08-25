import { describe, expect, it } from "vitest";
import { isSchoolActive } from "@/lib/schools/active";

const now = new Date("2026-06-15T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("isSchoolActive (fix: langganan sekolah lewat tanggal harus memutus akses, bukan cuma menolak registrasi baru)", () => {
  it("status bukan aktif -> selalu tidak aktif, walau langgananBerakhir masih jauh di masa depan", () => {
    expect(
      isSchoolActive({
        status: "suspend",
        langgananBerakhir: new Date(now.getTime() + 30 * DAY_MS),
      }, now),
    ).toBe(false);
    expect(
      isSchoolActive({ status: "pending_verifikasi", langgananBerakhir: null }, now),
    ).toBe(false);
  });

  it("status aktif tanpa langgananBerakhir (belum diisi admin pusat) -> aktif", () => {
    expect(isSchoolActive({ status: "aktif", langgananBerakhir: null }, now)).toBe(true);
  });

  it("status aktif, langgananBerakhir masih di masa depan -> aktif", () => {
    expect(
      isSchoolActive(
        { status: "aktif", langgananBerakhir: new Date(now.getTime() + DAY_MS) },
        now,
      ),
    ).toBe(true);
  });

  it("status aktif, langgananBerakhir baru saja lewat -> tidak aktif lagi (tanpa masa tenggang - beda dari langganan siswa mandiri)", () => {
    expect(
      isSchoolActive({ status: "aktif", langgananBerakhir: new Date(now.getTime() - 1000) }, now),
    ).toBe(false);
  });

  it("langgananBerakhir dalam bentuk string ISO (hasil JSON dari API) tetap dihitung benar - dipakai di Client Component", () => {
    expect(
      isSchoolActive({ status: "aktif", langgananBerakhir: "2026-06-14T00:00:00.000Z" }, now),
    ).toBe(false);
    expect(
      isSchoolActive({ status: "aktif", langgananBerakhir: "2026-06-16T00:00:00.000Z" }, now),
    ).toBe(true);
  });
});
