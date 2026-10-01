import { describe, expect, it } from "vitest";
import {
  nomorPercobaanById,
  percobaanTerbaik,
  susunRiwayatPercobaan,
  type AttemptDasar,
} from "@/lib/exam/percobaan";

function att(id: string, mulai: string, skor: number | null, status = "selesai", pkg = "paket-a", asg: string | null = null): AttemptDasar {
  return { id, packageId: pkg, assignmentId: asg, status, skorAkhir: skor, mulaiAt: new Date(mulai), selesaiAt: new Date(mulai) };
}

describe("nomorPercobaanById", () => {
  it("menomori per paket menurut waktu mulai, bukan urutan data", () => {
    const hasil = nomorPercobaanById([
      att("c", "2026-10-03T00:00:00Z", 90),
      att("a", "2026-10-01T00:00:00Z", 79),
      att("b", "2026-10-02T00:00:00Z", 85),
    ]);
    expect(hasil.get("a")).toBe(1);
    expect(hasil.get("b")).toBe(2);
    expect(hasil.get("c")).toBe(3);
  });

  it("paket berbeda dan jalur berbeda (self-select vs ujian terjadwal) dihitung terpisah", () => {
    const hasil = nomorPercobaanById([
      att("a1", "2026-10-01T00:00:00Z", 70, "selesai", "paket-a"),
      att("b1", "2026-10-02T00:00:00Z", 60, "selesai", "paket-b"),
      att("a2-terjadwal", "2026-10-03T00:00:00Z", 80, "selesai", "paket-a", "asg-1"),
      att("a2", "2026-10-04T00:00:00Z", 75, "selesai", "paket-a"),
    ]);
    expect(hasil.get("a1")).toBe(1);
    expect(hasil.get("b1")).toBe(1);
    expect(hasil.get("a2-terjadwal")).toBe(1);
    expect(hasil.get("a2")).toBe(2);
  });

  it("siswa berbeda pada paket yang sama tidak saling mencampur nomor (kalau studentId tersedia)", () => {
    const hasil = nomorPercobaanById([
      { ...att("s1-a", "2026-10-01T00:00:00Z", 70), studentId: "siswa-1" },
      { ...att("s2-a", "2026-10-02T00:00:00Z", 60), studentId: "siswa-2" },
      { ...att("s1-b", "2026-10-03T00:00:00Z", 80), studentId: "siswa-1" },
    ]);
    expect(hasil.get("s1-a")).toBe(1);
    expect(hasil.get("s2-a")).toBe(1);
    expect(hasil.get("s1-b")).toBe(2);
  });

  it("percobaan yang masih berjalan ikut memakai nomor", () => {
    const hasil = nomorPercobaanById([att("a", "2026-10-01T00:00:00Z", 79), att("b", "2026-10-02T00:00:00Z", null, "berjalan")]);
    expect(hasil.get("b")).toBe(2);
  });
});

describe("susunRiwayatPercobaan", () => {
  const semua = [
    att("p1", "2026-10-01T11:22:00Z", 78.6),
    att("p2", "2026-10-02T09:00:00Z", 83.2),
    att("p3", "2026-10-03T09:00:00Z", 80.4),
  ];

  it("urut dari percobaan pertama, dengan selisih terhadap percobaan selesai sebelumnya (dari nilai yang dibulatkan)", () => {
    const items = susunRiwayatPercobaan(semua, "p3");
    expect(items.map((i) => i.nomor)).toEqual([1, 2, 3]);
    expect(items.map((i) => i.selisih)).toEqual([null, 4, -3]); // 79 -> 83 -> 80
  });

  it("menandai percobaan yang sedang dibuka", () => {
    const items = susunRiwayatPercobaan(semua, "p2");
    expect(items.filter((i) => i.iniYangDibuka).map((i) => i.id)).toEqual(["p2"]);
  });

  it("percobaan berjalan tidak masuk daftar tapi nomornya tetap terpakai", () => {
    const items = susunRiwayatPercobaan(
      [att("p1", "2026-10-01T00:00:00Z", 70), att("p2", "2026-10-02T00:00:00Z", null, "berjalan"), att("p3", "2026-10-03T00:00:00Z", 75)],
      "p3",
    );
    expect(items.map((i) => [i.id, i.nomor])).toEqual([
      ["p1", 1],
      ["p3", 3],
    ]);
    expect(items[1]!.selisih).toBe(5);
  });

  it("percobaan kedaluwarsa (waktu habis) ikut dihitung", () => {
    const items = susunRiwayatPercobaan([att("p1", "2026-10-01T00:00:00Z", 60), att("p2", "2026-10-02T00:00:00Z", 55, "kedaluwarsa")], "p2");
    expect(items).toHaveLength(2);
    expect(items[1]!.selisih).toBe(-5);
  });

  it("skor kosong tidak jadi pembanding dan selisihnya null", () => {
    const items = susunRiwayatPercobaan([att("p1", "2026-10-01T00:00:00Z", null), att("p2", "2026-10-02T00:00:00Z", 70)], "p2");
    expect(items[1]!.selisih).toBeNull();
  });
});

describe("percobaanTerbaik", () => {
  it("memilih skor tertinggi, yang lebih awal kalau seri", () => {
    const items = susunRiwayatPercobaan(
      [att("p1", "2026-10-01T00:00:00Z", 80), att("p2", "2026-10-02T00:00:00Z", 90), att("p3", "2026-10-03T00:00:00Z", 90)],
      "p3",
    );
    expect(percobaanTerbaik(items)?.id).toBe("p2");
  });

  it("null kalau tidak ada skor", () => {
    expect(percobaanTerbaik([])).toBeNull();
  });
});
