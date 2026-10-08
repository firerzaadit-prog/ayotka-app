import { describe, expect, it } from "vitest";
import { kabupatenKotaDiProvinsi } from "@/lib/wilayah";
import {
  FILTER_WILAYAH_KOSONG,
  bacaPermintaanFilterWilayah,
  gabungkanFilterWilayah,
  provinsiSekolah,
  sekolahCocok,
  sekolahDalamCakupan,
  whereSekolahWilayah,
} from "@/lib/wilayah/cakupan";

const MALANG = "Kota Malang";
const SURABAYA = "Kota Surabaya";
const BANDUNG = "Kota Bandung";
const JATIM = "Jawa Timur";

describe("whereSekolahWilayah", () => {
  it("tanpa filter: kosong (tidak menyaring)", () => {
    expect(whereSekolahWilayah({})).toEqual({});
    expect(whereSekolahWilayah(FILTER_WILAYAH_KOSONG)).toEqual({});
  });

  it("kota/kabupaten: cukup satu kondisi (provinsinya sudah pasti)", () => {
    expect(whereSekolahWilayah({ provinsi: JATIM, kabupatenKota: MALANG })).toEqual({ kabupatenKota: MALANG });
    expect(whereSekolahWilayah({ kabupatenKota: MALANG })).toEqual({ kabupatenKota: MALANG });
  });

  it("hanya provinsi: kolom provinsi ATAU kota/kabupaten di provinsi itu (sekolah yang provinsinya belum terisi ikut)", () => {
    const where = whereSekolahWilayah({ provinsi: JATIM }) as { OR: [{ provinsi: string }, { kabupatenKota: { in: string[] } }] };
    expect(where.OR[0]).toEqual({ provinsi: JATIM });
    expect(where.OR[1].kabupatenKota.in).toEqual([...kabupatenKotaDiProvinsi(JATIM)]);
    expect(where.OR[1].kabupatenKota.in).toContain(MALANG);
    expect(where.OR[1].kabupatenKota.in).not.toContain(BANDUNG);
  });

  it("status sekolah digabung dengan wilayah", () => {
    expect(whereSekolahWilayah({ kabupatenKota: MALANG, statusSekolah: "swasta" })).toEqual({ kabupatenKota: MALANG, statusSekolah: "swasta" });
    expect(whereSekolahWilayah({ statusSekolah: "negeri" })).toEqual({ statusSekolah: "negeri" });
  });
});

describe("sekolahCocok - padanan whereSekolahWilayah di memori", () => {
  const s = (provinsi: string | null, kabupatenKota: string | null, statusSekolah: "negeri" | "swasta" | null = null) => ({
    provinsi,
    kabupatenKota,
    statusSekolah,
  });

  it("tanpa filter: semua sekolah cocok, termasuk yang datanya kosong", () => {
    expect(sekolahCocok(s(null, null), {})).toBe(true);
    expect(sekolahCocok(null, {})).toBe(true);
  });

  it("filter kota/kabupaten", () => {
    expect(sekolahCocok(s(JATIM, MALANG), { kabupatenKota: MALANG })).toBe(true);
    expect(sekolahCocok(s(JATIM, SURABAYA), { kabupatenKota: MALANG })).toBe(false);
    expect(sekolahCocok(s(JATIM, null), { kabupatenKota: MALANG })).toBe(false);
  });

  it("filter provinsi: kolom provinsi kosong dilengkapi dari kota/kabupaten", () => {
    expect(sekolahCocok(s(JATIM, MALANG), { provinsi: JATIM })).toBe(true);
    expect(sekolahCocok(s(null, MALANG), { provinsi: JATIM })).toBe(true);
    expect(sekolahCocok(s(JATIM, null), { provinsi: JATIM })).toBe(true);
    expect(sekolahCocok(s("Jawa Barat", BANDUNG), { provinsi: JATIM })).toBe(false);
    expect(sekolahCocok(s(null, null), { provinsi: JATIM })).toBe(false);
    expect(provinsiSekolah(s(null, MALANG))).toBe(JATIM);
    expect(provinsiSekolah(s(null, null))).toBeNull();
  });

  it("filter status sekolah: sekolah yang belum diisi statusnya tidak ikut saat status dipilih", () => {
    expect(sekolahCocok(s(JATIM, MALANG, "negeri"), { statusSekolah: "negeri" })).toBe(true);
    expect(sekolahCocok(s(JATIM, MALANG, "swasta"), { statusSekolah: "negeri" })).toBe(false);
    expect(sekolahCocok(s(JATIM, MALANG, null), { statusSekolah: "negeri" })).toBe(false);
    expect(sekolahCocok(s(JATIM, MALANG, null), { statusSekolah: null })).toBe(true);
  });

  it("sekolah tidak ada: hanya cocok bila tidak ada filter apa pun", () => {
    expect(sekolahCocok(null, { provinsi: JATIM })).toBe(false);
    expect(sekolahCocok(undefined, { statusSekolah: "negeri" })).toBe(false);
  });
});

