import { describe, expect, it } from "vitest";
import { DATA_WILAYAH_INDONESIA } from "@/lib/constants/wilayah-indonesia";
import {
  DAFTAR_PROVINSI,
  JUMLAH_KABUPATEN_KOTA,
  adalahKabupatenKota,
  adalahProvinsi,
  adalahStatusSekolah,
  kabupatenKotaDiProvinsi,
  labelStatusSekolah,
  periksaPasanganWilayah,
  provinsiDariKabupatenKota,
  statusSekolahUntukSimpan,
  wilayahSetelahPerubahan,
} from "@/lib/wilayah";

const JATIM_LAMA = [
  "Kabupaten Bangkalan", "Kabupaten Banyuwangi", "Kabupaten Blitar", "Kabupaten Bojonegoro", "Kabupaten Bondowoso",
  "Kabupaten Gresik", "Kabupaten Jember", "Kabupaten Jombang", "Kabupaten Kediri", "Kabupaten Lamongan",
  "Kabupaten Lumajang", "Kabupaten Madiun", "Kabupaten Magetan", "Kabupaten Malang", "Kabupaten Mojokerto",
  "Kabupaten Nganjuk", "Kabupaten Ngawi", "Kabupaten Pacitan", "Kabupaten Pamekasan", "Kabupaten Pasuruan",
  "Kabupaten Ponorogo", "Kabupaten Probolinggo", "Kabupaten Sampang", "Kabupaten Sidoarjo", "Kabupaten Situbondo",
  "Kabupaten Sumenep", "Kabupaten Trenggalek", "Kabupaten Tuban", "Kabupaten Tulungagung", "Kota Batu", "Kota Blitar",
  "Kota Kediri", "Kota Madiun", "Kota Malang", "Kota Mojokerto", "Kota Pasuruan", "Kota Probolinggo", "Kota Surabaya",
];

describe("data wilayah Indonesia", () => {
  const semuaKabKota = DATA_WILAYAH_INDONESIA.flatMap((d) => d.kabupatenKota);

  it("38 provinsi, 514 kabupaten/kota (416 kabupaten + 98 kota) sesuai Kepmendagri 2025", () => {
    expect(DAFTAR_PROVINSI).toHaveLength(38);
    expect(semuaKabKota).toHaveLength(514);
    expect(JUMLAH_KABUPATEN_KOTA).toBe(514);
    expect(semuaKabKota.filter((k) => k.startsWith("Kabupaten "))).toHaveLength(416);
    expect(semuaKabKota.filter((k) => k.startsWith("Kota "))).toHaveLength(98);
  });

  it("nama provinsi dan kabupaten/kota unik secara nasional (nama saja cukup sebagai kunci wilayah)", () => {
    expect(new Set(DAFTAR_PROVINSI).size).toBe(38);
    expect(new Set(semuaKabKota).size).toBe(514);
  });

  it("tiap provinsi punya kabupaten/kota, semuanya berawalan 'Kabupaten ' atau 'Kota ', tanpa spasi di tepi", () => {
    for (const d of DATA_WILAYAH_INDONESIA) {
      expect(d.kabupatenKota.length, d.provinsi).toBeGreaterThan(0);
      for (const k of d.kabupatenKota) {
        expect(/^(Kabupaten|Kota) \S/.test(k), k).toBe(true);
        expect(k, k).toBe(k.trim());
      }
      expect(d.provinsi).toBe(d.provinsi.trim());
    }
  });

  it("provinsi Papua hasil pemekaran 2022 ada", () => {
    for (const p of ["Papua", "Papua Barat", "Papua Selatan", "Papua Tengah", "Papua Pegunungan", "Papua Barat Daya"]) {
      expect(adalahProvinsi(p), p).toBe(true);
    }
  });

  it("daftar Jawa Timur sama persis dengan daftar lama, jadi data sekolah/dinas yang sudah ada tetap sah", () => {
    expect([...kabupatenKotaDiProvinsi("Jawa Timur")].sort()).toEqual([...JATIM_LAMA].sort());
    for (const k of JATIM_LAMA) expect(provinsiDariKabupatenKota(k), k).toBe("Jawa Timur");
    expect(JATIM_LAMA).toHaveLength(38);
    expect(JATIM_LAMA.filter((k) => k.startsWith("Kabupaten "))).toHaveLength(29);
    expect(JATIM_LAMA.filter((k) => k.startsWith("Kota "))).toHaveLength(9);
  });

  it("urutan: provinsi A-Z; di tiap provinsi kabupaten dulu lalu kota", () => {
    expect([...DAFTAR_PROVINSI]).toEqual([...DAFTAR_PROVINSI].sort((a, b) => a.localeCompare(b, "id")));
    const jatim = kabupatenKotaDiProvinsi("Jawa Timur");
    const awalKota = jatim.findIndex((k) => k.startsWith("Kota "));
    expect(jatim.slice(0, awalKota).every((k) => k.startsWith("Kabupaten "))).toBe(true);
    expect(jatim.slice(awalKota).every((k) => k.startsWith("Kota "))).toBe(true);
  });
});

