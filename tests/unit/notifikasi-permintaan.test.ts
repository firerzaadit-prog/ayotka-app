import { beforeEach, describe, expect, it, vi } from "vitest";
import { buatEmailPermintaanPerpanjangan } from "@/lib/email/permintaan-perpanjangan";
import { kirimNotifikasiPermintaan, type DependensiNotifikasi } from "@/lib/billing/notifikasi-permintaan";
import { akhirHariWIB, startOfDayWIB } from "@/lib/utils/datetime";

const MULAI = startOfDayWIB("2026-07-01");
const BERAKHIR = akhirHariWIB("2026-12-31");
const m = vi.hoisted(() => ({ kirim: vi.fn() }));

describe("buatEmailPermintaanPerpanjangan", () => {
  const isi = {
    namaSekolah: "SMP Negeri 1 Madiun",
    kuotaDiminta: 1200,
    mulaiDiminta: MULAI,
    berakhirDiminta: BERAKHIR,
    catatan: "Mohon dipercepat" as string | null,
    siswaAktif: 95,
    diajukanOleh: "admin@smpn1.sch.id" as string | null,
    urlSekolah: "https://ayotka.id/admin-pusat/sekolah/abc-123",
  };

  it("memuat nama sekolah, periode, kuota, siswa aktif, pengaju, catatan, dan tautan ke halaman sekolah", () => {
    const { subject, html } = buatEmailPermintaanPerpanjangan(isi);
    expect(subject).toBe("Permintaan perpanjangan langganan: SMP Negeri 1 Madiun");
    expect(html).toContain("SMP Negeri 1 Madiun");
    expect(html).toContain("1 Juli 2026");
    expect(html).toContain("31 Desember 2026");
    expect(html).toContain("1.200");
    expect(html).toContain("95");
    expect(html).toContain("admin@smpn1.sch.id");
    expect(html).toContain("Mohon dipercepat");
    expect(html).toContain('href="https://ayotka.id/admin-pusat/sekolah/abc-123"');
  });

  it("nilai dari pengguna di-escape: nama sekolah, catatan, dan email pengaju tidak bisa menyisipkan HTML", () => {
    const { html } = buatEmailPermintaanPerpanjangan({
      ...isi,
      namaSekolah: '<script>alert("x")</script>',
      catatan: '<img src=x onerror="y">',
      diajukanOleh: '"><b>x</b>',
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("baris baru di nama sekolah dibuang dari subjek (tidak bisa menyisipkan header surat)", () => {
    const { subject } = buatEmailPermintaanPerpanjangan({ ...isi, namaSekolah: "SMP\r\nBcc: korban@contoh.id" });
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it("tanpa catatan atau tanpa pengaju: bagian itu tidak muncul", () => {
    const { html } = buatEmailPermintaanPerpanjangan({ ...isi, catatan: "   ", diajukanOleh: null });
    expect(html).not.toContain("Catatan dari sekolah");
    expect(html).not.toContain(" oleh ");
  });
});

describe("kirimNotifikasiPermintaan", () => {
  type Admin = { email: string };
  let admin: Admin[];
  let permintaan: Record<string, unknown> | null;
  let siswaAktif: number;
  let dbGagal: boolean;

  const deps = (): DependensiNotifikasi => ({
    appUrl: "https://ayotka.id",
    kirim: m.kirim,
    db: {
      permintaanPerpanjangan: {
        findUnique: async () => {
          if (dbGagal) throw new Error("db putus");
          return permintaan;
        },
      },
      user: { findMany: async ({ where }: { where: { role: string; status: string } }) => (where.role === "admin_pusat" && where.status === "aktif" ? admin : []) },
      student: { count: async () => siswaAktif },
    } as never,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    admin = [{ email: "pusat1@ayotka.id" }, { email: "pusat2@ayotka.id" }];
    siswaAktif = 95;
    dbGagal = false;
    permintaan = {
      id: "r1",
      schoolId: "sch-1",
      status: "menunggu",
      kuotaDiminta: 120,
      mulaiDiminta: MULAI,
      berakhirDiminta: BERAKHIR,
      catatan: null,
      school: { id: "sch-1", nama: "SMP 1" },
      diajukanOleh: { email: "admin@smp1.id" },
    };
    m.kirim.mockResolvedValue({ ok: true });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("mengirim satu email ke tiap admin pusat aktif, dengan tautan ke halaman sekolah yang diajukan", async () => {
    const hasil = await kirimNotifikasiPermintaan(deps(), "r1");
    expect(hasil).toEqual({ penerima: 2, terkirim: 2, gagal: 0 });
    expect(m.kirim.mock.calls.map((c) => c[0].to).sort()).toEqual(["pusat1@ayotka.id", "pusat2@ayotka.id"]);
    const email = m.kirim.mock.calls[0]![0];
    expect(email.subject).toBe("Permintaan perpanjangan langganan: SMP 1");
    expect(email.html).toContain("https://ayotka.id/admin-pusat/sekolah/sch-1");
    expect(email.html).toContain("admin@smp1.id");
  });

  it("alamat ganda dan kosong dibuang (satu orang tidak dikirimi dua kali)", async () => {
    admin = [{ email: "pusat1@ayotka.id" }, { email: " pusat1@ayotka.id " }, { email: "" }, { email: "   " }];
    const hasil = await kirimNotifikasiPermintaan(deps(), "r1");
    expect(hasil.penerima).toBe(1);
    expect(m.kirim).toHaveBeenCalledTimes(1);
  });

  it("satu pengiriman gagal tidak menghentikan yang lain, dan dihitung terpisah", async () => {
    m.kirim.mockResolvedValueOnce({ ok: false, error: "kuota habis" }).mockResolvedValueOnce({ ok: true });
    expect(await kirimNotifikasiPermintaan(deps(), "r1")).toEqual({ penerima: 2, terkirim: 1, gagal: 1 });
  });

  it("pengirim email yang melempar galat dihitung gagal dan tidak melempar keluar", async () => {
    m.kirim.mockRejectedValue(new Error("jaringan putus"));
    await expect(kirimNotifikasiPermintaan(deps(), "r1")).resolves.toEqual({ penerima: 2, terkirim: 0, gagal: 2 });
  });

  it("tidak ada admin pusat aktif: tidak mengirim apa pun dan tidak melempar galat", async () => {
    admin = [];
    expect(await kirimNotifikasiPermintaan(deps(), "r1")).toEqual({ penerima: 0, terkirim: 0, gagal: 0 });
    expect(m.kirim).not.toHaveBeenCalled();
  });

  it("permintaan tidak ada, atau sudah diproses: tidak mengirim email", async () => {
    permintaan = null;
    expect((await kirimNotifikasiPermintaan(deps(), "r1")).penerima).toBe(0);
    permintaan = { id: "r1", status: "disetujui" };
    expect((await kirimNotifikasiPermintaan(deps(), "r1")).penerima).toBe(0);
    expect(m.kirim).not.toHaveBeenCalled();
  });

  it("database galat: tidak melempar (email hanya tambahan, tidak boleh mengganggu pengajuan)", async () => {
    dbGagal = true;
    await expect(kirimNotifikasiPermintaan(deps(), "r1")).resolves.toEqual({ penerima: 0, terkirim: 0, gagal: 0 });
    expect(m.kirim).not.toHaveBeenCalled();
  });
});