describe("sekolahDalamCakupan - gagal tertutup", () => {
  it("cakupan kosong atau null: tidak boleh melihat sekolah mana pun", () => {
    expect(sekolahDalamCakupan({ provinsi: JATIM, kabupatenKota: MALANG }, null)).toBe(false);
    expect(sekolahDalamCakupan({ provinsi: JATIM, kabupatenKota: MALANG }, { provinsi: null, kabupatenKota: null })).toBe(false);
  });

  it("sekolah tidak ada: tidak boleh", () => {
    expect(sekolahDalamCakupan(null, { provinsi: JATIM, kabupatenKota: null })).toBe(false);
  });

  it("cakupan kota/kabupaten dan cakupan provinsi", () => {
    const sekolah = { provinsi: JATIM, kabupatenKota: MALANG };
    expect(sekolahDalamCakupan(sekolah, { provinsi: JATIM, kabupatenKota: MALANG })).toBe(true);
    expect(sekolahDalamCakupan(sekolah, { provinsi: JATIM, kabupatenKota: SURABAYA })).toBe(false);
    expect(sekolahDalamCakupan(sekolah, { provinsi: JATIM, kabupatenKota: null })).toBe(true);
    expect(sekolahDalamCakupan(sekolah, { provinsi: "Jawa Barat", kabupatenKota: null })).toBe(false);
  });
});