describe("pencarian wilayah", () => {
  it("provinsiDariKabupatenKota: nama yang mirip di provinsi berbeda tidak tertukar", () => {
    expect(provinsiDariKabupatenKota("Kota Malang")).toBe("Jawa Timur");
    expect(provinsiDariKabupatenKota("Kabupaten Malang")).toBe("Jawa Timur");
    expect(provinsiDariKabupatenKota("Kota Bandung")).toBe("Jawa Barat");
    expect(provinsiDariKabupatenKota("Kabupaten Bandung")).toBe("Jawa Barat");
    expect(provinsiDariKabupatenKota("Kota Banda Aceh")).toBe("Aceh");
    expect(provinsiDariKabupatenKota("Kota Jayapura")).toBe("Papua");
    expect(provinsiDariKabupatenKota("Kabupaten Merauke")).toBe("Papua Selatan");
  });

  it("nama tidak dikenal, kosong, atau null: null / daftar kosong", () => {
    expect(provinsiDariKabupatenKota("Kota Atlantis")).toBeNull();
    expect(provinsiDariKabupatenKota("")).toBeNull();
    expect(provinsiDariKabupatenKota(null)).toBeNull();
    expect(provinsiDariKabupatenKota(undefined)).toBeNull();
    expect(kabupatenKotaDiProvinsi("Provinsi Fiktif")).toEqual([]);
    expect(kabupatenKotaDiProvinsi(null)).toEqual([]);
    expect(adalahKabupatenKota("malang")).toBe(false);
    expect(adalahProvinsi("jawa timur")).toBe(false);
  });

  it("prototype object tidak dianggap wilayah", () => {
    for (const nama of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(adalahProvinsi(nama), nama).toBe(false);
      expect(adalahKabupatenKota(nama), nama).toBe(false);
      expect(provinsiDariKabupatenKota(nama), nama).toBeNull();
    }
  });
});

describe("status sekolah", () => {
  it("hanya negeri dan swasta", () => {
    expect(adalahStatusSekolah("negeri")).toBe(true);
    expect(adalahStatusSekolah("swasta")).toBe(true);
    for (const v of ["Negeri", "", "pemerintah", null, undefined, 1]) expect(adalahStatusSekolah(v), String(v)).toBe(false);
  });

  it("label tampilan dan nilai simpan", () => {
    expect(labelStatusSekolah("negeri")).toBe("Negeri");
    expect(labelStatusSekolah("swasta")).toBe("Swasta");
    expect(labelStatusSekolah(null)).toBe("-");
    expect(labelStatusSekolah("lain")).toBe("-");
    expect(statusSekolahUntukSimpan("swasta")).toBe("swasta");
    expect(statusSekolahUntukSimpan("")).toBeNull();
    expect(statusSekolahUntukSimpan(undefined)).toBeNull();
    expect(statusSekolahUntukSimpan("x")).toBeNull();
  });
});

