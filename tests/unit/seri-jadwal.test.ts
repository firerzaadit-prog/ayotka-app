import { describe, expect, it } from "vitest";
import {
  adalahJawabanTerisi,
  bukaPaketBerikutnyaSetelah,
  galatUrutanSeri,
  hanyaPercobaanKosong,
  percobaanSelesaiPertama,
  putuskanStatusSeri,
  rentangAngka,
  ringkasSeri,
  selesaiPertama,
  urutanSeriBerikutnya,
  waktuSelesaiEfektif,
  wajibUrutanSeri,
  type PercobaanSeri,
} from "@/lib/exam/seri-jadwal";
import { formatWIBHariTanggalJam, jam6WIBBerikutnya } from "@/lib/utils/datetime";

// Waktu ditulis dalam WIB supaya mudah dibaca terhadap contoh di permintaan: "selesai Selasa -> terbuka Rabu 06.00".
// 2026-10-06 = Selasa, 2026-10-07 = Rabu.
const wib = (s: string) => new Date(`${s}+07:00`);
const JAM = 3_600_000;
const HARI = 24 * JAM;

const SEBELUMNYA = { nama: "Paket A" };

/** Percobaan yang selesai di `selesai` (WIB): mulai 30 menit sebelumnya, batas waktu 90 menit sejak mulai. */
const selesaiPada = (selesai: string): PercobaanSeri => ({
  status: "selesai",
  mulaiAt: new Date(wib(selesai).getTime() - 30 * 60_000),
  selesaiAt: wib(selesai),
  sisaDetik: 5400, jumlahTerjawab: 30,
});

describe("waktuSelesaiEfektif", () => {
  it("percobaan yang masih berjalan atau dijeda belum selesai", () => {
    const dasar = { mulaiAt: wib("2026-10-06T09:00:00"), selesaiAt: null, sisaDetik: 5400, jumlahTerjawab: 30 };
    expect(waktuSelesaiEfektif({ ...dasar, status: "berjalan" })).toBeNull();
    expect(waktuSelesaiEfektif({ ...dasar, status: "paused" })).toBeNull();
  });

  it("selesai: waktu siswa mengumpulkan", () => {
    expect(waktuSelesaiEfektif(selesaiPada("2026-10-06T09:40:00"))).toEqual(wib("2026-10-06T09:40:00"));
  });

  it("kedaluwarsa yang baru ditutup belakangan: dihitung dari batas waktunya, bukan saat ditutup", () => {
    // Mulai Senin 10.00, batas 11.30. Baru ditutup Rabu 20.00 (siswa membuka lagi / disapu cron harian).
    const p: PercobaanSeri = {
      status: "kedaluwarsa",
      mulaiAt: wib("2026-10-05T10:00:00"),
      selesaiAt: wib("2026-10-07T20:00:00"),
      sisaDetik: 5400, jumlahTerjawab: 30,
    };
    expect(waktuSelesaiEfektif(p)).toEqual(wib("2026-10-05T11:30:00"));
  });

  it("selesaiAt kosong pada percobaan yang sudah selesai: jatuh ke batas waktunya", () => {
    const p: PercobaanSeri = { status: "kedaluwarsa", mulaiAt: wib("2026-10-05T10:00:00"), selesaiAt: null, sisaDetik: 3600, jumlahTerjawab: 30 };
    expect(waktuSelesaiEfektif(p)).toEqual(wib("2026-10-05T11:00:00"));
  });
});

describe("wajibUrutanSeri - Try Out Mandiri milik pusat wajib berseri", () => {
  it("Mandiri pusat wajib; kategori kosong dianggap Mandiri", () => {
    expect(wajibUrutanSeri({ kategori: "mandiri", ownerType: "pusat" })).toBe(true);
    expect(wajibUrutanSeri({ kategori: undefined, ownerType: "pusat" })).toBe(true);
    expect(wajibUrutanSeri({ kategori: null, ownerType: "pusat" })).toBe(true);
  });

  it("Nasional tidak berseri; paket sekolah tidak diwajibkan", () => {
    expect(wajibUrutanSeri({ kategori: "nasional", ownerType: "pusat" })).toBe(false);
    expect(wajibUrutanSeri({ kategori: "mandiri", ownerType: "sekolah" })).toBe(false);
    expect(wajibUrutanSeri({ kategori: "nasional", ownerType: "sekolah" })).toBe(false);
  });
});