describe("gabungkanFilterWilayah", () => {
  const PUSAT = { provinsi: null, kabupatenKota: null };
  const PROV = { provinsi: JATIM, kabupatenKota: null };
  const KOTA = { provinsi: JATIM, kabupatenKota: MALANG };

  describe("admin pusat (cakupan kosong)", () => {
    it("tanpa permintaan: tanpa filter", () => {
      expect(gabungkanFilterWilayah(PUSAT, {})).toEqual({ ok: true, filter: FILTER_WILAYAH_KOSONG });
    });

    it("bebas memilih provinsi atau kota/kabupaten; provinsi dilengkapi dari kota/kabupaten", () => {
      expect(gabungkanFilterWilayah(PUSAT, { provinsi: "Bali" })).toEqual({
        ok: true,
        filter: { provinsi: "Bali", kabupatenKota: null, statusSekolah: null },
      });
      expect(gabungkanFilterWilayah(PUSAT, { kabupatenKota: BANDUNG })).toEqual({
        ok: true,
        filter: { provinsi: "Jawa Barat", kabupatenKota: BANDUNG, statusSekolah: null },
      });
    });

    it("pasangan tidak cocok: 400", () => {
      const hasil = gabungkanFilterWilayah(PUSAT, { provinsi: "Bali", kabupatenKota: MALANG });
      expect(hasil).toMatchObject({ ok: false, status: 400 });
    });

    it("nama tidak dikenal: 400", () => {
      expect(gabungkanFilterWilayah(PUSAT, { provinsi: "Atlantis" })).toMatchObject({ ok: false, status: 400 });
      expect(gabungkanFilterWilayah(PUSAT, { kabupatenKota: "Kota Atlantis" })).toMatchObject({ ok: false, status: 400 });
    });
  });

  describe("dinas provinsi", () => {
    it("tanpa permintaan: seluruh provinsinya", () => {
      expect(gabungkanFilterWilayah(PROV, {})).toEqual({ ok: true, filter: { provinsi: JATIM, kabupatenKota: null, statusSekolah: null } });
    });

    it("boleh mempersempit ke satu kota/kabupaten di provinsinya", () => {
      expect(gabungkanFilterWilayah(PROV, { kabupatenKota: SURABAYA })).toEqual({
        ok: true,
        filter: { provinsi: JATIM, kabupatenKota: SURABAYA, statusSekolah: null },
      });
      expect(gabungkanFilterWilayah(PROV, { provinsi: JATIM, kabupatenKota: SURABAYA })).toMatchObject({ ok: true });
    });

    it("provinsi lain atau kota/kabupaten provinsi lain: 403", () => {
      expect(gabungkanFilterWilayah(PROV, { provinsi: "Bali" })).toMatchObject({ ok: false, status: 403 });
      expect(gabungkanFilterWilayah(PROV, { kabupatenKota: BANDUNG })).toMatchObject({ ok: false, status: 403 });
    });
  });

  describe("dinas kota/kabupaten", () => {
    it("selalu terkunci di kota/kabupatennya", () => {
      expect(gabungkanFilterWilayah(KOTA, {})).toEqual({ ok: true, filter: { provinsi: JATIM, kabupatenKota: MALANG, statusSekolah: null } });
      expect(gabungkanFilterWilayah(KOTA, { provinsi: JATIM })).toMatchObject({ ok: true });
    });

    it("kota/kabupaten lain, walau di provinsi yang sama: 403", () => {
      expect(gabungkanFilterWilayah(KOTA, { kabupatenKota: SURABAYA })).toMatchObject({ ok: false, status: 403 });
      expect(gabungkanFilterWilayah(KOTA, { provinsi: "Jawa Barat" })).toMatchObject({ ok: false, status: 403 });
    });

    it("akun lama tanpa kolom provinsi: provinsi diturunkan dari kota/kabupaten", () => {
      expect(gabungkanFilterWilayah({ provinsi: null, kabupatenKota: MALANG }, {})).toEqual({
        ok: true,
        filter: { provinsi: JATIM, kabupatenKota: MALANG, statusSekolah: null },
      });
    });
  });

  it("cakupan dengan nama provinsi yang rusak: ditolak, bukan dianggap bebas", () => {
    expect(gabungkanFilterWilayah({ provinsi: "Atlantis", kabupatenKota: null }, {})).toMatchObject({ ok: false, status: 403 });
  });

  describe("status sekolah", () => {
    it.each([
      [undefined, null],
      [null, null],
      ["", null],
      ["  ", null],
      ["semua", null],
      ["negeri", "negeri"],
      ["swasta", "swasta"],
    ])("%j -> %j", (masukan, harapan) => {
      expect(gabungkanFilterWilayah(PUSAT, { statusSekolah: masukan as string | null | undefined })).toEqual({
        ok: true,
        filter: { provinsi: null, kabupatenKota: null, statusSekolah: harapan },
      });
    });

    it.each(["Negeri", "pemerintah", "NEGERI", "1"])("%j ditolak 400", (nilai) => {
      expect(gabungkanFilterWilayah(PUSAT, { statusSekolah: nilai })).toMatchObject({ ok: false, status: 400 });
    });
  });
});

describe("bacaPermintaanFilterWilayah", () => {
  it("membaca tiga parameter URL apa adanya (validasi di gabungkanFilterWilayah)", () => {
    const qs = new URLSearchParams({ provinsi: "Bali", kabupatenKota: "Kota Denpasar", statusSekolah: "negeri", lain: "x" });
    expect(bacaPermintaanFilterWilayah(qs)).toEqual({ provinsi: "Bali", kabupatenKota: "Kota Denpasar", statusSekolah: "negeri" });
    expect(bacaPermintaanFilterWilayah(new URLSearchParams())).toEqual({ provinsi: null, kabupatenKota: null, statusSekolah: null });
  });
});
