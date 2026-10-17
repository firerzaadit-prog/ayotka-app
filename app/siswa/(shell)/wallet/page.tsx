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
import { teksHargaLA } from "@/lib/billing/harga-la-tampilan";
import { PetunjukEmailAffiliate } from "@/components/billing/petunjuk-email-affiliate";

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
  email?: string;
  /** Harga Learning Analytics tambahan mengikuti beban AI paket: termurah dan termahal. */
  hargaLaMin?: number;
  hargaLaMaks?: number;
  /** Lama (= harga termurah); dipakai bila server belum mengirim rentang di atas. */
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

      {/* Kartu Hero Saldo */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-6 sm:p-8 text-white shadow-md text-center">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col items-center">
          <span className="font-mono text-xs font-semibold uppercase tracking-widest text-indigo-300">
            Saldo Dompet Belajar
          </span>
          <p className="mt-2 text-4xl sm:text-5xl font-black tracking-tight text-white">
            {formatRupiah(data.saldo)}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1 text-xs text-indigo-200 ring-1 ring-white/15 backdrop-blur-xs" data-harga-la>
            {teksHargaLA(data)}
          </div>
          <p className="mt-4 max-w-lg text-xs text-slate-300 leading-relaxed" data-keterangan-saldo-tunai>
            Saldo hanya untuk membeli Learning Analytics di AyoTKA dan <b>tidak dapat ditarik tunai</b>, ditransfer, atau diuangkan kembali.
          </p>
        </div>
      </div>

      <Card className="flex flex-col gap-4">
        <div>
          <p className="text-base font-bold text-slate-900">Top-up saldo</p>
          <p className="mt-0.5 text-xs text-slate-500">Saldo yang sudah diisi tidak dapat ditarik tunai.</p>
        </div>

        {data.paymentMode === "affiliate" && (
          <div className="overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 p-4 sm:p-5 text-xs text-emerald-950 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-xs">
                ⚡
              </span>
              <p className="font-bold text-emerald-950">Top-up Otomatis via affiliate.id</p>
            </div>
            <ol className="mt-3 space-y-2 pl-1 leading-relaxed text-slate-700">
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-mono text-[11px] font-bold text-emerald-800">
                  1
                </span>
                <span className="pt-0.5">Pilih nominal di bawah dan selesaikan pembayaran di affiliate.id.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-mono text-[11px] font-bold text-emerald-800">
                  2
                </span>
                <span className="pt-0.5">
                  <PetunjukEmailAffiliate email={data.email} untuk="saldo" />
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-mono text-[11px] font-bold text-emerald-800">
                  3
                </span>
                <span className="pt-0.5">
                  Setelah pembayaran lunas dan diverifikasi affiliate.id (biasanya 5-10 menit), saldo terisi otomatis tanpa perlu konfirmasi manual. Kalau
                  lebih lama dari itu, hubungi admin lewat tautan WhatsApp di bawah.
                </span>
              </li>
            </ol>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {data.paymentMode === "affiliate"
            ? data.denominasi.map((nominal) => {
                const tautan = data.affiliateTopup?.[String(nominal)];
                if (!tautan) return null;
                return (
                  <div
                    key={nominal}
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                  >
                    <a
                      href={tautan.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center py-2 text-center"
                    >
                      <span className="font-mono text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Top-up</span>
                      <span className="mt-1 text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {formatRupiah(nominal)}
                      </span>
                      <span className="mt-3 inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                        <span>Pilih</span>
                        <span aria-hidden="true">→</span>
                      </span>
                    </a>
                    <div className="mt-2 border-t border-slate-100 pt-2 text-center">
                      <a
                        href={tautan.waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-emerald-700 transition-colors"
                      >
                        Bantuan / Kendala WA
                      </a>
                    </div>
                  </div>
                );
              })
            : data.denominasi.map((nominal) => (
                <button
                  key={nominal}
                  type="button"
                  onClick={() => handleTopup(nominal)}
                  disabled={submitting !== null}
                  className="group flex flex-col items-center justify-center rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md disabled:opacity-50"
                >
                  <span className="font-mono text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Top-up</span>
                  <span className="mt-1 text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {submitting === nominal ? "Memproses..." : formatRupiah(nominal)}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                    <span>Pilih</span>
                    <span aria-hidden="true">→</span>
                  </span>
                </button>
              ))}
        </div>

        {data.paymentMode === "affiliate" && data.waKonfirmasiUmum && (
          <a
            href={data.waKonfirmasiUmum}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 w-fit text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <span>Kendala pembayaran? Hubungi admin via WhatsApp</span>
            <span aria-hidden="true">→</span>
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