describe("rentangAngka", () => {
  it("meringkas angka berurutan menjadi rentang", () => {
    expect(rentangAngka([1, 2, 3, 5, 8, 9])).toBe("1\u20133, 5, 8\u20139");
    expect(rentangAngka([2, 3, 4, 5])).toBe("2\u20135");
    expect(rentangAngka([4])).toBe("4");
    expect(rentangAngka([])).toBe("");
  });

  it("tidak peduli urutan masukan dan membuang angka ganda", () => {
    expect(rentangAngka([9, 1, 2, 2, 8, 3])).toBe("1\u20133, 8\u20139");
  });
});

describe("ringkasSeri - posisi urutan seri untuk admin", () => {
  const MTK_SMP = { id: "mtk", nama: "Matematika" };
  const MTK_SD = { id: "mtk-sd", nama: "Matematika" };
  const p = (id: string, urutan: number | null, status: string, extra: Record<string, unknown> = {}) => ({
    id,
    nama: `Paket ${id}`,
    status,
    kategori: "mandiri",
    jenjang: "SMP",
    urutanSeri: urutan,
    subject: MTK_SMP,
    ...extra,
  });

  it("terbit terakhir, draft, nomor berikutnya, dan celah dihitung per mapel dan jenjang", () => {
    const [g] = ringkasSeri([p("a", 1, "published"), p("b", 2, "published"), p("c", 5, "published"), p("d", 6, "draft")]);
    expect(g).toMatchObject({ mapel: "Matematika", jenjang: "SMP", terbitTerakhir: 5, draft: [6], berikutnya: 7, celah: [3, 4] });
    expect(g!.paket.map((x) => x.urutan)).toEqual([1, 2, 5, 6]);
  });

  it("Matematika SD dan SMP adalah dua seri terpisah dengan hitungan sendiri (nomor 1 boleh sama)", () => {
    const hasil = ringkasSeri([
      p("a", 1, "published"),
      p("b", 2, "published"),
      p("x", 1, "published", { jenjang: "SD", subject: MTK_SD }),
    ]);
    expect(hasil).toHaveLength(2);
    const sd = hasil.find((g) => g.jenjang === "SD")!;
    const smp = hasil.find((g) => g.jenjang === "SMP")!;
    expect(sd.berikutnya).toBe(2);
    expect(smp.berikutnya).toBe(3);
    expect(hasil.map((g) => g.jenjang)).toEqual(["SD", "SMP"]); // diurutkan jenjang
  });

  it("siswa yang sudah menyelesaikan: urutan tertinggi yang sudah diselesaikan siswa", () => {
    const [g] = ringkasSeri([p("a", 1, "published"), p("b", 2, "published"), p("c", 3, "published")], { a: 12, b: 7 });
    expect(g!.selesaiTertinggi).toEqual({ urutan: 2, siswa: 7 });
    expect(g!.paket.map((x) => x.siswaSelesai)).toEqual([12, 7, 0]);
  });

  it("belum ada siswa yang selesai: selesaiTertinggi null; belum ada yang terbit: terbitTerakhir null", () => {
    const [g] = ringkasSeri([p("a", 1, "draft")]);
    expect(g).toMatchObject({ selesaiTertinggi: null, terbitTerakhir: null, draft: [1], berikutnya: 2, celah: [] });
  });

  it("paket arsip, Nasional, dan paket tanpa urutan tidak ikut; tanpa paket berseri -> kosong", () => {
    expect(
      ringkasSeri([
        p("a", 1, "archived"),
        p("b", 2, "published", { kategori: "nasional" }),
        p("c", null, "published"),
      ]),
    ).toEqual([]);
    expect(ringkasSeri([])).toEqual([]);
  });
});

