import type { Prisma, PrismaClient } from "@prisma/client";
import { buatEmailPermintaanPerpanjangan } from "../email/permintaan-perpanjangan";

/**
 * Memberi tahu admin pusat lewat email saat admin sekolah mengajukan perpanjangan langganan. Sebelumnya permintaan
 * hanya tampil di widget dashboard admin pusat, jadi bisa terlewat kalau dashboard tidak dibuka (pendapatan
 * perpanjangan tertunda). Dipanggil SEKALI saat permintaan dibuat (hanya ada satu permintaan menunggu per sekolah),
 * sehingga tidak butuh catatan anti-ganda.
 *
 * Dependensi disuntikkan (database, pengirim email, alamat aplikasi) seperti lib/billing/pengingat-periode.ts supaya
 * bisa diuji tanpa jaringan. Fungsi ini TIDAK PERNAH melempar galat: email hanyalah pemberitahuan tambahan, kegagalannya
 * tidak boleh membatalkan atau mengganggu pengajuan yang sudah tersimpan.
 */
type DbNotifikasi = Pick<PrismaClient, "user" | "student" | "permintaanPerpanjangan"> | Prisma.TransactionClient;

export type DependensiNotifikasi = {
  db: DbNotifikasi;
  kirim: (email: { to: string; subject: string; html: string }) => Promise<{ ok: boolean; error?: string }>;
  /** Alamat dasar aplikasi tanpa garis miring akhir, mis. https://ayotka.id. */
  appUrl: string;
};

export type HasilNotifikasi = { penerima: number; terkirim: number; gagal: number };

export async function kirimNotifikasiPermintaan(
  { db, kirim, appUrl }: DependensiNotifikasi,
  permintaanId: string,
): Promise<HasilNotifikasi> {
  const hasil: HasilNotifikasi = { penerima: 0, terkirim: 0, gagal: 0 };
  try {
    const permintaan = await db.permintaanPerpanjangan.findUnique({
      where: { id: permintaanId },
      include: { school: { select: { id: true, nama: true } }, diajukanOleh: { select: { email: true } } },
    });
    if (!permintaan || permintaan.status !== "menunggu") return hasil;

    const [admin, siswaAktif] = await Promise.all([
      db.user.findMany({ where: { role: "admin_pusat", status: "aktif" }, select: { email: true } }),
      db.student.count({ where: { schoolId: permintaan.schoolId, jalur: "A", deletedAt: null, lulusAt: null } }),
    ]);
    const alamat = [...new Set(admin.map((a) => a.email.trim()).filter((e) => e.length > 0))];
    hasil.penerima = alamat.length;
    if (alamat.length === 0) {
      console.warn("[notifikasi-permintaan] tidak ada admin pusat aktif untuk diberi tahu.");
      return hasil;
    }

    const { subject, html } = buatEmailPermintaanPerpanjangan({
      namaSekolah: permintaan.school.nama,
      kuotaDiminta: permintaan.kuotaDiminta,
      mulaiDiminta: permintaan.mulaiDiminta,
      berakhirDiminta: permintaan.berakhirDiminta,
      catatan: permintaan.catatan,
      siswaAktif,
      diajukanOleh: permintaan.diajukanOleh?.email ?? null,
      urlSekolah: `${appUrl}/admin-pusat/sekolah/${permintaan.school.id}`,
    });

    for (const to of alamat) {
      try {
        const r = await kirim({ to, subject, html });
        if (r.ok) hasil.terkirim++;
        else {
          hasil.gagal++;
          console.warn(`[notifikasi-permintaan] gagal mengirim ke satu admin pusat: ${r.error ?? "tanpa keterangan"}`);
        }
      } catch (error) {
        hasil.gagal++;
        console.error("[notifikasi-permintaan] galat saat mengirim ke satu admin pusat:", error);
      }
    }
    console.log(
      `[notifikasi-permintaan] permintaan=${permintaanId} penerima=${hasil.penerima} terkirim=${hasil.terkirim} gagal=${hasil.gagal}`,
    );
  } catch (error) {
    console.error("[notifikasi-permintaan] gagal menyiapkan pemberitahuan:", error);
  }
  return hasil;
}
