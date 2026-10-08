import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  schoolFindMany: vi.fn(),
  attemptFindMany: vi.fn(),
  subjectFindMany: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    school: { findMany: m.schoolFindMany },
    attempt: { findMany: m.attemptFindMany },
    subject: { findMany: m.subjectFindMany },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rateLimit }));

import { FilterWilayah, PilihStatusSekolah, PilihWilayah, nilaiAwalFilterWilayah, tambahkanParamWilayah } from "@/components/wilayah/pilih-wilayah";
import { buildAnalitikGlobal, buildDaftarSiswaKesiapanAntarSekolah, buildKesiapanAntarSekolah, buildStatistikMataPelajaran } from "@/lib/analytics/global";
import { GET as cariSekolahGET } from "@/app/api/registrasi/cari-sekolah/route";

/** Atribut disabled sungguhan (bukan potongan kelas Tailwind "disabled:..."). */
const terkunci = (blok: string) => /\sdisabled=""/.test(blok);

const hitungOpsi = (html: string, id: string) => {
  const blok = html.match(new RegExp(`<select[^>]*id="${id}"[\\s\\S]*?</select>`))?.[0] ?? "";
  return { blok, opsi: (blok.match(/<option/g) ?? []).length };
};

describe("PilihWilayah", () => {
  const render = (props: Partial<Parameters<typeof PilihWilayah>[0]> = {}) =>
    renderToStaticMarkup(createElement(PilihWilayah, { idAwalan: "t", provinsi: "", kabupatenKota: "", onChange: () => undefined, ...props }));

  it("belum ada provinsi: 38 provinsi (+ opsi kosong) dan kota/kabupaten terkunci", () => {
    const html = render();
    expect(hitungOpsi(html, "t-provinsi").opsi).toBe(39);
    const kab = hitungOpsi(html, "t-kabupaten-kota");
    expect(kab.opsi).toBe(1);
    expect(terkunci(kab.blok)).toBe(true);
    expect(kab.blok).toContain("Pilih provinsi dulu");
  });

  it("provinsi dipilih: kota/kabupaten hanya milik provinsi itu", () => {
    const html = render({ provinsi: "Bali" });
    const kab = hitungOpsi(html, "t-kabupaten-kota");
    expect(kab.opsi).toBe(1 + 9); // Bali: 8 kabupaten + Kota Denpasar
    expect(kab.blok).toContain("Kota Denpasar");
    expect(kab.blok).not.toContain("Kota Malang");
    expect(terkunci(kab.blok)).toBe(false);
  });

  it("data lama yang hanya punya kota/kabupaten tetap tampil lengkap dengan provinsinya", () => {
    const html = render({ provinsi: "", kabupatenKota: "Kota Malang" });
    expect(hitungOpsi(html, "t-provinsi").blok).toMatch(/<option value="Jawa Timur" selected/);
    expect(hitungOpsi(html, "t-kabupaten-kota").blok).toMatch(/<option value="Kota Malang" selected/);
  });

  it("kota/kabupaten yang tidak dikenal tidak hilang diam-diam dari pilihan", () => {
    const html = render({ provinsi: "Bali", kabupatenKota: "Kota Entah" });
    expect(hitungOpsi(html, "t-kabupaten-kota").blok).toContain("Kota Entah");
  });

  it("wajib mengisi: atribut required pada kedua pilihan, dan kota/kabupaten bisa dilonggarkan (Dinas Provinsi)", () => {
    const ketat = render({ provinsi: "Bali", wajib: true });
    expect(hitungOpsi(ketat, "t-provinsi").blok).toContain("required");
    expect(hitungOpsi(ketat, "t-kabupaten-kota").blok).toContain("required");
    const longgar = render({ provinsi: "Bali", wajib: true, wajibKabupatenKota: false });
    expect(hitungOpsi(longgar, "t-provinsi").blok).toContain("required");
    expect(hitungOpsi(longgar, "t-kabupaten-kota").blok).not.toContain("required");
  });

  it("PilihStatusSekolah: opsi kosong + Negeri + Swasta", () => {
    const html = renderToStaticMarkup(createElement(PilihStatusSekolah, { id: "s", value: "swasta", onChange: () => undefined }));
    expect(hitungOpsi(html, "s").opsi).toBe(3);
    expect(html).toMatch(/<option value="swasta" selected/);
    expect(html).toContain("Negeri");
  });
});