describe("urutanSeriBerikutnya", () => {
  it("satu di atas yang terbesar, 1 kalau belum ada, tidak mengisi celah", () => {
    expect(urutanSeriBerikutnya([])).toBe(1);
    expect(urutanSeriBerikutnya([1, 2, 3])).toBe(4);
    expect(urutanSeriBerikutnya([1, 6])).toBe(7);
    expect(urutanSeriBerikutnya([5])).toBe(6);
  });
});

describe("galatUrutanSeri - isian urutan di form", () => {
  it("wajib dan kosong -> pesan wajib diisi; tidak wajib dan kosong -> boleh", () => {
    expect(galatUrutanSeri("", [1, 2], true)).toBe("Urutan seri wajib diisi untuk Try Out Mandiri.");
    expect(galatUrutanSeri("   ", [], true)).toBe("Urutan seri wajib diisi untuk Try Out Mandiri.");
    expect(galatUrutanSeri("", [1, 2], false)).toBeNull();
  });

  it("urutan yang sudah dipakai ditolak dan menyebut nomor kosong berikutnya", () => {
    const g = galatUrutanSeri("2", [1, 2, 4], true);
    expect(g).toBe("Urutan 2 sudah dipakai paket lain di mata pelajaran ini. Pilih angka lain (urutan kosong berikutnya: 5).");
    expect(galatUrutanSeri("4", [1, 2, 4], false)).toContain("sudah dipakai");
    expect(galatUrutanSeri(" 1 ", [1], true)).toContain("sudah dipakai"); // spasi dipangkas
  });

  it("urutan yang belum dipakai (termasuk mengisi celah) boleh", () => {
    expect(galatUrutanSeri("3", [1, 2, 4], true)).toBeNull();
    expect(galatUrutanSeri("5", [1, 2, 4], true)).toBeNull();
    expect(galatUrutanSeri("1", [], true)).toBeNull();
  });

  it("bukan bilangan bulat positif ditolak: 0, negatif, desimal, huruf, notasi ilmiah", () => {
    for (const v of ["0", "-1", "1.5", "abc", "1e2", "+3", "2,5"]) {
      expect(galatUrutanSeri(v, [], true), v).toBe("Urutan harus berupa bilangan bulat mulai dari 1.");
    }
  });
});

describe("adalahJawabanTerisi - soal yang benar-benar dijawab", () => {
  it("pilihan ganda: option_id terisi = dijawab", () => {
    expect(adalahJawabanTerisi({ option_id: "abc" })).toBe(true);
    expect(adalahJawabanTerisi({ option_id: "" })).toBe(false);
  });

  it("pilihan ganda kompleks: option_ids tidak kosong = dijawab, daftar kosong = tidak", () => {
    expect(adalahJawabanTerisi({ option_ids: ["a", "b"] })).toBe(true);
    expect(adalahJawabanTerisi({ option_ids: [] })).toBe(false);
  });

  it("PG kategori: ada pasangan pernyataan -> kategori terisi = dijawab", () => {
    expect(adalahJawabanTerisi({ "stmt-1": "kat-1" })).toBe(true);
    expect(adalahJawabanTerisi({ "stmt-1": "" })).toBe(false);
  });

  it("objek kosong {} (soal ragu-ragu tanpa jawaban), null, dan nilai aneh BUKAN jawaban", () => {
    for (const v of [{}, null, undefined, [], "abc", 3, true]) {
      expect(adalahJawabanTerisi(v), JSON.stringify(v)).toBe(false);
    }
  });
});

