"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatWIBDate } from "@/lib/utils/datetime";
import { Alert } from "@/components/ui/alert";

type StatusLangganan = "belum_aktif" | "akan_datang" | "aktif" | "tenggang" | "berakhir";
type SeatStatus = {
  seatQuota: number | null;
  validUntil: string | null;
  seatsUsed: number;
  isFull: boolean;
  status: StatusLangganan;
  mulai: string | null;
  tenggangSampai: string | null;
  namaPeriode: string | null;
  sisaHari: number | null;
  /** Periode aktif yang tinggal H-7 atau kurang. */
  segeraBerakhir: boolean;
  /** Admin sekolah sudah mengajukan perpanjangan yang menunggu diproses admin pusat. */
  permintaanMenunggu: boolean;
};

const TAUTAN_PERIODE_BARU = (
  <Link href="/admin-sekolah/periode-baru" className="font-semibold underline underline-offset-2">
    Buka Periode Baru
  </Link>
);

/** Ringkasan kursi (seat) sekolah yang diaktifkan admin pusat - read-only, dipakai di dashboard admin sekolah. */
export function KuotaSummary() {
  const [status, setStatus] = useState<SeatStatus | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-sekolah/kuota");
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok) setStatus(data);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  if (status === null) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-sm font-medium text-slate-700">Kursi Sekolah dari Admin Pusat</h2>
      {status.seatQuota == null ? (
        <p className="mt-2 text-sm text-slate-500">
          Kursi sekolah belum diaktifkan admin pusat. Hubungi admin pusat untuk mengaktifkan.
        </p>
      ) : (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="font-medium text-slate-800">
            {status.seatsUsed.toLocaleString("id-ID")}/{status.seatQuota.toLocaleString("id-ID")} kursi
            terpakai
          </span>
          {status.namaPeriode && <p className="mt-0.5 text-xs text-slate-500">{status.namaPeriode}</p>}
          {status.status === "akan_datang" && status.mulai ? (
            <p className="mt-0.5 text-xs text-slate-500">Mulai berlaku {formatWIBDate(status.mulai)}</p>
          ) : (
            status.validUntil && (
              <p className="mt-0.5 text-xs text-slate-500">Berlaku sampai {formatWIBDate(status.validUntil)}</p>
            )
          )}
        </div>
      )}
      {status.segeraBerakhir && status.validUntil && status.sisaHari != null && !status.permintaanMenunggu && (
        <Alert variant="warning" className="mt-3">
          Langganan {status.sisaHari === 0 ? "berakhir hari ini" : `berakhir ${status.sisaHari} hari lagi`} (
          {formatWIBDate(status.validUntil)}). Siapkan periode berikutnya: tandai siswa yang lulus, tambahkan siswa
          baru, lalu ajukan perpanjangan. {TAUTAN_PERIODE_BARU}
        </Alert>
      )}
      {status.status === "tenggang" && status.validUntil && status.tenggangSampai && !status.permintaanMenunggu && (
        <Alert variant="warning" className="mt-3">
          Langganan berakhir pada {formatWIBDate(status.validUntil)}. Sampai {formatWIBDate(status.tenggangSampai)}{" "}
          (masa tenggang) siswa masih bisa mengerjakan ujian. Setelah itu sekolah dibekukan sampai diperpanjang -
          ajukan perpanjangan sekarang. {TAUTAN_PERIODE_BARU}
        </Alert>
      )}
      {status.status === "berakhir" && status.validUntil && !status.permintaanMenunggu && (
        <Alert variant="danger" className="mt-3">
          Langganan berakhir pada {formatWIBDate(status.validUntil)}. Siswa tidak bisa memulai ujian baru dan siswa
          baru belum bisa ditambahkan atau diimpor sampai langganan diperpanjang. Riwayat dan nilai siswa tetap
          bisa dibuka. {TAUTAN_PERIODE_BARU}
        </Alert>
      )}
      {status.permintaanMenunggu && (
        <Alert variant="info" className="mt-3">
          Permintaan perpanjangan sudah diajukan dan menunggu diproses admin pusat. {TAUTAN_PERIODE_BARU}
        </Alert>
      )}
      {status.isFull && (
        <Alert variant="warning" className="mt-3">
          Kuota kursi sudah penuh - siswa baru belum bisa ditambahkan atau diimpor. Hubungi admin pusat untuk
          menambah kuota.
        </Alert>
      )}
    </div>
  );
}