describe("FilterWilayah (filter analitik)", () => {
  const render = (nilai = nilaiAwalFilterWilayah(null), cakupan?: Parameters<typeof FilterWilayah>[0]["cakupan"]) =>
    renderToStaticMarkup(createElement(FilterWilayah, { idAwalan: "f", nilai, onChange: () => undefined, cakupan }));

  it("admin pusat: provinsi bebas, kota/kabupaten menunggu provinsi, status bebas", () => {
    const html = render();
    expect(terkunci(hitungOpsi(html, "f-provinsi").blok)).toBe(false);
    expect(terkunci(hitungOpsi(html, "f-kabupaten-kota").blok)).toBe(true);
    expect(terkunci(hitungOpsi(html, "f-status").blok)).toBe(false);
    expect(html).toContain("Negeri + Swasta");
  });

  it("dinas provinsi: provinsi terkunci, kota/kabupaten dalam provinsi itu bebas dipilih", () => {
    const cakupan = { provinsi: "Jawa Timur", kabupatenKota: null };
    const html = render(nilaiAwalFilterWilayah(cakupan), cakupan);
    expect(terkunci(hitungOpsi(html, "f-provinsi").blok)).toBe(true);
    expect(hitungOpsi(html, "f-provinsi").blok).toMatch(/<option value="Jawa Timur" selected/);
    expect(terkunci(hitungOpsi(html, "f-kabupaten-kota").blok)).toBe(false);
    expect(hitungOpsi(html, "f-kabupaten-kota").opsi).toBe(1 + 38);
  });

  it("dinas kota/kabupaten: provinsi dan kota/kabupaten terkunci, status tetap bebas", () => {
    const cakupan = { provinsi: "Jawa Timur", kabupatenKota: "Kota Malang" };
    const html = render(nilaiAwalFilterWilayah(cakupan), cakupan);
    expect(terkunci(hitungOpsi(html, "f-provinsi").blok)).toBe(true);
    expect(terkunci(hitungOpsi(html, "f-kabupaten-kota").blok)).toBe(true);
    expect(hitungOpsi(html, "f-kabupaten-kota").blok).toMatch(/<option value="Kota Malang" selected/);
    expect(terkunci(hitungOpsi(html, "f-status").blok)).toBe(false);
  });

  it("nilaiAwalFilterWilayah: akun lama tanpa provinsi memperoleh provinsi dari kota/kabupaten; tanpa cakupan = kosong", () => {
    expect(nilaiAwalFilterWilayah({ provinsi: null, kabupatenKota: "Kota Malang" })).toEqual({ provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: "" });
    expect(nilaiAwalFilterWilayah(null)).toEqual({ provinsi: "", kabupatenKota: "", statusSekolah: "" });
    expect(nilaiAwalFilterWilayah(undefined)).toEqual({ provinsi: "", kabupatenKota: "", statusSekolah: "" });
  });

  it("tambahkanParamWilayah: hanya yang terisi yang dikirim", () => {
    const qs = new URLSearchParams();
    tambahkanParamWilayah(qs, { provinsi: "Bali", kabupatenKota: "", statusSekolah: "swasta" });
    expect(qs.toString()).toBe("provinsi=Bali&statusSekolah=swasta");
    const kosong = new URLSearchParams();
    tambahkanParamWilayah(kosong, { provinsi: "", kabupatenKota: "", statusSekolah: "" });
    expect(kosong.toString()).toBe("");
  });
});