describe("percobaan kosong tidak dihitung sebagai 'sudah mengerjakan'", () => {
  const kosong = (selesai: string): PercobaanSeri => ({ ...selesaiPada(selesai), jumlahTerjawab: 0 });

  it("selesaiPertama melewati percobaan tanpa soal terjawab dan memakai yang berjawab", () => {
    expect(selesaiPertama([kosong("2026-10-06T09:00:00")])).toBeNull();
    expect(selesaiPertama([kosong("2026-10-06T09:00:00"), selesaiPada("2026-10-08T10:00:00")])).toEqual(wib("2026-10-08T10:00:00"));
  });

  it("percobaanSelesaiPertama mengembalikan percobaan berjawab tercepat beserta waktunya", () => {
    const a = { ...selesaiPada("2026-10-08T10:00:00"), id: "a" };
    const b = { ...selesaiPada("2026-10-07T10:00:00"), id: "b" };
    const hasil = percobaanSelesaiPertama([a, b, { ...kosong("2026-10-05T10:00:00"), id: "c" }]);
    expect(hasil?.percobaan.id).toBe("b");
    expect(hasil?.selesai).toEqual(wib("2026-10-07T10:00:00"));
    expect(percobaanSelesaiPertama([])).toBeNull();
  });

  it("hanyaPercobaanKosong: ada yang selesai tapi tidak ada yang berjawab", () => {
    expect(hanyaPercobaanKosong([kosong("2026-10-06T09:00:00")])).toBe(true);
    expect(hanyaPercobaanKosong([kosong("2026-10-06T09:00:00"), selesaiPada("2026-10-07T09:00:00")])).toBe(false);
    expect(hanyaPercobaanKosong([])).toBe(false);
    // percobaan yang masih berjalan bukan "kosong": belum selesai
    expect(
      hanyaPercobaanKosong([{ status: "berjalan", mulaiAt: wib("2026-10-06T09:00:00"), selesaiAt: null, sisaDetik: 5400, jumlahTerjawab: 0 }]),
    ).toBe(false);
  });

  it("putuskanStatusSeri: pendahulu hanya kosong -> belum_giliran bertanda percobaanKosong; tanpa tanda kalau memang belum dikerjakan", () => {
    const dasar = { sekarang: wib("2026-10-10T10:00:00"), sebelumnya: SEBELUMNYA, sebelumnyaSelesaiPada: null, sudahPernahMasuk: false };
    expect(putuskanStatusSeri({ ...dasar, sebelumnyaHanyaKosong: true })).toEqual({
      terkunci: true,
      alasan: "belum_giliran",
      namaPaketSebelumnya: "Paket A",
      percobaanKosong: true,
    });
    expect(putuskanStatusSeri({ ...dasar, sebelumnyaHanyaKosong: false })).toEqual({
      terkunci: true,
      alasan: "belum_giliran",
      namaPaketSebelumnya: "Paket A",
    });
    expect(putuskanStatusSeri(dasar)).toEqual({ terkunci: true, alasan: "belum_giliran", namaPaketSebelumnya: "Paket A" });
  });

  it("bukaPaketBerikutnyaSetelah: percobaan kosong tidak membuka paket berikutnya", () => {
    expect(bukaPaketBerikutnyaSetelah(kosong("2026-10-06T09:00:00"))).toBeNull();
  });
});

describe("bukaPaketBerikutnyaSetelah", () => {
  it("selesai Selasa 09.00 -> Rabu 06.00 WIB", () => {
    expect(bukaPaketBerikutnyaSetelah(selesaiPada("2026-10-06T09:00:00"))).toEqual(wib("2026-10-07T06:00:00"));
  });

  it("percobaan yang belum selesai -> null", () => {
    expect(
      bukaPaketBerikutnyaSetelah({ status: "berjalan", mulaiAt: wib("2026-10-06T09:00:00"), selesaiAt: null, sisaDetik: 5400, jumlahTerjawab: 30 }),
    ).toBeNull();
  });

  it("kedaluwarsa yang ditutup belakangan dihitung dari batas waktunya", () => {
    const p: PercobaanSeri = {
      status: "kedaluwarsa",
      mulaiAt: wib("2026-10-06T08:00:00"),
      selesaiAt: wib("2026-10-09T20:00:00"),
      sisaDetik: 5400, jumlahTerjawab: 30,
    };
    expect(bukaPaketBerikutnyaSetelah(p)).toEqual(wib("2026-10-07T06:00:00"));
  });
});

