import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getKeanggotaanSiswa } from "@/lib/billing/keanggotaan";
import { muatRiwayatPembayaran } from "@/lib/billing/riwayat-pembayaran-server";
import { RiwayatPembayaranView } from "@/components/siswa/riwayat-pembayaran-view";

export const dynamic = "force-dynamic";

/** Riwayat Pembayaran siswa: dibaca langsung di server (tanpa API terpisah) lalu disajikan oleh komponen klien dengan saringan. */
export default async function RiwayatPembayaranPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "siswa") redirect("/api/auth/force-logout?next=/login");

  const siswa = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true, schoolId: true, jalur: true, deletedAt: true, lulusAt: true },
  });
  if (!siswa) redirect("/api/auth/force-logout?next=/login");

  const [riwayat, keanggotaan] = await Promise.all([muatRiwayatPembayaran(siswa.id), getKeanggotaanSiswa(siswa)]);

  return (
    <RiwayatPembayaranView
      item={riwayat.item}
      saldo={riwayat.saldo}
      terpotong={riwayat.terpotong}
      sekolahMenanggung={keanggotaan.jenis === "sekolah" && keanggotaan.berlakuSampai ? { berlakuSampai: keanggotaan.berlakuSampai } : null}
    />
  );
}