describe("agregasi lintas sekolah memakai filter wilayah dan status", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.schoolFindMany.mockResolvedValue([]);
    m.attemptFindMany.mockResolvedValue([]);
    m.subjectFindMany.mockResolvedValue([]);
  });
  const whereSekolah = () => (m.schoolFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }).where;

  const kasus = [
    ["buildAnalitikGlobal", (f: object) => buildAnalitikGlobal(f)],
    ["buildStatistikMataPelajaran", (f: object) => buildStatistikMataPelajaran(f)],
    ["buildKesiapanAntarSekolah", (f: object) => buildKesiapanAntarSekolah(f)],
    ["buildDaftarSiswaKesiapanAntarSekolah", (f: object) => buildDaftarSiswaKesiapanAntarSekolah({ subjectNama: "Matematika", ...f })],
  ] as const;

  it.each(kasus)("%s: kota/kabupaten dan status diteruskan ke pencarian sekolah", async (_nama, panggil) => {
    await panggil({ provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: "negeri" });
    expect(whereSekolah()).toMatchObject({ status: "aktif", kabupatenKota: "Kota Malang", statusSekolah: "negeri" });
    expect(whereSekolah()).not.toHaveProperty("OR");
  });

  it.each(kasus)("%s: hanya provinsi -> semua kota/kabupaten di provinsi itu", async (_nama, panggil) => {
    await panggil({ provinsi: "Bali" });
    const where = whereSekolah() as { OR: [{ provinsi: string }, { kabupatenKota: { in: string[] } }] };
    expect(where.OR[0]).toEqual({ provinsi: "Bali" });
    expect(where.OR[1].kabupatenKota.in).toContain("Kota Denpasar");
    expect(where.OR[1].kabupatenKota.in).not.toContain("Kota Malang");
  });

  it.each(kasus)("%s: tanpa filter wilayah tidak menambah kondisi (perilaku lama)", async (_nama, panggil) => {
    await panggil({});
    const where = whereSekolah();
    for (const k of ["kabupatenKota", "provinsi", "statusSekolah", "OR"]) expect(where).not.toHaveProperty(k);
  });

  it.each(kasus)("%s: filter lain (jenjang, alamat) tetap berlaku bersama filter wilayah", async (_nama, panggil) => {
    await panggil({ jenjang: "SD", wilayah: "Malang", statusSekolah: "swasta" });
    expect(whereSekolah()).toMatchObject({ jenjang: "SD", alamat: { contains: "Malang", mode: "insensitive" }, statusSekolah: "swasta" });
  });
});

describe("GET /api/registrasi/cari-sekolah", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.rateLimit.mockReturnValue(true);
    m.schoolFindMany.mockResolvedValue([{ id: "s1", nama: "SD Negeri 1", npsn: null, jenjang: "SD", provinsi: "Jawa Timur", kabupatenKota: "Kota Malang", statusSekolah: "negeri" }]);
  });

  it("hasil memuat kota/kabupaten dan status supaya siswa bisa membedakan sekolah bernama sama", async () => {
    const res = await cariSekolahGET(new Request("http://localhost/api/registrasi/cari-sekolah?q=Negeri&jenjang=SD"));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { schools: Array<Record<string, unknown>> }).schools[0]).toMatchObject({ kabupatenKota: "Kota Malang", statusSekolah: "negeri", provinsi: "Jawa Timur" });
    const select = (m.schoolFindMany.mock.calls[0]![0] as { select: Record<string, boolean> }).select;
    expect(select).toMatchObject({ provinsi: true, kabupatenKota: true, statusSekolah: true });
  });

  it("sekolah menunggu verifikasi tetap tidak muncul di pilihan siswa lain", async () => {
    await cariSekolahGET(new Request("http://localhost/api/registrasi/cari-sekolah?q=Negeri"));
    expect((m.schoolFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }).where).toMatchObject({ status: { not: "pending_verifikasi" } });
  });
});