describe("selesaiPertama", () => {
  it("tanpa percobaan atau tanpa yang selesai -> null", () => {
    expect(selesaiPertama([])).toBeNull();
    expect(
      selesaiPertama([{ status: "berjalan", mulaiAt: wib("2026-10-06T09:00:00"), selesaiAt: null, sisaDetik: 5400, jumlahTerjawab: 30 }]),
    ).toBeNull();
  });

  it("memakai yang TERCEPAT: mengerjakan ulang belakangan tidak menunda paket berikutnya", () => {
    const pertama = selesaiPada("2026-10-06T09:00:00");
    const ulang = selesaiPada("2026-10-08T15:00:00");
    expect(selesaiPertama([ulang, pertama])).toEqual(wib("2026-10-06T09:00:00"));
  });

  it("percobaan yang belum selesai diabaikan", () => {
    const berjalan: PercobaanSeri = { status: "berjalan", mulaiAt: wib("2026-10-05T09:00:00"), selesaiAt: null, sisaDetik: 5400, jumlahTerjawab: 30 };
    expect(selesaiPertama([berjalan, selesaiPada("2026-10-06T09:00:00")])).toEqual(wib("2026-10-06T09:00:00"));
  });
});

describe("putuskanStatusSeri - satu paket baru per hari, terbuka 06.00 WIB setelah paket sebelumnya selesai", () => {
  const status = (sekarang: string, selesai: string | null, ekstra: Partial<Parameters<typeof putuskanStatusSeri>[0]> = {}) =>
    putuskanStatusSeri({
      sekarang: wib(sekarang),
      sebelumnya: SEBELUMNYA,
      sebelumnyaSelesaiPada: selesai ? wib(selesai) : null,
      sudahPernahMasuk: false,
      ...ekstra,
    });

  it("paket pertama dalam seri (tidak ada pendahulu) selalu terbuka", () => {
    expect(putuskanStatusSeri({ sekarang: wib("2026-10-06T10:00:00"), sebelumnya: null, sebelumnyaSelesaiPada: null, sudahPernahMasuk: false })).toEqual({
      terkunci: false,
    });
  });

  it("paket sebelumnya belum diselesaikan -> belum_giliran (tidak peduli sudah berapa hari lewat)", () => {
    expect(status("2026-10-20T10:00:00", null)).toEqual({
      terkunci: true,
      alasan: "belum_giliran",
      namaPaketSebelumnya: "Paket A",
    });
  });

  it("contoh permintaan: selesai Selasa -> tetap terkunci Selasa, terbuka Rabu 06.00 WIB", () => {
    const selasa = status("2026-10-06T15:00:00", "2026-10-06T09:00:00");
    expect(selasa).toMatchObject({ terkunci: true, alasan: "menunggu_jadwal", namaPaketSebelumnya: "Paket A" });
    if (selasa.terkunci && selasa.alasan === "menunggu_jadwal") {
      expect(formatWIBHariTanggalJam(selasa.bukaPada)).toBe("Rabu, 7 Oktober 2026 pukul 06.00 WIB");
    }
  });

  it("tepat batas 06.00 WIB: semenit sebelumnya terkunci, tepat 06.00:00.000 terbuka", () => {
    expect(status("2026-10-07T05:59:59.999", "2026-10-06T09:00:00").terkunci).toBe(true);
    expect(status("2026-10-07T06:00:00.000", "2026-10-06T09:00:00")).toEqual({ terkunci: false });
    expect(status("2026-10-07T06:00:00.001", "2026-10-06T09:00:00")).toEqual({ terkunci: false });
  });

  it("selesai lewat tengah malam (Rabu 02.00) -> terbuka Rabu 06.00 hari itu juga, seperti cron 06.00", () => {
    const sebelum = status("2026-10-07T05:00:00", "2026-10-07T02:00:00");
    expect(sebelum).toMatchObject({ terkunci: true, alasan: "menunggu_jadwal" });
    expect(status("2026-10-07T06:00:00", "2026-10-07T02:00:00")).toEqual({ terkunci: false });
  });

  it("selesai tepat sebelum 06.00 (05.59) -> terbuka 06.00 hari itu; selesai 06.01 -> baru besok 06.00", () => {
    expect(status("2026-10-07T06:00:00", "2026-10-07T05:59:00")).toEqual({ terkunci: false });
    expect(status("2026-10-07T06:00:00", "2026-10-07T06:01:00").terkunci).toBe(true);
    expect(status("2026-10-08T06:00:00", "2026-10-07T06:01:00")).toEqual({ terkunci: false });
  });

  it("siswa yang menunda berhari-hari: paket baru terbuka dari saat IA selesai, bukan dari jadwal umum", () => {
    // Paket A baru dikerjakan Jumat 10.00 -> B terbuka Sabtu 06.00, walau paket A sudah terbuka sejak Selasa.
    expect(status("2026-10-09T20:00:00", "2026-10-09T10:00:00").terkunci).toBe(true);
    expect(status("2026-10-10T06:00:00", "2026-10-09T10:00:00")).toEqual({ terkunci: false });
  });

  it("selesai sudah lama -> terbuka", () => {
    expect(status("2026-10-20T10:00:00", "2026-10-06T09:00:00")).toEqual({ terkunci: false });
  });

  it("paket yang sudah pernah dimasuki (Lanjutkan / kerjakan ulang) tidak pernah terkunci lagi", () => {
    expect(status("2026-10-06T15:00:00", "2026-10-06T09:00:00", { sudahPernahMasuk: true })).toEqual({ terkunci: false });
    expect(status("2026-10-06T15:00:00", null, { sudahPernahMasuk: true })).toEqual({ terkunci: false });
  });

  it("bukaMulai paket yang lebih lambat dari 06.00 dipakai sebagai waktu buka yang ditampilkan", () => {
    const hasil = status("2026-10-06T15:00:00", "2026-10-06T09:00:00", { bukaMulai: wib("2026-10-09T12:00:00") });
    expect(hasil).toMatchObject({ terkunci: true, alasan: "menunggu_jadwal" });
    if (hasil.terkunci && hasil.alasan === "menunggu_jadwal") {
      expect(hasil.bukaPada).toEqual(wib("2026-10-09T12:00:00"));
    }
  });

  it("bukaMulai yang lebih awal dari 06.00, kosong, atau tidak valid tidak mengubah waktu buka", () => {
    for (const bukaMulai of [wib("2026-10-01T00:00:00"), null, undefined, "bukan-tanggal"]) {
      const hasil = status("2026-10-06T15:00:00", "2026-10-06T09:00:00", { bukaMulai });
      if (!hasil.terkunci || hasil.alasan !== "menunggu_jadwal") throw new Error("seharusnya menunggu_jadwal");
      expect(hasil.bukaPada).toEqual(wib("2026-10-07T06:00:00"));
    }
  });

  it("bukaMulai tidak ikut dipaksa di sini: begitu 06.00 tiba paket dianggap terbuka (penolakan bukaMulai ada di gerbang lain)", () => {
    expect(status("2026-10-07T07:00:00", "2026-10-06T09:00:00", { bukaMulai: wib("2026-10-09T12:00:00") })).toEqual({
      terkunci: false,
    });
  });
});

