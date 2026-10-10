"use client";

import { useEffect, useState } from "react";
import { formatWIBDate, formatWIBHariTanggal } from "@/lib/utils/datetime";
import { formatRupiah } from "@/lib/billing/school-invoice";
import { Button, buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { FileText, Download, ChevronDown, ChevronUp } from "lucide-react";

type InvoiceItem = {
  id: string;
  nomorInvoice: string;
  jumlahSiswa: number;
  hargaPerSiswa: number;
  subtotal: number;
  totalAmount: number;
  status: "menunggu_pembayaran" | "lunas" | "dibatalkan";
  tanggalInvoice: string;
  jatuhTempo: string;
  keterangan: string | null;
  bankTujuan: string | null;
  catatan: string | null;
  dibayarAt: string | null;
  periode: {
    nama: string | null;
    mulai: string;
    berakhir: string;
  } | null;
};

export function SchoolInvoiceCard() {
  const [latestInvoice, setLatestInvoice] = useState<InvoiceItem | null>(null);
  const [allInvoices, setAllInvoices] = useState<InvoiceItem[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/admin-sekolah/invoices/latest");
        if (res.ok) {
          const data = await res.json();
          if (!ignore) {
            setLatestInvoice(data.invoice);
            setTotalCount(data.totalInvoices ?? 0);
          }
        }
      } catch (err) {
        console.error("Gagal memuat invoice sekolah:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function muatSemuaInvoice() {
    if (allInvoices !== null) {
      setShowHistory((v) => !v);
      return;
    }
    try {
      const res = await fetch("/api/admin-sekolah/invoices");
      if (res.ok) {
        const data = await res.json();
        setAllInvoices(data.invoices ?? []);
        setShowHistory(true);
      }
    } catch (err) {
      console.error("Gagal memuat daftar invoice:", err);
    }
  }

  function handleDownload(invoice: InvoiceItem) {
    setDownloadingId(invoice.id);
    // Buka file PDF via anchor tag agar browser men-trigger download
    const link = document.createElement("a");
    link.href = `/api/admin-sekolah/invoices/${invoice.id}/pdf`;
    link.download = `invoice-${invoice.nomorInvoice.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloadingId(null), 1000);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm animate-pulse">
        <div className="h-5 w-48 rounded bg-slate-200"></div>
        <div className="mt-4 h-16 w-full rounded-xl bg-slate-100"></div>
      </div>
    );
  }

  // Jika belum ada invoice yang diterbitkan admin pusat
  if (!latestInvoice) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Invoice Pembayaran Sekolah</h2>
              <p className="text-xs text-slate-500">
                Tagihan resmi langganan akses ujian AyoTKA untuk sekolah Anda.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center">
          <p className="text-sm text-slate-600">
            Belum ada invoice pembayaran yang diterbitkan oleh Admin Pusat.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Jika sekolah Anda membutuhkan invoice penagihan resmi atau rincian transfer bank, hubungi Admin Pusat.
          </p>
        </div>
      </div>
    );
  }

  const isLunas = latestInvoice.status === "lunas";
  const isPending = latestInvoice.status === "menunggu_pembayaran";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isLunas ? "bg-emerald-50 text-emerald-600" : isPending ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
          }`}>
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Invoice Pembayaran Sekolah</h2>
              <Badge variant={isLunas ? "success" : isPending ? "warning" : "danger"}>
                {isLunas ? "Lunas" : isPending ? "Menunggu Pembayaran" : "Dibatalkan"}
              </Badge>
            </div>
            <p className="mt-0.5 font-mono text-xs text-slate-500">
              No: <span className="font-semibold text-slate-700">{latestInvoice.nomorInvoice}</span> · Terbit: {formatWIBDate(latestInvoice.tanggalInvoice)}
            </p>
          </div>
        </div>

        {/* Tombol Download Invoice PDF Utama */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleDownload(latestInvoice)}
            disabled={downloadingId === latestInvoice.id}
            className={`${isLunas ? "bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-xl shadow-xs" : buttonClassName("primary")} inline-flex items-center gap-2 transition-colors`}
          >
            <Download className="h-4 w-4" />
            <span>
              {downloadingId === latestInvoice.id
                ? "Mengunduh..."
                : isLunas
                ? "Download Invoice & Kuitansi Lunas (PDF)"
                : "Download Invoice (PDF)"}
            </span>
          </button>

          {totalCount > 1 && (
            <Button variant="secondary" onClick={muatSemuaInvoice} className="inline-flex items-center gap-1.5 text-xs">
              <span>Semua Invoice ({totalCount})</span>
              {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>

      {/* Rincian Tagihan */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
          <span className="text-xs text-slate-500">Jumlah Siswa</span>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {latestInvoice.jumlahSiswa.toLocaleString("id-ID")} Siswa
          </p>
          <span className="text-[11px] text-slate-400">
            @ {formatRupiah(latestInvoice.hargaPerSiswa)} / siswa
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
          <span className="text-xs text-slate-500">Total Tagihan</span>
          <p className={`mt-1 text-base font-bold ${isLunas ? "text-emerald-600" : "text-indigo-600"}`}>
            {formatRupiah(latestInvoice.totalAmount)} {isLunas && <span className="text-xs font-semibold text-emerald-600">(LUNAS)</span>}
          </p>
          <span className="text-[11px] text-slate-400">
            {latestInvoice.keterangan || "Paket Ujian Try Out AyoTKA"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
          <span className="text-xs text-slate-500">
            {isLunas ? "Tanggal Pelunasan" : "Jatuh Tempo Pembayaran"}
          </span>
          <p className={`mt-1 text-sm font-semibold ${isLunas ? "text-emerald-700" : isPending ? "text-amber-700" : "text-slate-700"}`}>
            {isLunas
              ? latestInvoice.dibayarAt ? formatWIBDate(latestInvoice.dibayarAt) : "Sudah Diverifikasi"
              : formatWIBHariTanggal(latestInvoice.jatuhTempo)}
          </p>
          <span className="text-[11px] text-slate-400">
            {isLunas ? "Pembayaran telah terkonfirmasi" : "Harap transfer sebelum jatuh tempo"}
          </span>
        </div>
      </div>

      {/* Alert Berhasil Pelunasan jika Lunas */}
      {isLunas && (
        <Alert variant="success" className="mt-4">
          <div className="flex flex-col gap-1 text-xs sm:text-sm">
            <span className="font-semibold text-emerald-900">
              ✓ Tagihan Pembayaran Telah Lunas & Terverifikasi
            </span>
            <span className="text-emerald-800">
              Pembayaran tagihan invoice <strong className="font-mono">{latestInvoice.nomorInvoice}</strong> telah berhasil diverifikasi oleh Tim AyoTKA. Kuota akses ujian untuk sekolah Anda telah aktif dan siap digunakan siswa.
            </span>
            <span className="text-emerald-700 text-xs">
              Silakan unduh dokumen PDF resmi di atas sebagai tanda terima sah dan kuitansi pelunasan berstempel digital resmi AyoTKA.
            </span>
          </div>
        </Alert>
      )}

      {/* Petunjuk Transfer jika belum bayar */}
      {isPending && latestInvoice.bankTujuan && (
        <Alert variant="warning" className="mt-4">
          <div className="flex flex-col gap-1 text-xs sm:text-sm">
            <span className="font-semibold text-amber-900">
              Instruksi Transfer Pembayaran:
            </span>
            <span className="text-amber-800">
              Silakan transfer ke <strong>{latestInvoice.bankTujuan}</strong> dengan mencantumkan nomor invoice{" "}
              <strong className="font-mono">{latestInvoice.nomorInvoice}</strong> pada berita transfer.
            </span>
            <span className="text-amber-700 text-xs">
              Setelah transfer, invoice ini dapat diunduh untuk arsip sekolah atau dilaporkan ke Admin Pusat untuk verifikasi cepat.
            </span>
          </div>
        </Alert>
      )}

      {/* Riwayat Semua Invoice (Jika dibuka) */}
      {showHistory && allInvoices && allInvoices.length > 0 && (
        <div className="mt-5 border-t border-slate-200/80 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Riwayat Invoice Sekolah</h3>
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>No. Invoice</Th>
                  <Th>Tanggal</Th>
                  <Th>Siswa</Th>
                  <Th>Total</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Aksi</Th>
                </Tr>
              </Thead>
              <tbody>
                {allInvoices.map((inv) => (
                  <Tr key={inv.id}>
                    <Td className="font-mono text-xs font-semibold text-slate-900">{inv.nomorInvoice}</Td>
                    <Td className="text-xs text-slate-600">{formatWIBDate(inv.tanggalInvoice)}</Td>
                    <Td className="text-xs text-slate-600">{inv.jumlahSiswa.toLocaleString("id-ID")} siswa</Td>
                    <Td className="font-semibold text-xs text-indigo-700">{formatRupiah(inv.totalAmount)}</Td>
                    <Td>
                      <Badge variant={inv.status === "lunas" ? "success" : inv.status === "menunggu_pembayaran" ? "warning" : "danger"}>
                        {inv.status === "lunas" ? "Lunas" : inv.status === "menunggu_pembayaran" ? "Menunggu Bayar" : "Batal"}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <Button
                        variant="secondary"
                        onClick={() => handleDownload(inv)}
                        disabled={downloadingId === inv.id}
                        className="inline-flex items-center gap-1.5 text-xs py-1 px-2.5"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>PDF</span>
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        </div>
      )}
    </div>
  );
}
