"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  PRESET_PENERBIT,
  hitungInvoiceBebas,
  hariIniWIB,
  isianAwalInvoiceBebas,
  nomorInvoiceBebas,
  tambahHariTanggal,
  type InvoiceBebasForm,
  type PresetPenerbit,
} from "@/lib/invoice/bebas";
import { angkaRibuan, namaBerkasInvoice, rupiahRingkas } from "@/lib/pdf/invoice-identitas";
import { formatWIBDate } from "@/lib/utils/datetime";

/**
 * Pembuat Invoice (port dari alat invoice-ayotka.html milik pemilik). Isian di kiri, pratinjau PDF di kanan: PDF yang
 * dilihat adalah PDF yang diunduh (dirender server dengan renderer yang sama dengan invoice sekolah), diperbarui sebentar
 * setelah isian berhenti diubah. "Terbitkan & unduh" mencatat nomor di buku nomor supaya tidak dipakai ganda oleh invoice
 * lain; "Unduh draf" tidak mencatat apa pun. Angka disimpan sebagai TEKS di formulir supaya ketikan seperti "1,5" tidak
 * dipotong, lalu diubah jadi angka saat dikirim.
 */

type BarisUI = { deskripsi: string; detail: string; jumlah: string; satuan: string; harga: string };
type FormUI = {
  penerbit: { preset: PresetPenerbit; nama: string; alamat: string; kode: string };
  nomorUrut: string;
  status: "menunggu_pembayaran" | "lunas";
  tanggalTerbit: string;
  jatuhTempo: string;
  penerima: { nama: string; alamat: string; up: string };
  baris: BarisUI[];
  pajak: { aktif: boolean; persen: string };
  pembayaran: { bank: string; rekening: string; atasNama: string; catatan: string };
  pengesahan: { kota: string; nama: string; jabatan: string; tandaTangan: boolean; stempel: boolean };
};

const angkaAtauNaN = (s: string) => (s.trim() === "" ? Number.NaN : Number(s.replace(",", ".")));

function keMuatan(f: FormUI): InvoiceBebasForm {
  return {
    ...f,
    nomorUrut: angkaAtauNaN(f.nomorUrut),
    baris: f.baris.map((b) => ({ ...b, jumlah: angkaAtauNaN(b.jumlah), harga: angkaAtauNaN(b.harga) })),
    pajak: { aktif: f.pajak.aktif, persen: angkaAtauNaN(f.pajak.persen) },
  };
}

function dariMuatan(m: InvoiceBebasForm): FormUI {
  return {
    ...m,
    nomorUrut: String(m.nomorUrut),
    baris: m.baris.map((b) => ({ ...b, jumlah: String(b.jumlah), harga: String(b.harga) })),
    pajak: { aktif: m.pajak.aktif, persen: String(m.pajak.persen) },
  };
}

type Riwayat = { id: string; nomorInvoice: string; penerima: string; totalAmount: number; status: string; tanggalInvoice: string; createdAt: string };
type Saran = { urutBerikutnya: number; nomorBerikutnya: string; dipakai: "invoice_sekolah" | "invoice_bebas" | "luar_aplikasi" | null };
type Pratinjau = { tahap: "kosong" | "memuat" | "siap" | "galat"; url: string | null; pesan: string | null };

const PEMAKAI_TEKS = {
  invoice_sekolah: "sudah dipakai invoice sekolah",
  invoice_bebas: "sudah dipakai invoice lain dari pembuat ini",
  luar_aplikasi: "sudah dipakai untuk invoice yang diterbitkan di luar aplikasi",
} as const;

const kelasInput =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10";

function Bidang({ label, htmlFor, petunjuk, children }: { label: string; htmlFor?: string; petunjuk?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {petunjuk && <p className="mt-1 text-xs text-slate-500">{petunjuk}</p>}
    </div>
  );
}

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-slate-100 pt-4">
      <legend className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-teal-600">{judul}</legend>
      {children}
    </fieldset>
  );
}

function namaDariHeader(disposisi: string | null, cadangan: string): string {
  const m = /filename="([^"]+)"/.exec(disposisi ?? "");
  return m?.[1] ?? cadangan;
}