// Pembanding independen untuk jam6WIBBerikutnya: 06.00 WIB = 23.00 UTC hari sebelumnya, jadi semua "06.00 WIB" jatuh
// di kelipatan 24 jam + 23 jam sejak epoch. Yang pertama TEPAT SETELAH t:
const jam6Referensi = (t: number) => (Math.floor((t - 23 * JAM) / HARI) + 1) * HARI + 23 * JAM;

// PRNG berbenih supaya tes acak deterministik.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("jam6WIBBerikutnya", () => {
  // Tes acak memanggil pemformat zona waktu puluhan ribu kali; diberi batas waktu longgar supaya tidak gagal
  // hanya karena mesin sedang sibuk (batas bawaan 5 detik).
  it("cocok dengan rumus epoch independen untuk 5.000 waktu acak (termasuk batas hari)", () => {
    const rand = mulberry32(20261004);
    for (let i = 0; i < 5_000; i++) {
      const t = Date.UTC(2026, 0, 1) + Math.floor(rand() * 2 * 365 * HARI);
      expect(jam6WIBBerikutnya(new Date(t)).getTime()).toBe(jam6Referensi(t));
    }
  }, 60_000);

  it("selalu setelah waktunya, paling jauh 24 jam, dan tepat pukul 06.00 WIB", () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 1_000; i++) {
      const t = Date.UTC(2026, 0, 1) + Math.floor(rand() * 365 * HARI);
      const hasil = jam6WIBBerikutnya(new Date(t)).getTime();
      expect(hasil).toBeGreaterThan(t);
      expect(hasil - t).toBeLessThanOrEqual(HARI);
      expect(formatWIBHariTanggalJam(new Date(hasil))).toMatch(/pukul 06\.00 WIB$/);
    }
  }, 60_000);
});

