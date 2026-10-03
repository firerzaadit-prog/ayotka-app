"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useDialog } from "@/components/ui/dialog";
import { HAPUS_MASSAL_MAKS } from "@/lib/students/batas";

type HasilHapusMassal = { dihapus: number; diarsipkan: number; gagal: number; tidakDitemukan: number };

/** Kirim bertahap (maks HAPUS_MASSAL_MAKS per permintaan). Bagian yang gagal dikirim dihitung sebagai `gagal`. */
export async function kirimHapusMassal(ids: string[]): Promise<HasilHapusMassal> {
  const total: HasilHapusMassal = { dihapus: 0, diarsipkan: 0, gagal: 0, tidakDitemukan: 0 };
  for (let i = 0; i < ids.length; i += HAPUS_MASSAL_MAKS) {
    const bagian = ids.slice(i, i + HAPUS_MASSAL_MAKS);
    try {
      const res = await fetch("/api/admin-sekolah/siswa/hapus-massal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: bagian }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        total.gagal += bagian.length;
        continue;
      }
      total.dihapus += data.dihapus ?? 0;
      total.diarsipkan += data.diarsipkan ?? 0;
      total.gagal += data.gagal ?? 0;
      total.tidakDitemukan += data.tidakDitemukan ?? 0;
    } catch {
      total.gagal += bagian.length;
    }
  }
  return total;
}

/** Daftar ID yang dicentang. Hanya ID yang tampil di daftar (sesuai filter/pencarian) yang dihitung saat menghapus. */
export function usePilihan() {
  const [dipilih, setDipilih] = useState<Set<string>>(() => new Set());

  function toggle(id: string) {
    setDipilih((sebelumnya) => {
      const baru = new Set(sebelumnya);
      if (!baru.delete(id)) baru.add(id);
      return baru;
    });
  }

  function aturBanyak(ids: string[], nyala: boolean) {
    setDipilih((sebelumnya) => {
      const baru = new Set(sebelumnya);
      for (const id of ids) {
        if (nyala) baru.add(id);
        else baru.delete(id);
      }
      return baru;
    });
  }

  function kosongkan() {
    setDipilih(new Set());
  }

  return { dipilih, toggle, aturBanyak, kosongkan };
}

/** Konfirmasi, kirim, lalu tampilkan ringkasan hasil. `onSelesai` dipanggil setelahnya (muat ulang daftar, kosongkan centang). */
export function useHapusMassal(onSelesai: () => void) {
  const toast = useToast();
  const { confirm } = useDialog();
  const [sedangHapus, setSedangHapus] = useState(false);

  async function hapus(ids: string[]) {
    if (ids.length === 0 || sedangHapus) return;
    const ok = await confirm({
      title: `Hapus ${ids.length} siswa terpilih?`,
      description:
        "Data siswa dan akun loginnya dihapus, NISN-nya bisa ditambahkan lagi. Siswa yang sudah pernah mengerjakan ujian tetap menyimpan riwayat nilainya. Tindakan ini tidak bisa dibatalkan.",
      confirmLabel: `Ya, hapus ${ids.length} siswa`,
      danger: true,
    });
    if (!ok) return;

    setSedangHapus(true);
    try {
      const hasil = await kirimHapusMassal(ids);
      const berhasil = hasil.dihapus + hasil.diarsipkan;
      if (berhasil > 0) toast.success(`${berhasil} siswa berhasil dihapus.`);
      if (hasil.gagal > 0) {
        toast.error(`${hasil.gagal} siswa gagal dihapus dan datanya tidak berubah. Silakan coba lagi.`);
      }
      if (hasil.tidakDitemukan > 0) toast.info(`${hasil.tidakDitemukan} siswa dilewati karena sudah tidak ada.`);
    } finally {
      setSedangHapus(false);
      onSelesai();
    }
  }

  return { hapus, sedangHapus };
}

/**
 * Tandai lulus (lulus = true) atau batalkan tanda lulus (false) untuk banyak siswa. Alumni tetap ada (akun, riwayat,
 * nilai, analitik) tetapi tidak memakai kursi sekolah. Dikirim bertahap seperti kirimHapusMassal; berhenti di
 * kegagalan pertama (mis. kuota tidak cukup saat membatalkan) dan menampilkan alasan dari server.
 */