function unduhBlob(blob: Blob, nama: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function PembuatInvoicePage() {
  const [form, setForm] = useState<FormUI>(() => dariMuatan(isianAwalInvoiceBebas()));
  const [pratinjau, setPratinjau] = useState<Pratinjau>({ tahap: "kosong", url: null, pesan: null });
  const [saran, setSaran] = useState<Saran | null>(null);
  const [riwayat, setRiwayat] = useState<Riwayat[] | null>(null);
  const [galatRiwayat, setGalatRiwayat] = useState<string | null>(null);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [sibuk, setSibuk] = useState<"terbit" | "draf" | null>(null);
  const [pesan, setPesan] = useState<{ jenis: "sukses" | "galat"; teks: string } | null>(null);

  // Nomor urut mengikuti saran server selama belum diubah tangan; jatuh tempo mengikuti tanggal terbit (+14 hari) selama belum diubah tangan.
  const urutManualRef = useRef(false);
  const tempoManualRef = useRef(false);
  const urlPratinjauRef = useRef<string | null>(null);
  const urutanPermintaanRef = useRef(0);

  const muatanKunci = useMemo(() => JSON.stringify(keMuatan(form)), [form]);
  const hitung = useMemo(() => {
    const m = keMuatan(form);
    return hitungInvoiceBebas({ baris: m.baris, pajak: m.pajak });
  }, [form]);

  const ubah = useCallback((fn: (f: FormUI) => FormUI) => setForm((f) => fn(f)), []);

  // ----- riwayat -----
  const muatRiwayat = useCallback(async () => {
    try {
      const res = await fetch("/api/admin-pusat/invoice-bebas", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { riwayat?: Riwayat[]; error?: string } | null;
      if (!res.ok || !data?.riwayat) {
        setGalatRiwayat(data?.error ?? "Gagal memuat riwayat invoice.");
        return;
      }
      setGalatRiwayat(null);
      setRiwayat(data.riwayat);
    } catch {
      setGalatRiwayat("Koneksi bermasalah saat memuat riwayat invoice.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await muatRiwayat();
    })();
  }, [muatRiwayat]);

  // ----- saran nomor urut (kode + bulan terbit + nomor yang sedang diketik) -----
  const kodeNomor = form.penerbit.kode;
  const tanggalTerbit = form.tanggalTerbit;
  const nomorUrutTeks = form.nomorUrut;
  const muatSaran = useCallback(async (kode: string, tanggal: string, urut: string) => {
    try {
      const q = new URLSearchParams({ kode, tanggal });
      if (/^\d{1,5}$/.test(urut.trim())) q.set("urut", urut.trim());
      const res = await fetch(`/api/admin-pusat/invoice-bebas/nomor?${q}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as (Saran & { error?: string }) | null;
      if (!res.ok || !data) {
        setSaran(null);
        return;
      }
      setSaran({ urutBerikutnya: data.urutBerikutnya, nomorBerikutnya: data.nomorBerikutnya, dipakai: data.dipakai });
      if (!urutManualRef.current) {
        setForm((f) => (f.nomorUrut === String(data.urutBerikutnya) ? f : { ...f, nomorUrut: String(data.urutBerikutnya) }));
      }
    } catch {
      setSaran(null);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void muatSaran(kodeNomor, tanggalTerbit, nomorUrutTeks), 400);
    return () => clearTimeout(t);
  }, [kodeNomor, tanggalTerbit, nomorUrutTeks, muatSaran]);

  // ----- pratinjau PDF (ditunda sebentar setelah isian berhenti berubah) -----
  const muatPratinjau = useCallback(async (muatan: string) => {
    const nomorPermintaan = ++urutanPermintaanRef.current;
    setPratinjau((p) => ({ ...p, tahap: "memuat" }));
    try {
      const res = await fetch("/api/admin-pusat/invoice-bebas/pratinjau", { method: "POST", headers: { "Content-Type": "application/json" }, body: muatan });
      if (nomorPermintaan !== urutanPermintaanRef.current) return; // sudah ada permintaan yang lebih baru
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setPratinjau((p) => ({ ...p, tahap: "galat", pesan: data?.error ?? "Pratinjau belum bisa dibuat." }));
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      if (nomorPermintaan !== urutanPermintaanRef.current) {
        URL.revokeObjectURL(url);
        return;
      }
      const lama = urlPratinjauRef.current;
      urlPratinjauRef.current = url;
      setPratinjau({ tahap: "siap", url, pesan: null });
      if (lama) setTimeout(() => URL.revokeObjectURL(lama), 2_000);
    } catch {
      if (nomorPermintaan !== urutanPermintaanRef.current) return;
      setPratinjau((p) => ({ ...p, tahap: "galat", pesan: "Koneksi bermasalah saat membuat pratinjau." }));
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void muatPratinjau(muatanKunci), 700);
    return () => clearTimeout(t);
  }, [muatanKunci, muatPratinjau]);

  useEffect(
    () => () => {
      if (urlPratinjauRef.current) URL.revokeObjectURL(urlPratinjauRef.current);
    },
    [],
  );

  // ----- pembaruan isian -----
  function gantiPreset(preset: PresetPenerbit) {
    const p = PRESET_PENERBIT[preset];
    ubah((f) => ({ ...f, penerbit: { preset, nama: p.nama, alamat: p.alamat, kode: p.kode } }));
    urutManualRef.current = false;
  }

  function gantiTanggalTerbit(nilai: string) {
    ubah((f) => ({ ...f, tanggalTerbit: nilai, jatuhTempo: !tempoManualRef.current && nilai ? tambahHariTanggal(nilai, 14) : f.jatuhTempo }));
  }

  function ubahBaris(i: number, isi: Partial<BarisUI>) {
    ubah((f) => ({ ...f, baris: f.baris.map((b, j) => (j === i ? { ...b, ...isi } : b)) }));
  }

  function tambahBaris() {
    ubah((f) => ({ ...f, baris: [...f.baris, { deskripsi: "", detail: "", jumlah: "1", satuan: "paket", harga: "0" }] }));
  }

  function hapusBaris(i: number) {
    ubah((f) => (f.baris.length <= 1 ? f : { ...f, baris: f.baris.filter((_, j) => j !== i) }));
  }

  async function pakaiSebagaiDasar(id: string) {
    setPesan(null);
    try {
      const res = await fetch(`/api/admin-pusat/invoice-bebas/${id}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { data?: InvoiceBebasForm; error?: string } | null;
      if (!res.ok || !data?.data) {
        setPesan({ jenis: "galat", teks: data?.error ?? "Gagal memuat invoice itu." });
        return;
      }
      // Isinya dipakai ulang; nomor, tanggal, dan status diperbarui untuk invoice baru.
      const hariIni = hariIniWIB();
      urutManualRef.current = false;
      tempoManualRef.current = false;
      setForm({ ...dariMuatan(data.data), tanggalTerbit: hariIni, jatuhTempo: tambahHariTanggal(hariIni, 14), status: "menunggu_pembayaran" });
      setKonfirmasi(false);
      setPesan({ jenis: "sukses", teks: "Isian invoice dimuat. Nomor, tanggal, dan status sudah disesuaikan untuk invoice baru." });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setPesan({ jenis: "galat", teks: "Koneksi bermasalah saat memuat invoice itu." });
    }
  }

  // ----- aksi -----
  const nomorLengkap = useMemo(() => {
    try {
      const m = keMuatan(form);
      if (!Number.isInteger(m.nomorUrut) || m.nomorUrut < 1 || m.nomorUrut > 99_999) return null;
      return nomorInvoiceBebas({ penerbit: { ...m.penerbit, kode: m.penerbit.kode.trim().toUpperCase() }, nomorUrut: m.nomorUrut, tanggalTerbit: m.tanggalTerbit });
    } catch {
      return null;
    }
  }, [form]);

  const pratinjauSiap = pratinjau.tahap === "siap" && pratinjau.url !== null;

  async function terbitkan() {
    if (sibuk) return;
    setSibuk("terbit");
    setPesan(null);
    try {
      const res = await fetch("/api/admin-pusat/invoice-bebas", { method: "POST", headers: { "Content-Type": "application/json" }, body: muatanKunci });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setPesan({ jenis: "galat", teks: data?.error ?? "Invoice belum bisa diterbitkan." });
        setKonfirmasi(false);
        void muatSaran(kodeNomor, tanggalTerbit, nomorUrutTeks);
        return;
      }
      const nomor = decodeURIComponent(res.headers.get("X-Nomor-Invoice") ?? nomorLengkap ?? "");
      unduhBlob(await res.blob(), namaDariHeader(res.headers.get("Content-Disposition"), namaBerkasInvoice(nomor || "invoice", form.penerima.nama)));
      setPesan({ jenis: "sukses", teks: `Invoice ${nomor} diterbitkan, nomornya dicatat, dan PDF-nya diunduh. Nomor berikutnya sudah disiapkan.` });
      setKonfirmasi(false);
      urutManualRef.current = false; // nomor otomatis maju ke yang berikutnya
      void muatSaran(kodeNomor, tanggalTerbit, "");
      void muatRiwayat();
    } catch {
      setPesan({ jenis: "galat", teks: "Koneksi bermasalah. Invoice belum diterbitkan, coba lagi." });
    } finally {
      setSibuk(null);
    }
  }

  async function unduhDraf() {
    if (sibuk || !pratinjauSiap || !pratinjau.url) return;
    setSibuk("draf");
    try {
      const blob = await (await fetch(pratinjau.url)).blob();
      unduhBlob(blob, `${namaBerkasInvoice(nomorLengkap ?? "invoice", form.penerima.nama).replace(/\.pdf$/, "")} (draf).pdf`);
    } finally {
      setSibuk(null);
    }
  }

  const banyakBaris = form.baris.length;
  const adaGalatNomor = saran?.dipakai != null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pembuat Invoice"
        description="Buat invoice AyoTKA untuk sekolah atau pihak mana pun: isi data di kiri, pratinjau PDF langsung berubah di kanan. Invoice yang diterbitkan dicatat nomornya supaya tidak dipakai ganda."
      />

      {pesan && (
        <Alert variant={pesan.jenis === "sukses" ? "success" : "danger"} role={pesan.jenis === "sukses" ? "status" : "alert"} data-pesan-pembuat-invoice>
          {pesan.teks}
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-4" data-form-invoice>
          <Bagian judul="Penerbit">
            <Bidang label="Diterbitkan atas nama" htmlFor="inv-preset">
              <select id="inv-preset" className={kelasInput} value={form.penerbit.preset} onChange={(e) => gantiPreset(e.target.value as PresetPenerbit)}>
                {(Object.keys(PRESET_PENERBIT) as PresetPenerbit[]).map((k) => (
                  <option key={k} value={k}>
                    {PRESET_PENERBIT[k].label}
                  </option>
                ))}
              </select>
            </Bidang>
            <Bidang label="Nama penerbit" htmlFor="inv-pub-nama">
              <Input id="inv-pub-nama" value={form.penerbit.nama} maxLength={120} onChange={(e) => ubah((f) => ({ ...f, penerbit: { ...f.penerbit, nama: e.target.value } }))} />
            </Bidang>
            <Bidang label="Alamat & kontak penerbit" htmlFor="inv-pub-alamat">
              <textarea id="inv-pub-alamat" rows={3} maxLength={400} className={kelasInput} value={form.penerbit.alamat} onChange={(e) => ubah((f) => ({ ...f, penerbit: { ...f.penerbit, alamat: e.target.value } }))} />
            </Bidang>
            <Bidang label="Kode nomor invoice" htmlFor="inv-kode" petunjuk="AYOTKA berbagi urutan dengan invoice sekolah di aplikasi; kode lain punya urutan sendiri.">
              <Input
                id="inv-kode"
                value={form.penerbit.kode}
                maxLength={12}
                onChange={(e) => {
                  urutManualRef.current = false;
                  ubah((f) => ({ ...f, penerbit: { ...f.penerbit, kode: e.target.value.toUpperCase() } }));
                }}
              />
            </Bidang>
          </Bagian>

          <Bagian judul="Ditagihkan kepada">
            <Bidang label="Nama sekolah *" htmlFor="inv-to-nama">
              <Input id="inv-to-nama" value={form.penerima.nama} maxLength={150} placeholder="mis. MTsN 1 Kediri" onChange={(e) => ubah((f) => ({ ...f, penerima: { ...f.penerima, nama: e.target.value } }))} />
            </Bidang>
            <Bidang label="Alamat (opsional)" htmlFor="inv-to-alamat">
              <textarea id="inv-to-alamat" rows={2} maxLength={300} className={kelasInput} placeholder="Jl. ..., Kota ..." value={form.penerima.alamat} onChange={(e) => ubah((f) => ({ ...f, penerima: { ...f.penerima, alamat: e.target.value } }))} />
            </Bidang>
            <Bidang label="Up. / kontak (opsional)" htmlFor="inv-to-up">
              <Input id="inv-to-up" value={form.penerima.up} maxLength={120} placeholder="mis. Kepala Sekolah / Bendahara" onChange={(e) => ubah((f) => ({ ...f, penerima: { ...f.penerima, up: e.target.value } }))} />
            </Bidang>
          </Bagian>

          <Bagian judul="Nomor & tanggal">
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <Bidang label="Nomor urut" htmlFor="inv-urut">
                <Input
                  id="inv-urut"
                  type="number"
                  min={1}
                  max={99999}
                  value={form.nomorUrut}
                  onChange={(e) => {
                    urutManualRef.current = true;
                    ubah((f) => ({ ...f, nomorUrut: e.target.value }));
                  }}
                />
              </Bidang>
              <Bidang label="Status" htmlFor="inv-status">
                <select id="inv-status" className={kelasInput} value={form.status} onChange={(e) => ubah((f) => ({ ...f, status: e.target.value as FormUI["status"] }))}>
                  <option value="menunggu_pembayaran">Belum dibayar</option>
                  <option value="lunas">Lunas</option>
                </select>
              </Bidang>
            </div>
            {nomorLengkap && (
              <p className="text-xs text-slate-500" data-nomor-lengkap>
                Nomor invoice: <span className="font-mono font-semibold text-slate-800">{nomorLengkap}</span>
              </p>
            )}
            {adaGalatNomor && saran && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert" data-peringatan-nomor>
                <span>
                  Nomor urut {form.nomorUrut} {PEMAKAI_TEKS[saran.dipakai!]}. Yang berikutnya masih bebas: {saran.urutBerikutnya}.
                </span>
                <button
                  type="button"
                  className="rounded border border-rose-300 bg-white px-2 py-0.5 font-semibold text-rose-700 hover:bg-rose-100"
                  onClick={() => {
                    urutManualRef.current = false;
                    ubah((f) => ({ ...f, nomorUrut: String(saran.urutBerikutnya) }));
                  }}
                >
                  Pakai {saran.urutBerikutnya}
                </button>
              </div>
            )}
            {!adaGalatNomor && saran && (
              <p className="text-xs text-slate-500" data-saran-nomor>
                Nomor berikutnya yang masih bebas bulan ini: {saran.urutBerikutnya}.
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <Bidang label="Tanggal terbit" htmlFor="inv-terbit">
                <Input id="inv-terbit" type="date" value={form.tanggalTerbit} onChange={(e) => gantiTanggalTerbit(e.target.value)} />
              </Bidang>
              <Bidang label="Jatuh tempo" htmlFor="inv-tempo">
                <Input
                  id="inv-tempo"
                  type="date"
                  value={form.jatuhTempo}
                  onChange={(e) => {
                    tempoManualRef.current = true;
                    ubah((f) => ({ ...f, jatuhTempo: e.target.value }));
                  }}
                />
              </Bidang>
            </div>
            <p className="text-xs text-slate-500">Jatuh tempo otomatis 14 hari setelah tanggal terbit, tetapi bisa diubah.</p>
          </Bagian>

          <Bagian judul="Rincian tagihan">
            {form.baris.map((b, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3" data-baris-invoice>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Baris {i + 1}</span>
                  {banyakBaris > 1 && (
                    <button type="button" className="text-rose-600 hover:text-rose-800" onClick={() => hapusBaris(i)}>
                      Hapus
                    </button>
                  )}
                </div>
                <Bidang label="Nama layanan" htmlFor={`inv-b-${i}-deskripsi`}>
                  <Input id={`inv-b-${i}-deskripsi`} value={b.deskripsi} maxLength={150} onChange={(e) => ubahBaris(i, { deskripsi: e.target.value })} />
                </Bidang>
                <Bidang label="Keterangan (opsional)" htmlFor={`inv-b-${i}-detail`}>
                  <Input id={`inv-b-${i}-detail`} value={b.detail} maxLength={400} onChange={(e) => ubahBaris(i, { detail: e.target.value })} />
                </Bidang>
                <div className="grid grid-cols-[5rem_5.5rem_1fr] gap-2">
                  <Bidang label="Jumlah" htmlFor={`inv-b-${i}-jumlah`}>
                    <Input id={`inv-b-${i}-jumlah`} type="number" min={0} step="any" value={b.jumlah} onChange={(e) => ubahBaris(i, { jumlah: e.target.value })} />
                  </Bidang>
                  <Bidang label="Satuan" htmlFor={`inv-b-${i}-satuan`}>
                    <Input id={`inv-b-${i}-satuan`} value={b.satuan} maxLength={24} onChange={(e) => ubahBaris(i, { satuan: e.target.value })} />
                  </Bidang>
                  <Bidang label="Harga satuan (Rp)" htmlFor={`inv-b-${i}-harga`}>
                    <Input id={`inv-b-${i}-harga`} type="number" min={0} step={1000} value={b.harga} onChange={(e) => ubahBaris(i, { harga: e.target.value })} />
                  </Bidang>
                </div>
                <p className="text-xs text-slate-500" data-subtotal-baris>
                  Subtotal baris: <span className="font-semibold text-slate-800">{rupiahRingkas(hitung.baris[i]?.subtotal ?? 0)}</span>
                </p>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={tambahBaris} disabled={banyakBaris >= 30} className="w-fit">
              + Tambah baris
            </Button>
          </Bagian>

          <Bagian judul="Pajak">
            <div className="grid grid-cols-1 items-end gap-3 min-[420px]:grid-cols-2">
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-800" htmlFor="inv-pajak-aktif">
                <input id="inv-pajak-aktif" type="checkbox" checked={form.pajak.aktif} onChange={(e) => ubah((f) => ({ ...f, pajak: { ...f.pajak, aktif: e.target.checked } }))} />
                Kenakan PPN
              </label>
              <Bidang label="Tarif (%)" htmlFor="inv-pajak-persen">
                <Input id="inv-pajak-persen" type="number" min={0} max={100} step="0.01" value={form.pajak.persen} disabled={!form.pajak.aktif} onChange={(e) => ubah((f) => ({ ...f, pajak: { ...f.pajak, persen: e.target.value } }))} />
              </Bidang>
            </div>
          </Bagian>

          <Bagian judul="Pembayaran">
            <Bidang label="Bank" htmlFor="inv-bank">
              <Input id="inv-bank" value={form.pembayaran.bank} maxLength={60} onChange={(e) => ubah((f) => ({ ...f, pembayaran: { ...f.pembayaran, bank: e.target.value } }))} />
            </Bidang>
            <Bidang label="Nomor rekening" htmlFor="inv-rekening">
              <Input id="inv-rekening" value={form.pembayaran.rekening} maxLength={60} onChange={(e) => ubah((f) => ({ ...f, pembayaran: { ...f.pembayaran, rekening: e.target.value } }))} />
            </Bidang>
            <Bidang label="Atas nama" htmlFor="inv-atasnama" petunjuk="Kosongkan bank, nomor rekening, dan atas nama bila kotak transfer tidak perlu dicetak.">
              <Input id="inv-atasnama" value={form.pembayaran.atasNama} maxLength={100} onChange={(e) => ubah((f) => ({ ...f, pembayaran: { ...f.pembayaran, atasNama: e.target.value } }))} />
            </Bidang>
            <Bidang label="Catatan" htmlFor="inv-catatan">
              <textarea id="inv-catatan" rows={3} maxLength={600} className={kelasInput} value={form.pembayaran.catatan} onChange={(e) => ubah((f) => ({ ...f, pembayaran: { ...f.pembayaran, catatan: e.target.value } }))} />
            </Bidang>
          </Bagian>

          <Bagian judul="Pengesahan">
            <Bidang label="Kota" htmlFor="inv-kota">
              <Input id="inv-kota" value={form.pengesahan.kota} maxLength={60} onChange={(e) => ubah((f) => ({ ...f, pengesahan: { ...f.pengesahan, kota: e.target.value } }))} />
            </Bidang>
            <Bidang label="Nama penanda tangan" htmlFor="inv-ttd-nama">
              <Input id="inv-ttd-nama" value={form.pengesahan.nama} maxLength={120} onChange={(e) => ubah((f) => ({ ...f, pengesahan: { ...f.pengesahan, nama: e.target.value } }))} />
            </Bidang>
            <Bidang label="Jabatan" htmlFor="inv-ttd-jabatan">
              <Input id="inv-ttd-jabatan" value={form.pengesahan.jabatan} maxLength={120} onChange={(e) => ubah((f) => ({ ...f, pengesahan: { ...f.pengesahan, jabatan: e.target.value } }))} />
            </Bidang>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <Bidang label="Tanda tangan" htmlFor="inv-ttd-mode">
                <select id="inv-ttd-mode" className={kelasInput} value={form.pengesahan.tandaTangan ? "on" : "off"} onChange={(e) => ubah((f) => ({ ...f, pengesahan: { ...f.pengesahan, tandaTangan: e.target.value === "on" } }))}>
                  <option value="on">Langsung dibubuhkan</option>
                  <option value="off">Dikosongkan</option>
                </select>
              </Bidang>
              <Bidang label="Stempel" htmlFor="inv-stempel-mode">
                <select id="inv-stempel-mode" className={kelasInput} value={form.pengesahan.stempel ? "on" : "off"} onChange={(e) => ubah((f) => ({ ...f, pengesahan: { ...f.pengesahan, stempel: e.target.value === "on" } }))}>
                  <option value="on">Langsung dibubuhkan</option>
                  <option value="off">Dikosongkan</option>
                </select>
              </Bidang>
            </div>
            <p className="text-xs text-slate-500">Pilih &quot;Dikosongkan&quot; bila invoice akan ditandatangani dan distempel basah setelah dicetak.</p>
          </Bagian>
        </Card>

        <div className="flex flex-col gap-4 lg:sticky lg:top-20">
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-slate-500">Total tagihan</p>
                <p className="text-xl font-bold text-slate-900" data-total-invoice>
                  {rupiahRingkas(hitung.total)}
                </p>
                {form.pajak.aktif && (
                  <p className="text-xs text-slate-500">
                    Subtotal {rupiahRingkas(hitung.subtotal)} + PPN {rupiahRingkas(hitung.pajak)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => void unduhDraf()} disabled={!pratinjauSiap || sibuk !== null} data-aksi="unduh-draf">
                  {sibuk === "draf" ? "Mengunduh..." : "Unduh draf"}
                </Button>
                <Button type="button" onClick={() => setKonfirmasi(true)} disabled={!pratinjauSiap || sibuk !== null || adaGalatNomor} data-aksi="terbitkan">
                  Terbitkan &amp; unduh PDF
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              <b>Terbitkan</b> mencatat nomor invoice (tidak bisa dipakai lagi) lalu mengunduh PDF-nya. <b>Unduh draf</b> tidak mencatat apa pun.
            </p>

            {konfirmasi && (
              <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alertdialog" aria-label="Konfirmasi penerbitan invoice" data-konfirmasi-terbit>
                <p>
                  Terbitkan invoice <b className="font-mono">{nomorLengkap}</b> untuk <b>{form.penerima.nama || "-"}</b> senilai <b>{rupiahRingkas(hitung.total)}</b>? Nomor ini akan dicatat dan tidak bisa dipakai invoice lain.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void terbitkan()} disabled={sibuk !== null} data-aksi="konfirmasi-terbit">
                    {sibuk === "terbit" ? "Menerbitkan..." : "Ya, terbitkan"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setKonfirmasi(false)} disabled={sibuk !== null}>
                    Batal
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-3 p-3 sm:p-4" data-pratinjau-invoice>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Pratinjau PDF</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {pratinjau.tahap === "memuat" && <span data-status-pratinjau="memuat">Memperbarui...</span>}
                {pratinjau.url && (
                  <a href={pratinjau.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:text-indigo-800">
                    Buka di tab baru
                  </a>
                )}
              </div>
            </div>
            {pratinjau.tahap === "galat" && pratinjau.pesan && (
              <Alert variant="warning" role="status" data-galat-pratinjau>
                {pratinjau.pesan}
              </Alert>
            )}
            {pratinjau.url ? (
              <iframe
                title="Pratinjau invoice"
                src={`${pratinjau.url}#toolbar=0&navpanes=0&view=FitH`}
                className={`h-[70vh] min-h-[28rem] w-full rounded-lg lg:h-[calc(100vh-22rem)] lg:min-h-[24rem] border border-slate-200 bg-slate-100 transition-opacity ${pratinjau.tahap === "memuat" || pratinjau.tahap === "galat" ? "opacity-60" : ""}`}
                data-iframe-pratinjau
              />
            ) : (
              <div className="flex h-[28rem] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
                {pratinjau.tahap === "galat" ? "Lengkapi isian di kiri untuk melihat pratinjau." : "Menyiapkan pratinjau..."}
              </div>
            )}
            <p className="text-xs text-slate-500">Pratinjau ini PDF yang sama dengan yang diunduh. Sebagian peramban HP tidak bisa menampilkannya di sini; pakai &quot;Buka di tab baru&quot;.</p>
          </Card>
        </div>
      </div>

      <Card className="flex flex-col gap-3" data-riwayat-invoice>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Riwayat invoice yang diterbitkan</h2>
          <p className="text-xs text-slate-500">Menampilkan {riwayat ? `${riwayat.length} invoice terbaru` : "..."}. Invoice sekolah dari halaman Sekolah tidak termasuk di sini.</p>
        </div>
        {galatRiwayat && <Alert variant="danger">{galatRiwayat}</Alert>}
        {riwayat && riwayat.length === 0 && <p className="text-sm text-slate-500">Belum ada invoice yang diterbitkan dari pembuat ini.</p>}
        {riwayat && riwayat.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Nomor</th>
                  <th className="py-2 pr-3 font-semibold">Penerima</th>
                  <th className="py-2 pr-3 text-right font-semibold">Total</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Terbit</th>
                  <th className="py-2 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 align-top" data-baris-riwayat>
                    <td className="py-2 pr-3 font-mono text-xs font-semibold text-slate-800">{r.nomorInvoice}</td>
                    <td className="py-2 pr-3 text-slate-800">{r.penerima}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-800">Rp{angkaRibuan(r.totalAmount)}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={r.status === "lunas" ? "success" : r.status === "dibatalkan" ? "danger" : "warning"}>
                        {r.status === "lunas" ? "Lunas" : r.status === "dibatalkan" ? "Dibatalkan" : "Belum dibayar"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-600">{formatWIBDate(r.tanggalInvoice)}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-3 text-xs font-medium">
                        <a href={`/api/admin-pusat/invoice-bebas/${r.id}/pdf`} className="text-indigo-600 hover:text-indigo-800" data-aksi="unduh-ulang">
                          Unduh PDF
                        </a>
                        <button type="button" className="text-slate-600 hover:text-slate-900" onClick={() => void pakaiSebagaiDasar(r.id)} data-aksi="pakai-dasar">
                          Pakai sebagai dasar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
