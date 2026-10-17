"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconCheckCircle } from "@/components/ui/empty-state-icons";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, Td, Th, Thead, Tr } from "@/components/ui/table";
import {
  LABEL_JENIS_RIWAYAT,
  LABEL_STATUS_RIWAYAT,
  type ItemRiwayat,
  type StatusRiwayat,
} from "@/lib/billing/riwayat-pembayaran";
import { formatWIB, formatWIBDate } from "@/lib/utils/datetime";

type Saring = "semua" | "langganan" | "voucher" | "saldo";

const SARINGAN: { kunci: Saring; label: string }[] = [
  { kunci: "semua", label: "Semua" },
  { kunci: "langganan", label: "Langganan" },
  { kunci: "voucher", label: "Voucher" },
  { kunci: "saldo", label: "Saldo" },
];

const VARIAN_STATUS: Record<StatusRiwayat, "success" | "warning" | "danger" | "neutral" | "info"> = {
  berhasil: "success",
  menunggu: "warning",
  gagal: "danger",
  kedaluwarsa: "neutral",
  dikembalikan: "info",
};

const PER_HALAMAN = 20;

function rupiah(n: number): string {
  return `Rp${Math.abs(Math.round(n)).toLocaleString("id-ID")}`;
}

/** Jumlah + warna: saldo masuk hijau (+), saldo terpakai merah (-), pembelian paket polos, voucher tanpa nominal. */
function Jumlah({ item }: { item: ItemRiwayat }) {
  if (item.jumlah === null) return <span className="text-slate-400">–</span>;
  if (item.jenis === "langganan") return <span className="font-medium text-slate-900">{rupiah(item.jumlah)}</span>;
  const masuk = item.jumlah >= 0;
  return (
    <span className={`font-medium ${masuk ? "text-emerald-600" : "text-rose-600"}`}>
      {masuk ? "+" : "-"}
      {rupiah(item.jumlah)}
    </span>
  );
}

/** "keterangan · via cara bayar"; cara bayar tidak diulang bila keterangannya sudah menyebutnya (mis. "... via affiliate.id"). */
function rincianBaris(item: ItemRiwayat): string {
  const ket = item.keterangan?.trim() ?? "";
  const metode = item.metode && !ket.toLowerCase().includes(item.metode.toLowerCase()) ? `via ${item.metode}` : null;
  return [ket || null, metode].filter(Boolean).join(" · ");
}

function cocok(item: ItemRiwayat, saring: Saring): boolean {
  if (saring === "semua") return true;
  if (saring === "saldo") return item.jenis === "topup" || item.jenis === "pemakaian_saldo" || item.jenis === "penyesuaian_saldo";
  return item.jenis === saring;
}

/**
 * Riwayat Pembayaran siswa: pembelian paket, top-up, pemakaian saldo, dan voucher dalam satu daftar (lihat
 * lib/billing/riwayat-pembayaran.ts). Saringan dan "tampilkan lebih banyak" hanya mengubah tampilan; datanya sudah
 * lengkap dari server.
 */
export function RiwayatPembayaranView({
  item,
  saldo,
  terpotong,
  sekolahMenanggung,
}: {
  item: ItemRiwayat[];
  saldo: number;
  /** Salah satu sumber mencapai batas baris yang dibaca: ada riwayat lebih lama yang tidak ditampilkan. */
  terpotong: boolean;
  /** Akses siswa sedang ditanggung sekolah: berlaku sampai (ISO); null bila tidak. */
  sekolahMenanggung: { berlakuSampai: string } | null;
}) {
  const [saring, setSaring] = useState<Saring>("semua");
  const [tampil, setTampil] = useState(PER_HALAMAN);

  const terfilter = item.filter((i) => cocok(i, saring));
  const baris = terfilter.slice(0, tampil);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Riwayat Pembayaran"
        description="Pembelian paket, top-up dan pemakaian saldo, serta voucher yang pernah kamu tukarkan."
        action={
          <Link href="/siswa/langganan" className={buttonClassName("secondary")}>
            Paket &amp; voucher
          </Link>
        }
      />

      {sekolahMenanggung && (
        <Alert variant="info" data-info-sekolah-menanggung>
          Akses Try Out-mu ditanggung sekolah sampai {formatWIBDate(sekolahMenanggung.berlakuSampai)}, jadi tidak ada tagihan paket untukmu. Pembelian
          pribadi (kalau ada) tetap tercatat di bawah.
        </Alert>
      )}

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">Saldo Saat Ini</p>
          <p className="mt-1 text-3xl font-black tracking-tight text-slate-900" data-saldo-saat-ini>
            {saldo < 0 ? "-" : ""}
            {rupiah(saldo)}
          </p>
        </div>
        <Link
          href="/siswa/wallet"
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors"
        >
          <span>Isi Saldo</span>
          <span aria-hidden="true">→</span>
        </Link>
      </Card>

      <div role="group" aria-label="Saring riwayat" className="flex flex-wrap gap-2">
        {SARINGAN.map((s) => (
          <button
            key={s.kunci}
            type="button"
            aria-pressed={saring === s.kunci}
            onClick={() => {
              setSaring(s.kunci);
              setTampil(PER_HALAMAN);
            }}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 ${
              saring === s.kunci
                ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/20"
                : "border border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/80 hover:text-slate-900"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {terfilter.length === 0 ? (
        <EmptyState
          icon={<IconCheckCircle />}
          title={item.length === 0 ? "Belum ada pembayaran" : "Tidak ada yang cocok"}
          description={
            item.length === 0
              ? "Pembelian paket, top-up saldo, dan voucher yang kamu pakai akan muncul di sini."
              : "Tidak ada riwayat untuk saringan ini. Coba pilih \"Semua\"."
          }
        />
      ) : (
        <>
          <TableContainer>
            <Table data-tabel-riwayat-pembayaran>
              <Thead>
                <Tr>
                  <Th>Tanggal</Th>
                  <Th>Jenis</Th>
                  <Th>Keterangan</Th>
                  <Th className="text-right">Jumlah</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <tbody>
                {baris.map((i) => (
                  <Tr key={i.id}>
                    <Td className="whitespace-nowrap text-xs text-slate-500">{formatWIB(i.waktu, "d MMM yyyy, HH.mm")}</Td>
                    <Td className="whitespace-nowrap">{LABEL_JENIS_RIWAYAT[i.jenis]}</Td>
                    <Td>
                      <p className="font-medium text-slate-900">{i.judul}</p>
                      {(i.keterangan || i.metode) && (
                        <p className="text-xs text-slate-500">{rincianBaris(i)}</p>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      <Jumlah item={i} />
                    </Td>
                    <Td>
                      <Badge variant={VARIAN_STATUS[i.status]}>{LABEL_STATUS_RIWAYAT[i.status]}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Menampilkan {baris.length} dari {terfilter.length} riwayat
            </span>
            {terfilter.length > baris.length && (
              <Button variant="secondary" onClick={() => setTampil((t) => t + PER_HALAMAN)}>
                Tampilkan lebih banyak
              </Button>
            )}
          </div>
        </>
      )}

      {terpotong && (
        <p className="text-xs text-slate-500">Hanya riwayat terbaru yang ditampilkan. Hubungi admin bila kamu perlu data yang lebih lama.</p>
      )}
    </div>
  );
}