describe("periksaPasanganWilayah", () => {
  it("kota/kabupaten tanpa provinsi: provinsi dilengkapi (formulir lama hanya mengirim kota/kabupaten)", () => {
    expect(periksaPasanganWilayah({ kabupatenKota: "Kota Malang" })).toEqual({
      ok: true,
      nilai: { provinsi: "Jawa Timur", kabupatenKota: "Kota Malang" },
    });
  });

  it("provinsi dan kota/kabupaten cocok: lolos; spasi di tepi dibuang", () => {
    expect(periksaPasanganWilayah({ provinsi: " Jawa Barat ", kabupatenKota: " Kota Bandung " })).toEqual({
      ok: true,
      nilai: { provinsi: "Jawa Barat", kabupatenKota: "Kota Bandung" },
    });
  });

  it("hanya provinsi: kota/kabupaten null", () => {
    expect(periksaPasanganWilayah({ provinsi: "Bali" })).toEqual({ ok: true, nilai: { provinsi: "Bali", kabupatenKota: null } });
  });

  it("kosong semua: null dan null (bukan galat)", () => {
    expect(periksaPasanganWilayah({})).toEqual({ ok: true, nilai: { provinsi: null, kabupatenKota: null } });
    expect(periksaPasanganWilayah({ provinsi: "", kabupatenKota: "  " })).toEqual({ ok: true, nilai: { provinsi: null, kabupatenKota: null } });
  });

  it("kota/kabupaten bukan bagian provinsi yang dipilih: ditolak dengan pesan yang menyebut provinsi sebenarnya", () => {
    const hasil = periksaPasanganWilayah({ provinsi: "Jawa Barat", kabupatenKota: "Kota Malang" });
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.pesan).toBe("Kota Malang berada di Provinsi Jawa Timur, bukan di Jawa Barat. Pilih ulang kota/kabupaten.");
  });

  it("nama tidak dikenal ditolak", () => {
    expect(periksaPasanganWilayah({ provinsi: "Atlantis" })).toEqual({ ok: false, pesan: "Pilih provinsi yang valid." });
    expect(periksaPasanganWilayah({ kabupatenKota: "Kota Atlantis" })).toEqual({ ok: false, pesan: "Pilih kota/kabupaten yang valid." });
    expect(periksaPasanganWilayah({ provinsi: "Bali", kabupatenKota: "Kota Atlantis" }).ok).toBe(false);
  });
});

describe("wilayahSetelahPerubahan (PATCH sebagian)", () => {
  const SEBELUM = { provinsi: "Jawa Timur", kabupatenKota: "Kota Malang" };

  it("tidak ada yang dikirim: wilayah lama dibiarkan apa adanya (tanpa validasi ulang)", () => {
    expect(wilayahSetelahPerubahan({}, SEBELUM)).toEqual({ ok: true, nilai: SEBELUM });
    // data lama yang aneh pun tidak membuat perubahan lain (mis. ganti alamat) gagal
    const aneh = { provinsi: null, kabupatenKota: "Kota Tak Dikenal" };
    expect(wilayahSetelahPerubahan({}, aneh)).toEqual({ ok: true, nilai: aneh });
  });

  it("klien lama hanya mengirim kota/kabupaten: provinsi ikut kota/kabupaten baru, bukan data lama", () => {
    expect(wilayahSetelahPerubahan({ kabupatenKota: "Kota Bandung" }, SEBELUM)).toEqual({
      ok: true,
      nilai: { provinsi: "Jawa Barat", kabupatenKota: "Kota Bandung" },
    });
  });

  it("pindah provinsi sekaligus kota/kabupaten: lolos", () => {
    expect(wilayahSetelahPerubahan({ provinsi: "Bali", kabupatenKota: "Kota Denpasar" }, SEBELUM)).toEqual({
      ok: true,
      nilai: { provinsi: "Bali", kabupatenKota: "Kota Denpasar" },
    });
  });

  it("mengganti provinsi tanpa memilih ulang kota/kabupaten: ditolak bila kota/kabupaten lama bukan bagiannya", () => {
    const hasil = wilayahSetelahPerubahan({ provinsi: "Bali" }, SEBELUM);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.pesan).toMatch(/Kota Malang berada di Provinsi Jawa Timur/);
  });

  it("mengirim provinsi yang sama tanpa kota/kabupaten: aman", () => {
    expect(wilayahSetelahPerubahan({ provinsi: "Jawa Timur" }, SEBELUM)).toEqual({ ok: true, nilai: SEBELUM });
  });

  it("mengosongkan kota/kabupaten saja: provinsi dipertahankan (jadi cakupan provinsi)", () => {
    expect(wilayahSetelahPerubahan({ kabupatenKota: "" }, SEBELUM)).toEqual({
      ok: true,
      nilai: { provinsi: "Jawa Timur", kabupatenKota: null },
    });
  });

  it("mengosongkan keduanya: null dan null", () => {
    expect(wilayahSetelahPerubahan({ provinsi: "", kabupatenKota: "" }, SEBELUM)).toEqual({
      ok: true,
      nilai: { provinsi: null, kabupatenKota: null },
    });
    expect(wilayahSetelahPerubahan({ provinsi: null, kabupatenKota: null }, SEBELUM)).toEqual({
      ok: true,
      nilai: { provinsi: null, kabupatenKota: null },
    });
  });

  it("sekolah yang belum punya wilayah lalu diisi satu provinsi: kota/kabupaten tetap null", () => {
    expect(wilayahSetelahPerubahan({ provinsi: "Bali" }, { provinsi: null, kabupatenKota: null })).toEqual({
      ok: true,
      nilai: { provinsi: "Bali", kabupatenKota: null },
    });
  });
});
