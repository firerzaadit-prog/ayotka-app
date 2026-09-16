"use client";

import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { IconWallet } from "@/components/ui/empty-state-icons";
import { useToast } from "@/components/ui/toast";
import { formatWIBDate } from "@/lib/utils/datetime";

type InvoiceButuhVerifikasi = {
  id: string;
  siswaNama: string;
  paket: string;
  jumlah: number;
  status: "pending" | "expired";
  dibuatAt: string;
  kedaluwarsaAt: string;
};

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/**
 * Jaring pengaman Jalur A (Midtrans): kalau webhook gagal sampai atau siswa
 * transfer manual lalu minta tolong admin, invoice-nya tetap bisa disetujui
 * di sini tanpa harus menunggu/mengandalkan webhook. Ini pengecualian,
 * bukan alur utama - alur utama tetap otomatis lewat Midtrans.
 */
export default function VerifikasiPembayaranPage() {
  const toast = useToast();
  const [invoices, setInvoices] = useState<InvoiceButuhVerifikasi[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openCatatanFor, setOpenCatatanFor] = useState<string | null>(null);
  const [catatan, setCatatan] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/invoices");
      const data = await res.json().catch(() => null);
      if (!ignore && res.ok) setInvoices(data.invoices ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  async function handleApprove(id: string) {
    if (!catatan.trim()) {
      toast.error("Catatan verifikasi wajib diisi.");
      return;
    }
    setSubmittingId(id);
    const res = await fetch(`/api/admin-pusat/invoices/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catatan }),
    });
    const data = await res.json().catch(() => null);
    setSubmittingId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Gagal menyetujui pembayaran.");
      return;
    }
    toast.success("Pembayaran disetujui manual - akses siswa sudah aktif.");
    setOpenCatatanFor(null);
    setCatatan("");
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Verifikasi Pembayaran"
        description="Jaring pengaman Jalur A - kalau webhook Midtrans gagal sampai atau siswa transfer manual di luar sistem, setujui di sini supaya aksesnya tetap aktif."
      />

      <Alert variant="info">
        Alur normal tetap otomatis lewat Midtrans. Cuma pakai halaman ini kalau ada bukti nyata siswa
        sudah bayar tapi sistem belum mencatatnya lunas.
      </Alert>

      {invoices === null && <TableSkeleton columns={5} />}

      {invoices?.length === 0 && (
        <EmptyState
          icon={<IconWallet />}
          title="Tidak ada invoice yang butuh verifikasi"
          description="Semua transaksi Jalur A tercatat lunas otomatis lewat Midtrans."
        />
      )}

      {invoices && invoices.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Siswa</Th>
                <Th>Paket</Th>
                <Th>Jumlah</Th>
                <Th>Status</Th>
                <Th>Dibuat</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <tbody>
              {invoices.map((inv) => (
                <Fragment key={inv.id}>
                  <Tr>
                    <Td className="font-medium text-slate-900">{inv.siswaNama}</Td>
                    <Td>{inv.paket}</Td>
                    <Td className="font-semibold text-indigo-700">{formatRupiah(inv.jumlah)}</Td>
                    <Td>
                      <Badge variant={inv.status === "expired" ? "danger" : "warning"}>
                        {inv.status === "expired" ? "Kedaluwarsa" : "Menunggu bayar"}
                      </Badge>
                    </Td>
                    <Td>{formatWIBDate(inv.dibuatAt)}</Td>
                    <Td className="text-right">
                      <button
                        onClick={() => {
                          setOpenCatatanFor(openCatatanFor === inv.id ? null : inv.id);
                          setCatatan("");
                        }}
                        className="text-sm font-medium text-indigo-600 hover:underline"
                      >
                        {openCatatanFor === inv.id ? "Batal" : "Setujui Manual"}
                      </button>
                    </Td>
                  </Tr>
                  {openCatatanFor === inv.id && (
                    <Tr>
                      <Td colSpan={6} className="bg-slate-50/70">
                        <div className="flex flex-col gap-2 py-2 sm:flex-row sm:items-end sm:gap-3">
                          <div className="flex-1">
                            <Label htmlFor={`catatan-${inv.id}`}>
                              Catatan verifikasi (wajib - mis. bukti transfer, konfirmasi WhatsApp)
                            </Label>
                            <Input
                              id={`catatan-${inv.id}`}
                              required
                              value={catatan}
                              onChange={(e) => setCatatan(e.target.value)}
                              placeholder="mis. Siswa kirim bukti transfer BCA jam 14.02, sudah dicek masuk"
                            />
                          </div>
                          <Button
                            onClick={() => handleApprove(inv.id)}
                            disabled={submittingId === inv.id}
                            className="w-fit"
                          >
                            {submittingId === inv.id ? "Memproses..." : "Konfirmasi & aktifkan akses"}
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