describe("simulasi: aturan per siswa memberi hasil yang sama dengan cron harian 06.00 yang dijalankan harfiah", () => {
  /**
   * Cron harfiah dari permintaan: tiap pukul 06.00 WIB, periksa siswa. Siswa yang paket terbukanya paling akhir sudah
   * selesai dikerjakan (sebelum cron berjalan) -> dibukakan SATU paket baru. Siswa yang tidak mengerjakan tidak
   * mendapat paket baru. Hasilnya dibandingkan dengan putuskanStatusSeri (dihitung langsung dari data percobaan,
   * tanpa cron) pada setiap pukul 06.00 WIB.
   */
  const JUMLAH_PAKET = 6;

  function jalankanSkenario(seed: number) {
    const rand = mulberry32(seed);
    const cron = (hari: number) => hari * HARI + 23 * JAM; // pukul 06.00 WIB
    const mulai = cron(20_000) + Math.floor(rand() * 3 * HARI); // waktu seri mulai berlaku, acak dalam sehari
    const peluangMengerjakan = 0.25 + rand() * 0.7;

    const percobaan: PercobaanSeri[][] = Array.from({ length: JUMLAH_PAKET }, () => []);
    let terbuka = 1; // jumlah paket yang terbuka menurut cron (paket pertama langsung)
    let terbukaSejak = mulai; // kapan paket teratas yang terbuka itu mulai terbuka

    // Interval (cron(h-1), cron(h)] untuk h dimulai dari cron pertama setelah `mulai`.
    let hari = Math.floor((mulai - 23 * JAM) / HARI) + 1;
    for (let langkah = 0; langkah < 45; langkah++, hari++) {
      const awal = Math.max(terbukaSejak, cron(hari - 1));
      const akhir = cron(hari);
      const paketTeratas = terbuka - 1;

      // Siswa mungkin mengerjakan paket teratas di interval ini (selama belum ada percobaan berjawab), pada waktu acak
      // setelah paket itu terbuka. Sekitar seperempat percobaan dikumpulkan KOSONG (tidak ada soal terjawab) dan
      // tidak boleh membuka paket berikutnya - siswa harus mengerjakannya lagi pada interval berikutnya.
      if (selesaiPertama(percobaan[paketTeratas]!) == null && akhir - awal > 0 && rand() < peluangMengerjakan) {
        const terjawab = rand() < 0.25 ? 0 : 30;
        const selesai = awal + Math.floor(rand() * (akhir - awal - 1)) + 1; // di dalam (awal, akhir)
        percobaan[paketTeratas]!.push(
          rand() < 0.7
            ? { status: "selesai", mulaiAt: new Date(selesai - 20 * 60_000), selesaiAt: new Date(selesai), sisaDetik: 5400, jumlahTerjawab: terjawab }
            : {
                // kedaluwarsa yang baru ditutup belakangan: batas waktunya = saat siswa berhenti
                status: "kedaluwarsa",
                mulaiAt: new Date(selesai - 5400_000),
                selesaiAt: new Date(selesai + Math.floor(rand() * 3 * HARI)),
                sisaDetik: 5400, jumlahTerjawab: terjawab,
              },
        );
      }
      // Pengerjaan ulang paket sebelumnya (acak) tidak boleh mengubah apa pun.
      if (paketTeratas > 0 && rand() < 0.3) {
        const ulang = awal + Math.floor(rand() * (akhir - awal));
        percobaan[Math.floor(rand() * paketTeratas)]!.push({
          status: "selesai",
          mulaiAt: new Date(ulang - 20 * 60_000),
          selesaiAt: new Date(ulang),
          sisaDetik: 5400, jumlahTerjawab: 30,
        });
      }

      // Cron pukul 06.00: paket teratas sudah selesai SEBELUM cron berjalan -> buka satu paket baru.
      const selesaiTeratas = selesaiPertama(percobaan[paketTeratas]!);
      if (selesaiTeratas && selesaiTeratas.getTime() < akhir && terbuka < JUMLAH_PAKET) {
        terbuka++;
        terbukaSejak = akhir;
      }

      // Bandingkan: berapa paket terbuka menurut aturan per siswa pada pukul 06.00 yang sama?
      const sekarang = new Date(akhir);
      let terbukaLazy = 0;
      for (let i = 0; i < JUMLAH_PAKET; i++) {
        const st = putuskanStatusSeri({
          sekarang,
          sebelumnya: i === 0 ? null : { nama: `Paket ${i}` },
          sebelumnyaSelesaiPada: i === 0 ? null : selesaiPertama(percobaan[i - 1]!),
          sudahPernahMasuk: percobaan[i]!.length > 0,
        });
        if (!st.terkunci) terbukaLazy++;
        else break; // paket di atasnya yang terkunci tidak mungkin terbuka (rantai berurutan)
      }
      if (terbukaLazy !== terbuka) {
        throw new Error(`seed ${seed}, langkah ${langkah}: cron membuka ${terbuka} paket, aturan per siswa ${terbukaLazy}`);
      }
    }
    return { percobaan, terbuka };
  }

  it("2.000 skenario acak: jumlah paket terbuka selalu sama di setiap pukul 06.00", () => {
    let totalTerbuka = 0;
    for (let seed = 1; seed <= 2_000; seed++) totalTerbuka += jalankanSkenario(seed).terbuka;
    // Pastikan skenarionya memang bergerak (tidak semua siswa diam di paket pertama).
    expect(totalTerbuka / 2_000).toBeGreaterThan(1.8);
  }, 180_000);

  it("jeda antar paket yang terbuka selalu kelipatan 24 jam dan minimal 24 jam (paling banyak satu paket per hari)", () => {
    const rand = mulberry32(99);
    for (let i = 0; i < 2_000; i++) {
      // Siswa mengerjakan tiap paket pada waktu acak setelah paket itu terbuka. Paket pertama terbuka kapan saja
      // (saat dipublish); paket ke-2 dan seterusnya selalu terbuka tepat pukul 06.00 WIB.
      let terbukaPada = Date.UTC(2026, 9, 1) + Math.floor(rand() * 3 * HARI);
      let terbuka06Sebelumnya: number | null = null;
      for (let paket = 0; paket < 8; paket++) {
        const selesai = terbukaPada + 1 + Math.floor(rand() * 6 * HARI);
        const berikutnya = jam6WIBBerikutnya(new Date(selesai)).getTime();
        if (terbuka06Sebelumnya != null) {
          const jeda = berikutnya - terbuka06Sebelumnya;
          expect(jeda % HARI).toBe(0);
          expect(jeda).toBeGreaterThanOrEqual(HARI);
        }
        terbuka06Sebelumnya = berikutnya;
        terbukaPada = berikutnya;
      }
    }
  }, 60_000);
});
