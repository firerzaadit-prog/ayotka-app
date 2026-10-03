"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeleton";
import { formatWIBDate } from "@/lib/utils/datetime";
import { VoucherRedeemCard } from "@/components/siswa/voucher-redeem-card";

type Plan = { id: string; kode: string; nama: string; harga: number; durasiHari: number | null };
type Entitlement = {
  endsAt: string;
  canStartNewAttempt: boolean;
  canViewHistory: boolean;
  source: "invoice" | "voucher" | "school_seat";
};
type CheckoutData = {
  jalur: "A" | "B";
  sekolah: { nama: string } | null;
  /** Jalur A yang kursi sekolahnya berlaku/tersedia sekarang: akses ditanggung sekolah, tidak perlu beli paket. */
  ditanggungSekolah: boolean;
  alumni: boolean;
  /** Kredit paket pribadi yang ditunda karena sekolah sedang/akan menanggung (lib/billing/kredit-pribadi.ts). */
  kreditDitunda: { mulai: string; sampai: string } | null;
  /** "affiliate" = bayar lewat tautan affiliate.id + aktivasi manual admin (sementara, lihat lib/billing/pembayaran-affiliate.ts). */
  paymentMode: "affiliate" | "midtrans";
  affiliatePlans: Record<string, { url: string; waUrl: string }> | null;
  referralCode: string;
  entitlement: Entitlement | null;
  plans: Plan[];
  pendingInvoiceId: string | null;
};

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

const SUMBER_LABEL: Record<Entitlement["source"], string> = {
  invoice: "Pembayaran mandiri",
  voucher: "Kode voucher",
  school_seat: "Kuota sekolah",
};

