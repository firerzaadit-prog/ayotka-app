"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { PageSkeleton } from "@/components/ui/skeleton";

type Riwayat = {
  id: string;
  tipe: "topup" | "debit_analisis" | "penyesuaian_admin";
  status: "pending" | "berhasil" | "gagal";
  jumlah: number;
  keterangan: string | null;
  createdAt: string;
};

type SaldoData = {
  saldo: number;
  hargaLearningAnalytics: number;
  denominasi: number[];
  riwayat: Riwayat[];
};

const TIPE_LABEL: Record<Riwayat["tipe"], string> = {
  topup: "Top-up",
  debit_analisis: "Learning Analytics",
  penyesuaian_admin: "Penyesuaian admin",
};

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/**
 * Bagian D/G (permintaan user): wallet/saldo untuk beli Learning Analytics
 * tambahan begitu jatah gratis dari plan (bulanan/semester) sudah habis.
 * Tanpa saldo, siswa tetap bisa Try Out Mandiri sepuasnya - cuma dapat skor
 * + peta kompetensi saja, bukan diblokir dari mengerjakan try out.
 */
export default function WalletPage() {
  const [data, setData] = useState<SaldoData | null>(null);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/siswa/saldo");
      const json = await res.json().catch(() => null);
      if (!ignore && res.ok) setData(json);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleTopup(nominal: number) {
    setError(null);
    setSubmitting(nominal);
    const res = await fetch("/api/siswa/saldo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nominal }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error ?? "Gagal membuat transaksi top-up.");
      setSubmitting(null);
      return;
    }
    window.location.assign(json.redirectUrl);
  }

  if (!data) return <PageSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Wallet"
        description="Saldo untuk beli Learning Analytics (hasil analisis AI) tambahan begitu jatah gratis dari langganan kamu habis."
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="text-center">
        <p className="text-sm text-slate-500">Saldo kamu</p>
        <p className="text-4xl font-bold text-slate-900">{formatRupiah(data.saldo)}</p>
        <p className="mt-2 text-xs text-slate-400">
          Satu Learning Analytics tambahan = {formatRupiah(data.hargaLearningAnalytics)}
        </p>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-sm font-medium text-slate-700">Top-up saldo</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.denominasi.map((nominal) => (
            <Button
              key={nominal}
              variant="secondary"
              onClick={() => handleTopup(nominal)}
              disabled={submitting !== null}
            >
              {submitting === nominal ? "Memproses..." : formatRupiah(nominal)}
            </Button>
          ))}
        </div>
      </Card>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Riwayat</h2>
        {data.riwayat.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada transaksi.</p>
        ) : (
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Tanggal</Th>
                  <Th>Jenis</Th>
                  <Th>Keterangan</Th>
                  <Th>Jumlah</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <tbody>
                {data.riwayat.map((r) => (
                  <Tr key={r.id}>
                    <Td className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString("id-ID")}</Td>
                    <Td>{TIPE_LABEL[r.tipe]}</Td>
                    <Td className="text-xs text-slate-500">{r.keterangan ?? "-"}</Td>
                    <Td className={r.jumlah >= 0 ? "font-medium text-emerald-600" : "font-medium text-rose-600"}>
                      {r.jumlah >= 0 ? "+" : ""}
                      {formatRupiah(r.jumlah)}
                    </Td>
                    <Td>
                      <Badge variant={r.status === "berhasil" ? "success" : "danger"}>
                        {r.status === "berhasil" ? "Berhasil" : "Gagal"}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        )}
      </div>
    </div>
  );
}
