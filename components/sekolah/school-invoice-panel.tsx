"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatWIBDate, tanggalWIB } from "@/lib/utils/datetime";
import { formatRupiah } from "@/lib/billing/school-invoice";
import { geserTanggal } from "@/lib/billing/periode-sekolah";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { useDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { FileText, Download, Plus, CheckCircle, XCircle, Trash2, Banknote } from "lucide-react";

type BankAccount = {
  id: string;
  namaBank: string;
  nomorRekening: string;
  atasNama: string;
  isActive: boolean;
};

type PeriodeRingkas = {
  id: string;
  nama: string | null;
  mulai: string;
  berakhir: string;
};

type Invoice = {
  id: string;
  schoolId: string;
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
  periode: PeriodeRingkas | null;
};

export function SchoolInvoicePanel({
  schoolId,
  defaultJumlahSiswa = 100,
}: {
  schoolId: string;
  defaultJumlahSiswa?: number;
}) {
  const toast = useToast();
  const { confirm } = useDialog();

  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [periodes, setPeriodes] = useState<PeriodeRingkas[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Form State
  const [jumlahSiswa, setJumlahSiswa] = useState(String(defaultJumlahSiswa || 100));
  const [hargaPerSiswa, setHargaPerSiswa] = useState("20000");
  const [jatuhTempo, setJatuhTempo] = useState(geserTanggal(tanggalWIB(), 14));
  const [statusBayar, setStatusBayar] = useState<"lunas" | "menunggu_pembayaran">("lunas");
  const [tanggalBayar, setTanggalBayar] = useState(tanggalWIB());
  const [keterangan, setKeterangan] = useState("Paket Akses Ujian Try Out AyoTKA");
  const [bankTujuan, setBankTujuan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [periodeId, setPeriodeId] = useState("");

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [invRes, bankRes, perRes] = await Promise.all([
          fetch(`/api/admin-pusat/schools/${schoolId}/invoices`),
          fetch("/api/admin-pusat/bank-accounts"),
          fetch(`/api/admin-pusat/schools/${schoolId}/periode`),
        ]);

        const [invData, bankData, perData] = await Promise.all([
          invRes.json().catch(() => null),
          bankRes.json().catch(() => null),
          perRes.json().catch(() => null),
        ]);

        if (!ignore) {
          if (invRes.ok) setInvoices(invData.invoices ?? []);
          if (bankRes.ok) {
            const activeBanks = (bankData.bankAccounts ?? []).filter((b: BankAccount) => b.isActive);
            setBankAccounts(activeBanks);
            if (activeBanks.length > 0) {
              const defaultBank = activeBanks[0];
              setBankTujuan((prev) => prev || `${defaultBank.namaBank} - No. Rek: ${defaultBank.nomorRekening} a.n. ${defaultBank.atasNama}`);
            }
          }
          if (perRes.ok) {
            setPeriodes(perData.periode ?? []);
          }
        }
      } catch (err) {
        console.error("Gagal memuat data invoice:", err);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [schoolId, refreshKey]);

  const parsedJumlah = Math.max(0, parseInt(jumlahSiswa, 10) || 0);
  const parsedHarga = Math.max(0, parseInt(hargaPerSiswa, 10) || 0);
  const totalKalkulasi = parsedJumlah * parsedHarga;

  async function handleCreateInvoice(e: FormEvent) {
    e.preventDefault();
    if (parsedJumlah <= 0) {
      setError("Jumlah siswa minimal 1.");
      return;
    }
    if (parsedHarga < 0) {
      setError("Harga per siswa tidak boleh negatif.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/admin-pusat/schools/${schoolId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jumlahSiswa: parsedJumlah,
          hargaPerSiswa: parsedHarga,
          jatuhTempo,
          keterangan: keterangan.trim() || null,
          bankTujuan: bankTujuan.trim() || null,
          catatan: catatan.trim() || null,
          periodeId: periodeId || null,
          status: statusBayar,
          dibayarAt: statusBayar === "lunas" ? (tanggalBayar || new Date().toISOString()) : null,
        }),
      });

      const data = await res.json().catch(() => null);
      setSubmitting(false);

      if (!res.ok) {
        setError(data?.error ?? "Gagal menerbitkan invoice.");
        return;
      }

      toast.success("Invoice pembayaran berhasil diterbitkan!");
      setShowForm(false);
      setRefreshKey((k) => k + 1);
    } catch (_err) {
      setSubmitting(false);
      setError("Terjadi kesalahan jaringan.");
    }
  }

  async function handleToggleStatus(inv: Invoice, nextStatus: "lunas" | "dibatalkan" | "menunggu_pembayaran") {
    const label = nextStatus === "lunas" ? "Tandai lunas" : nextStatus === "dibatalkan" ? "Batalkan" : "Kembalikan ke belum bayar";
    const ok = await confirm({
      title: `${label} invoice ${inv.nomorInvoice}?`,
      description: nextStatus === "lunas"
        ? "Invoice akan ditandai Lunas dan admin sekolah dapat mengunduh invoice berstatus Lunas."
        : "Status invoice akan diperbarui di sistem.",
      confirmLabel: label,
      danger: nextStatus === "dibatalkan",
    });

    if (!ok) return;

    const res = await fetch(`/api/admin-pusat/schools/${schoolId}/invoices/${inv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Gagal memperbarui status invoice.");
      return;
    }

    toast.success(`Invoice ${inv.nomorInvoice} berhasil diperbarui.`);
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(inv: Invoice) {
    const ok = await confirm({
      title: `Hapus invoice ${inv.nomorInvoice}?`,
      description: "Invoice ini akan dihapus secara permanen dari sistem.",
      confirmLabel: "Hapus invoice",
      danger: true,
    });

    if (!ok) return;

    const res = await fetch(`/api/admin-pusat/schools/${schoolId}/invoices/${inv.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      toast.error("Gagal menghapus invoice.");
      return;
    }

    toast.success(`Invoice ${inv.nomorInvoice} berhasil dihapus.`);
    setRefreshKey((k) => k + 1);
  }

  function handleDownloadPdf(inv: Invoice) {
    setDownloadingId(inv.id);
    const link = document.createElement("a");
    link.href = `/api/admin-pusat/schools/${schoolId}/invoices/${inv.id}/pdf`;
    link.download = `invoice-${inv.nomorInvoice.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloadingId(null), 1000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Invoice & Tagihan Sekolah</h2>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-mono text-xs font-medium text-indigo-700">
              PDF Generator
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Terbitkan invoice resmi untuk sekolah ini dengan mengatur jumlah siswa dan harga per siswa. Admin sekolah dapat melihat dan mengunduh invoice dalam format PDF.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          <span>{showForm ? "Batal" : "Buat Invoice Baru"}</span>
        </Button>
      </div>

      {/* Form Pembuatan Invoice */}
      {showForm && (
        <form
          onSubmit={handleCreateInvoice}
          className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4 sm:p-6"
        >
          <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">Form Penerbitan Invoice Sekolah</h3>
            <span className="text-xs text-slate-500">Nomor invoice otomatis digenerate</span>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="jumlahSiswa">Jumlah Siswa / Kuota Kursi</Label>
              <Input
                id="jumlahSiswa"
                type="number"
                min="1"
                required
                value={jumlahSiswa}
                onChange={(e) => setJumlahSiswa(e.target.value)}
                placeholder="Contoh: 150"
              />
              <p className="mt-1 text-xs text-slate-500">Jumlah siswa yang ditagihkan dalam invoice ini.</p>
            </div>

            <div>
              <Label htmlFor="hargaPerSiswa">Harga per Siswa (Rp)</Label>
              <Input
                id="hargaPerSiswa"
                type="number"
                min="0"
                step="500"
                required
                value={hargaPerSiswa}
                onChange={(e) => setHargaPerSiswa(e.target.value)}
                placeholder="Contoh: 25000"
              />
              <p className="mt-1 text-xs text-slate-500">Biaya per siswa (satuan Rupiah).</p>
            </div>
          </div>

          {/* Kotak Kalkulasi Live */}
          <div className="flex items-center justify-between rounded-xl border border-indigo-200/80 bg-white p-3.5 shadow-xs">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-indigo-600" />
              <div>
                <span className="text-xs text-slate-500">Kalkulasi Otomatis:</span>
                <p className="text-xs font-medium text-slate-700">
                  {parsedJumlah.toLocaleString("id-ID")} siswa × {formatRupiah(parsedHarga)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500">Total Tagihan:</span>
              <p className="text-base font-bold text-indigo-600">{formatRupiah(totalKalkulasi)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="jatuhTempo">Tanggal Jatuh Tempo Pembayaran</Label>
              <Input
                id="jatuhTempo"
                type="date"
                required
                value={jatuhTempo}
                onChange={(e) => setJatuhTempo(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="periodeId">Tautkan ke Periode Langganan (Opsional)</Label>
              <select
                id="periodeId"
                value={periodeId}
                onChange={(e) => setPeriodeId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">-- Tanpa tautan periode spesifik --</option>
                {periodes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama || `Periode ${formatWIBDate(p.mulai)} s/d ${formatWIBDate(p.berakhir)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="bankTujuan">Rekening Tujuan Transfer</Label>
            {bankAccounts.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {bankAccounts.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBankTujuan(`${b.namaBank} - No. Rek: ${b.nomorRekening} a.n. ${b.atasNama}`)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                  >
                    Gunakan {b.namaBank} ({b.nomorRekening})
                  </button>
                ))}
              </div>
            )}
            <Input
              id="bankTujuan"
              required
              value={bankTujuan}
              onChange={(e) => setBankTujuan(e.target.value)}
              placeholder="Contoh: Bank Mandiri - No. Rek: 144-00-1234567-8 a.n. PT Ayo TKA Edukasi"
            />
          </div>

          {/* Status Pembayaran & Pelunasan */}
          <div className="rounded-xl border border-indigo-200/80 bg-white p-4 shadow-2xs">
            <Label className="mb-2 block font-medium text-slate-800">Status Pembayaran Invoice</Label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setStatusBayar("lunas")}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                  statusBayar === "lunas"
                    ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20 text-emerald-950"
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <CheckCircle className={`mt-0.5 h-5 w-5 shrink-0 ${statusBayar === "lunas" ? "text-emerald-600" : "text-slate-400"}`} />
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Sudah Lunas (Lunas Sah)</span>
                    <Badge variant="success" className="text-[10px] py-0 px-1.5">Direkomendasikan</Badge>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Invoice langsung berstatus Lunas, dicap stempel digital resmi pada PDF, dan berlaku sebagai kuitansi tanda terima sah.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusBayar("menunggu_pembayaran")}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                  statusBayar === "menunggu_pembayaran"
                    ? "border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20 text-amber-950"
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <Banknote className={`mt-0.5 h-5 w-5 shrink-0 ${statusBayar === "menunggu_pembayaran" ? "text-amber-600" : "text-slate-400"}`} />
                <div>
                  <div className="text-xs font-bold text-slate-900">Menunggu Pembayaran (Belum Bayar)</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Tagihan baru yang belum dibayar oleh sekolah. Mencantumkan petunjuk transfer bank.
                  </p>
                </div>
              </button>
            </div>

            {statusBayar === "lunas" && (
              <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="sm:w-1/2">
                  <Label htmlFor="tanggalBayar" className="text-xs text-slate-700 font-medium">Tanggal Pelunasan</Label>
                  <Input
                    id="tanggalBayar"
                    type="date"
                    required
                    value={tanggalBayar}
                    onChange={(e) => setTanggalBayar(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="sm:w-1/2 text-xs text-emerald-800 bg-emerald-50 rounded-lg p-2.5 border border-emerald-200/60 leading-relaxed">
                  ✓ Dokumen PDF akan otomatis dibubuhi <strong>Stempel Digital LUNAS</strong> dan <strong>Bukti Pelunasan Resmi</strong>.
                </div>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="keterangan">Keterangan / Nama Layanan</Label>
            <Input
              id="keterangan"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Contoh: Paket Akses Ujian Try Out AyoTKA - Semester Ganjil"
            />
          </div>

          <div>
            <Label htmlFor="catatan">Catatan Tambahan (Opsional, tercetak di PDF)</Label>
            <Input
              id="catatan"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Contoh: Harap konfirmasi bukti transfer via WhatsApp ke Tim Admin AyoTKA."
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={submitting}
              className={statusBayar === "lunas" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
            >
              {submitting
                ? "Menerbitkan..."
                : statusBayar === "lunas"
                ? "Terbitkan Invoice Lunas & Generate PDF"
                : "Terbitkan & Generate PDF"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Batal
            </Button>
          </div>
        </form>
      )}

      {/* Daftar Invoice */}
      {invoices === null ? (
        <div className="rounded-xl border border-slate-200 p-4 text-center text-sm text-slate-500 animate-pulse">
          Memuat daftar invoice...
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700">Belum ada invoice untuk sekolah ini</p>
          <p className="mt-1 text-xs text-slate-500">
            Klik tombol &ldquo;Buat Invoice Baru&rdquo; di atas untuk menerbitkan tagihan pembayaran bagi sekolah ini.
          </p>
        </div>
      ) : (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>No. Invoice</Th>
                <Th>Tanggal & Jatuh Tempo</Th>
                <Th>Rincian Siswa</Th>
                <Th>Total Tagihan</Th>
                <Th>Status</Th>
                <Th className="text-right">Aksi</Th>
              </Tr>
            </Thead>
            <tbody>
              {invoices.map((inv) => (
                <Tr key={inv.id}>
                  <Td>
                    <div className="font-mono text-xs font-bold text-slate-900">{inv.nomorInvoice}</div>
                    {inv.keterangan && (
                      <span className="text-[11px] text-slate-400 block max-w-xs truncate">{inv.keterangan}</span>
                    )}
                  </Td>
                  <Td>
                    <div className="text-xs text-slate-700">Terbit: {formatWIBDate(inv.tanggalInvoice)}</div>
                    <div className="text-xs text-slate-500">Tempo: {formatWIBDate(inv.jatuhTempo)}</div>
                    {inv.dibayarAt && (
                      <div className="text-[11px] text-emerald-600 font-medium">Lunas: {formatWIBDate(inv.dibayarAt)}</div>
                    )}
                  </Td>
                  <Td>
                    <div className="text-xs font-medium text-slate-800">
                      {inv.jumlahSiswa.toLocaleString("id-ID")} Siswa
                    </div>
                    <div className="text-[11px] text-slate-500">
                      @ {formatRupiah(inv.hargaPerSiswa)}
                    </div>
                  </Td>
                  <Td>
                    <div className="text-sm font-bold text-indigo-700">{formatRupiah(inv.totalAmount)}</div>
                  </Td>
                  <Td>
                    <Badge variant={inv.status === "lunas" ? "success" : inv.status === "menunggu_pembayaran" ? "warning" : "danger"}>
                      {inv.status === "lunas" ? "Lunas" : inv.status === "menunggu_pembayaran" ? "Menunggu Bayar" : "Dibatalkan"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Download PDF */}
                      <Button
                        variant="secondary"
                        onClick={() => handleDownloadPdf(inv)}
                        disabled={downloadingId === inv.id}
                        className="inline-flex items-center gap-1 text-xs py-1 px-2"
                        title="Download Invoice PDF"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>PDF</span>
                      </Button>

                      {/* Tombol Aksi Status */}
                      {inv.status === "menunggu_pembayaran" && (
                        <button
                          onClick={() => handleToggleStatus(inv, "lunas")}
                          className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Tandai Sudah Lunas"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}

                      {inv.status === "menunggu_pembayaran" && (
                        <button
                          onClick={() => handleToggleStatus(inv, "dibatalkan")}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Batalkan Invoice"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}

                      {inv.status === "lunas" && (
                        <button
                          onClick={() => handleToggleStatus(inv, "menunggu_pembayaran")}
                          className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 transition-colors text-xs font-medium"
                          title="Ubah kembali ke belum bayar"
                        >
                          Batal Lunas
                        </button>
                      )}

                      {inv.status !== "lunas" && (
                        <button
                          onClick={() => handleDelete(inv)}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                          title="Hapus Invoice"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