/** Jalur A (siswa individu, Bagian 5 dokumen rencana): checkout lewat Midtrans Snap. */
export default function LanggananSiswaPage() {
  const [data, setData] = useState<CheckoutData | null>(null);
  const [submittingPlanId, setSubmittingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCopyReferral(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API tidak tersedia - kode tetap terlihat untuk disalin manual.
    }
  }

  async function refreshData() {
    const res = await fetch("/api/siswa/checkout");
    const json = await res.json().catch(() => null);
    if (res.ok && json) setData(json);
  }

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/siswa/checkout");
      const json = await res.json().catch(() => null);
      if (!ignore && res.ok) setData(json);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleBeli(planId: string) {
    setError(null);
    setSubmittingPlanId(planId);
    const res = await fetch("/api/siswa/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error ?? "Gagal membuat transaksi pembayaran.");
      setSubmittingPlanId(null);
      return;
    }
    window.location.assign(json.redirectUrl);
  }

  if (!data) {
    return <PageSkeleton />;
  }

  // Siswa sekolah (Jalur A) yang aksesnya sedang ditanggung sekolah tidak perlu membeli paket. Setelah sekolah berhenti
  // menanggung (langganan + masa tenggang habis) atau setelah ditandai lulus, ia melihat halaman beli seperti siswa
  // mandiri - di akun yang sama, riwayat dan nilainya tetap.
  if (data.jalur === "A" && data.ditanggungSekolah) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Langganan" />
        <Card>
          <p className="text-sm text-slate-600">
            Akunmu terdaftar lewat sekolah
            {data.sekolah ? (
              <>
                {" "}
                <span className="font-semibold text-slate-900">{data.sekolah.nama}</span>
              </>
            ) : (
              ""
            )}
            . Akses Try Out ditanggung oleh sekolahmu — kamu tidak perlu membeli paket sendiri.
          </p>
        </Card>

        {data.kreditDitunda && (
          <Alert variant="info">
            Kamu masih punya paket pribadi yang belum habis. Sisa harinya <b>tidak hangus</b>: ditunda selama sekolahmu
            menanggung, lalu berlaku lagi mulai {formatWIBDate(data.kreditDitunda.mulai)} sampai{" "}
            {formatWIBDate(data.kreditDitunda.sampai)}.
          </Alert>
        )}

        <Card>
          <p className="text-sm text-slate-500">Kode referral kamu</p>
          <p className="mt-1 text-sm text-slate-600">
            Bagikan ke temanmu yang daftar mandiri — mereka dapat diskon 30% untuk pembelian pertama.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-md bg-slate-100 px-3 py-1.5 font-mono text-sm font-semibold text-slate-900">
              {data.referralCode}
            </span>
            <Button variant="secondary" onClick={() => handleCopyReferral(data.referralCode)}>
              {copied ? "Disalin!" : "Salin kode"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Langganan & Voucher"
        description={
          data.jalur === "A"
            ? "Beli paket langganan atau tukarkan kode voucher dari mitra untuk lanjut belajar dengan akses try out tanpa batas."
            : "Kamu terdaftar sebagai siswa mandiri — beli paket langganan atau tukarkan kode voucher dari mitra untuk akses try out tanpa batas."
        }
      />

      {error && <Alert variant="danger">{error}</Alert>}

      {data.jalur === "A" && (
        <Alert variant="info">
          {data.alumni ? (
            <>
              Kamu sudah ditandai lulus
              {data.sekolah ? <> dari {data.sekolah.nama}</> : null}, jadi akses try out dari sekolah tidak berlaku lagi.
            </>
          ) : (
            <>
              Langganan sekolahmu
              {data.sekolah ? <> ({data.sekolah.nama})</> : null} sedang tidak aktif.
            </>
          )}{" "}
          Kamu bisa lanjut belajar dengan paket pribadi di akun yang sama — <b>riwayat dan nilaimu tetap tersimpan</b>. Kalau
          sekolahmu berlangganan lagi, sisa hari paket pribadimu otomatis ditunda, tidak hangus.
        </Alert>
      )}

      {data.kreditDitunda && (
        <Alert variant="info">
          Sebagian paket pribadimu ditunda karena sekolahmu menanggung aksesmu pada periode berikutnya. Paket itu berlaku
          lagi mulai {formatWIBDate(data.kreditDitunda.mulai)} sampai {formatWIBDate(data.kreditDitunda.sampai)}.
        </Alert>
      )}

      <Card>
        <p className="text-sm text-slate-500">Status akses</p>
        {data.entitlement ? (
          <>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {data.entitlement.canStartNewAttempt ? "Aktif" : "Sudah berakhir"} — berlaku sampai{" "}
              {formatWIBDate(data.entitlement.endsAt)}
            </p>
            <Badge variant="neutral">{SUMBER_LABEL[data.entitlement.source]}</Badge>
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-600">
            Belum ada langganan aktif. Kamu masih punya jatah 1× try out gratis per mata pelajaran.
          </p>
        )}
      </Card>

      {/* Form Tukar Kode Voucher Mitra di Posisi Utama */}
      <VoucherRedeemCard onSuccess={refreshData} />

      {data.pendingInvoiceId && (
        <Alert variant="warning">
          Kamu masih punya pembayaran yang tertunda. Selesaikan pembayaran itu dulu, atau tunggu sampai
          kedaluwarsa (24 jam) sebelum membeli paket baru.
        </Alert>
      )}

      {data.paymentMode === "affiliate" && (
        <Card className="border-indigo-200 bg-indigo-50/50">
          <p className="text-sm font-semibold text-indigo-950">Cara berlangganan</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-slate-700">
            <li>Pilih paket di bawah, lalu bayar lewat halaman affiliate.id yang terbuka di tab baru.</li>
            <li>
              Setelah membayar, kirim <b>bukti pembayaran</b> dan <b>email akunmu</b> ke admin lewat WhatsApp
              (tombol &quot;Konfirmasi via WhatsApp&quot; di bawah paket sudah menyiapkan pesannya).
            </li>
            <li>
              Admin memeriksa pembayaranmu lalu mengaktifkan langganan. Begitu aktif, status akses di halaman ini
              berubah menjadi <b>Aktif</b>.
            </li>
          </ol>
        </Card>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Pilih Paket</h2>
        {data.plans.length === 0 ? (
          <Alert variant="danger">Belum ada paket langganan yang tersedia. Hubungi admin pusat.</Alert>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.plans.map((p) => {
              const isSemester = p.durasiHari && p.durasiHari >= 90;
              return (
                <div
                  key={p.id}
                  className={`flex flex-col justify-between rounded-2xl border p-5 shadow-sm transition-all ${
                    isSemester
                      ? "border-indigo-300 bg-gradient-to-b from-indigo-50/50 via-white to-white ring-2 ring-indigo-500/20"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[0.68rem] font-bold ${
                          isSemester
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isSemester ? "★ REKOMENDASI TERBAIK" : "AKSES FLEKSIBEL"}
                      </span>
                      {p.durasiHari && (
                        <span className="font-mono text-xs text-slate-500">{p.durasiHari} hari</span>
                      )}
                    </div>

                    <p className="mt-3 text-xl font-bold text-slate-900">{p.nama}</p>
                    <p className="mt-1 text-2xl font-black text-indigo-700">{formatRupiah(p.harga)}</p>

                    <ul className="mt-4 flex flex-col gap-2 text-xs text-slate-600">
                      {isSemester ? (
                        <>
                          <li className="flex items-start gap-2 font-semibold text-indigo-950">
                            <span className="text-amber-500 font-bold">★</span>
                            <span>Mendapatkan Try Out Nasional 3 kali per mapel</span>
                          </li>
                          <li className="flex items-start gap-2 font-semibold text-indigo-950">
                            <span className="text-amber-500 font-bold">★</span>
                            <span>Plus Learning Analytics AI lengkap di TO Nasional</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Try Out Mandiri tanpa batas semua mapel</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Akses skor nilai &amp; peta kompetensi sepuasnya</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-indigo-600 font-bold">✦</span>
                            <span>Plus 1x Analisis Learning Analytics per mapel untuk TO Mandiri</span>
                          </li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Try Out Mandiri tanpa batas semua mapel</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span>Akses skor nilai &amp; peta kompetensi sepuasnya</span>
                          </li>
                          <li className="flex items-start gap-2 font-medium text-indigo-900">
                            <span className="text-indigo-600 font-bold">✦</span>
                            <span>Plus 1x Learning Analytics AI per mapel</span>
                          </li>
                          <li className="flex items-start gap-2 text-slate-400">
                            <span className="text-slate-400 font-bold">✕</span>
                            <span className="line-through">Tidak termasuk Try Out Nasional</span>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>

                  {data.paymentMode === "affiliate" ? (
                    <div className="mt-5 flex flex-col gap-2">
                      {data.affiliatePlans?.[p.id] ? (
                        <>
                          <a
                            href={data.affiliatePlans[p.id]!.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${buttonClassName("primary")} w-full text-center ${isSemester ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                          >
                            Bayar Sekarang
                          </a>
                          <a
                            href={data.affiliatePlans[p.id]!.waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-center text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                          >
                            Sudah membayar? Konfirmasi via WhatsApp →
                          </a>
                        </>
                      ) : (
                        <p className="text-center text-xs text-slate-500">
                          Paket ini belum tersedia untuk dibayar online. Hubungi admin pusat.
                        </p>
                      )}
                    </div>
                  ) : (
                    <Button
                      className={`mt-5 w-full ${isSemester ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                      disabled={submittingPlanId !== null || Boolean(data.pendingInvoiceId)}
                      onClick={() => handleBeli(p.id)}
                    >
                      {submittingPlanId === p.id ? "Memproses..." : "Bayar Sekarang"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Card>
        <p className="text-sm text-slate-500">Kode referral kamu</p>
        <p className="mt-1 text-sm text-slate-600">
          Bagikan ke temanmu yang daftar mandiri — mereka dapat diskon 30% untuk pembelian pertama.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-md bg-slate-100 px-3 py-1.5 font-mono text-sm font-semibold text-slate-900">
            {data.referralCode}
          </span>
          <Button variant="secondary" onClick={() => handleCopyReferral(data.referralCode)}>
            {copied ? "Disalin!" : "Salin kode"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
