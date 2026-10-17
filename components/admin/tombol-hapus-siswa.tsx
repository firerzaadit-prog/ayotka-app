"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

/**
 * Tombol "Hapus pengguna" di halaman profil siswa admin pusat. Memakai rute admin pusat
 * (DELETE /api/admin-pusat/siswa/[id]) yang melayani Jalur A maupun Jalur B. Setelah berhasil kembali ke daftar.
 */
export function TombolHapusSiswa({
  id,
  nama,
  jalur,
  adaRiwayat,
  kembaliKe,
  peringatan,
}: {
  id: string;
  nama: string;
  jalur: "A" | "B";
  /** Siswa sudah pernah ujian atau punya pembayaran/saldo/langganan: akan diarsipkan, bukan dihapus permanen. */
  adaRiwayat: boolean;
  kembaliKe: string;
  /** Peringatan tambahan di dialog, mis. siswa ini masih punya paket berbayar yang aktif. */
  peringatan?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useDialog();
  const [sedangHapus, setSedangHapus] = useState(false);

  async function hapus() {
    if (sedangHapus) return;
    const akhir = adaRiwayat
      ? "Karena sudah punya riwayat (ujian, pembayaran, atau saldo), riwayatnya tetap tersimpan sebagai arsip."
      : "Karena belum punya riwayat apa pun, datanya dihapus permanen.";
    const ok = await confirm({
      title: `Hapus pengguna "${nama}"?`,
      description:
        (jalur === "B"
          ? "Akun login siswa mandiri ini dihapus: ia tidak bisa masuk lagi dan emailnya bisa dipakai mendaftar ulang. "
          : "Data siswa dan akun loginnya dihapus, NISN-nya bisa ditambahkan lagi. ") +
        `${akhir}${peringatan ? ` ${peringatan}` : ""} Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: "Ya, hapus pengguna",
      danger: true,
    });
    if (!ok) return;

    setSedangHapus(true);
    try {
      const res = await fetch(`/api/admin-pusat/siswa/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Gagal menghapus pengguna.");
        return;
      }
      toast.success(`Pengguna "${nama}" dihapus.`);
      router.push(kembaliKe);
      router.refresh();
    } catch {
      toast.error("Koneksi bermasalah. Coba lagi.");
    } finally {
      setSedangHapus(false);
    }
  }

  return (
    <Button variant="danger" onClick={hapus} disabled={sedangHapus} data-tombol-hapus-siswa>
      {sedangHapus ? "Menghapus..." : "Hapus pengguna"}
    </Button>
  );
}
