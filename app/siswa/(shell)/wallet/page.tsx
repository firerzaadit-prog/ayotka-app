"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { jalurKembaliHasil } from "@/lib/utils/kembali-hasil";
import { Button, buttonClassName } from "@/components/ui/button";
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
  /** "affiliate" = top-up lewat tautan affiliate.id + konfirmasi admin via WhatsApp (sementara, lihat lib/billing/pembayaran-affiliate.ts). */
  paymentMode: "affiliate" | "midtrans";
  affiliateTopup: Record<string, { url: string; waUrl: string }> | null;
  waKonfirmasiUmum: string | null;
  riwayat: Riwayat[];
};

const TIPE_LABEL: Record<Riwayat["tipe"], string> = {
  topup: "Top-up",
  debit_analisis: "Learning Analytics",
  penyesuaian_admin: "Penyesuaian / pengembalian",
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
  // Halaman hasil ujian yang mengirim siswa ke sini untuk mengisi saldo (?kembali=...), supaya mudah kembali.
  const [kembali, setKembali] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/siswa/saldo");
      const json = await res.json().catch(() => null);
      if (!ignore && res.ok) setData(json);
      const search = new URLSearchParams(window.location.search);
      // Hanya jalur internal ke halaman hasil ujian yang diterima (bukan alamat sembarang) - mencegah pengalihan terbuka.
      const tujuan = jalurKembaliHasil(search.get("kembali"));
      if (!ignore && tujuan) setKembali(tujuan);
      if (!ignore && search.get("sukses") === "topup") setSukses(true);
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
        description="Saldo kredit untuk membeli Learning Analytics (hasil analisis AI) — untuk pengguna paket gratis, atau saat jatah dari langganan kamu habis."
      />

      {kembali && (
        <Alert variant="info" className="flex flex-wrap items-center justify-between gap-3">
          <span>Setelah saldo masuk, kembali ke hasil ujianmu untuk menjalankan Learning Analytics.</span>
          <Link href={kembali} className={buttonClassName("secondary")}>
            Kembali ke hasil ujian
          </Link>
        </Alert>
      )}

      {sukses && (
        <Alert variant="success">
          Pembayaran berhasil! Saldo kamu telah ditambahkan secara otomatis.
        </Alert>
      )}

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
        {data.paymentMode === "affiliate" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
            <p className="font-semibold text-emerald-950">⚡ Top-up Otomatis via affiliate.id</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4 leading-relaxed text-emerald-800">
              <li>Pilih nominal di bawah dan selesaikan pembayaran di affiliate.id.</li>
              <li>Email akun AyoTKA kamu terisi otomatis saat checkout.</li>
              <li>Begitu pembayaran lunas, saldo akan langsung terisi secara otomatis tanpa perlu konfirmasi manual!</li>
            </ol>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.paymentMode === "affiliate"
            ? data.denominasi.map((nominal) => {
                const tautan = data.affiliateTopup?.[String(nominal)];
                if (!tautan) return null;
                return (
                  <div key={nominal} className="flex flex-col gap-1.5">
                    <a
                      href={tautan.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${buttonClassName("secondary")} w-full text-center`}
                    >
                      {formatRupiah(nominal)}
                    </a>
                    <a
                      href={tautan.waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-center text-[11px] font-medium text-slate-500 hover:text-emerald-700"
                    >
                      Bantuan / Kendala WA
                    </a>
                  </div>
                );
              })
            : data.denominasi.map((nominal) => (
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
        {data.paymentMode === "affiliate" && data.waKonfirmasiUmum && (
          <a
            href={data.waKonfirmasiUmum}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Kendala pembayaran? Hubungi admin via WhatsApp →
          </a>
        )}
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
