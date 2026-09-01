import "server-only";
import type { Prisma, Package, Assignment } from "@prisma/client";

/**
 * Tiket 4.3: distribusi paket paralel. "Manual" = semua siswa dapat persis
 * package_id yang dipilih admin di assignment, tanpa substitusi. "Otomatis"
 * = bergilir (round-robin) di antara paket-paket segrup (grup_paralel_id),
 * urutannya deterministik dari jumlah attempt yang sudah ada di assignment
 * ini - jadi tidak perlu tabel/kolom penyimpanan tambahan di luar skema yang
 * sudah ada, dan tetap adil (merata) karena urutan kedatangan siswa acak
 * secara alami. "Distribusi dipicu ulang admin" (kriteria tiket 4.3) berarti
 * siswa yang mengulang otomatis dapat giliran paket berikutnya dalam rotasi
 * yang sama, bukan paket yang sama seperti attempt sebelumnya.
 */
export async function pickPackageForAttempt(
  tx: Prisma.TransactionClient,
  assignment: Assignment & { package: Package },
): Promise<Package> {
  if (assignment.metodeDistribusi === "manual" || !assignment.package.grupParalelId) {
    return assignment.package;
  }

  // ownerType/ownerId eksplisit sebagai lapis pertahanan terakhir - titik ini
  // yang benar-benar menentukan soal apa dilihat siswa, jadi jangan cuma
  // bergantung pada gerbang di titik-titik sebelumnya (lihat perbaikan
  // keamanan di lib/packages/scope.ts assertGrupParalelOwnedBySelf).
  const grupPackages = await tx.package.findMany({
    where: {
      grupParalelId: assignment.package.grupParalelId,
      status: "published",
      ownerType: assignment.package.ownerType,
      ownerId: assignment.package.ownerId,
    },
    orderBy: { id: "asc" },
  });
  if (grupPackages.length === 0) return assignment.package;

  const existingCount = await tx.attempt.count({ where: { assignmentId: assignment.id } });
  return grupPackages[existingCount % grupPackages.length]!;
}