export function useLulusMassal(onSelesai: () => void) {
  const toast = useToast();
  const { confirm } = useDialog();
  const [sedangUbah, setSedangUbah] = useState(false);

  async function ubah(ids: string[], lulus: boolean) {
    if (ids.length === 0 || sedangUbah) return;
    const ok = await confirm({
      title: lulus ? `Tandai ${ids.length} siswa sebagai lulus?` : `Batalkan status lulus ${ids.length} siswa?`,
      description: lulus
        ? "Siswa yang lulus pindah ke tab Alumni dan tidak memakai kursi sekolah lagi, tetapi akun, riwayat, dan nilainya tetap ada dan tetap terhitung di analitik sekolah. Bisa dibatalkan kapan saja."
        : "Siswa kembali ke daftar aktif dan memakai kursi sekolah lagi, jadi kuota kursi harus cukup.",
      confirmLabel: lulus ? `Ya, tandai ${ids.length} siswa lulus` : "Ya, batalkan lulus",
    });
    if (!ok) return;

    setSedangUbah(true);
    let berhasil = 0;
    try {
      for (let i = 0; i < ids.length; i += HAPUS_MASSAL_MAKS) {
        const res = await fetch("/api/admin-sekolah/siswa/lulus-massal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: ids.slice(i, i + HAPUS_MASSAL_MAKS), lulus }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          toast.error(data?.error ?? "Gagal mengubah status lulus. Silakan coba lagi.");
          break;
        }
        berhasil += (lulus ? data.ditandai : data.dipulihkan) ?? 0;
      }
      if (berhasil > 0) {
        toast.success(lulus ? `${berhasil} siswa ditandai lulus.` : `${berhasil} siswa dikembalikan ke daftar aktif.`);
      }
    } finally {
      setSedangUbah(false);
      onSelesai();
    }
  }

  return { ubah, sedangUbah };
}

/** Kotak centang "pilih semua di halaman ini" (setengah tercentang kalau sebagian saja yang dipilih). */
export function CentangSemuaHalaman({
  idHalaman,
  dipilih,
  onUbah,
}: {
  idHalaman: string[];
  dipilih: Set<string>;
  onUbah: (nyala: boolean) => void;
}) {
  const jumlahDipilih = idHalaman.filter((id) => dipilih.has(id)).length;
  const semua = idHalaman.length > 0 && jumlahDipilih === idHalaman.length;
  return (
    <input
      type="checkbox"
      aria-label="Pilih semua siswa di halaman ini"
      className="accent-indigo-600"
      disabled={idHalaman.length === 0}
      checked={semua}
      ref={(el) => {
        if (el) el.indeterminate = jumlahDipilih > 0 && !semua;
      }}
      onChange={(e) => onUbah(e.target.checked)}
    />
  );
}

/** Bilah aksi yang muncul begitu ada siswa yang dicentang. */
export function BilahHapusMassal({
  jumlahDipilih,
  jumlahSemua,
  sedangHapus,
  onPilihSemua,
  onBatal,
  onHapus,
  aksiLain,
}: {
  jumlahDipilih: number;
  /** Jumlah siswa yang bisa dipilih pada filter/pencarian saat ini (semua halaman). */
  jumlahSemua: number;
  sedangHapus: boolean;
  onPilihSemua: () => void;
  onBatal: () => void;
  /** Tanpa ini tombol Hapus tidak ditampilkan (mis. panduan Periode Baru yang hanya menandai lulus). */
  onHapus?: () => void;
  /** Aksi tambahan di samping Hapus, mis. "Tandai lulus"; ikut dinonaktifkan selama proses berjalan. */
  aksiLain?: { label: string; onClick: () => void };
}) {
  if (jumlahDipilih === 0) return null;
  return (
    <div
      role="region"
      aria-label="Aksi untuk siswa terpilih"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm"
    >
      <span className="font-semibold text-indigo-900">{jumlahDipilih} siswa dipilih</span>
      {jumlahSemua > jumlahDipilih && (
        <button
          type="button"
          onClick={onPilihSemua}
          disabled={sedangHapus}
          className="font-semibold text-indigo-600 underline-offset-2 hover:underline disabled:opacity-50"
        >
          Pilih semua {jumlahSemua} siswa
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="secondary" onClick={onBatal} disabled={sedangHapus}>
          Batal pilih
        </Button>
        {aksiLain && (
          <Button variant="secondary" onClick={aksiLain.onClick} disabled={sedangHapus}>
            {aksiLain.label}
          </Button>
        )}
        {onHapus && (
          <Button variant="danger" onClick={onHapus} disabled={sedangHapus}>
            {sedangHapus ? "Memproses..." : "Hapus terpilih"}
          </Button>
        )}
      </div>
    </div>
  );
}
