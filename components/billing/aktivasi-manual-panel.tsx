"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatWIBDate } from "@/lib/utils/datetime";
import { SALDO_TOPUP_DENOMINASI } from "@/lib/validations/saldo";

type SiswaHasil = {
  id: string;
  nama: string;
  jenjang: string;
  jalur: "A" | "B";
  /** Nama sekolah (hanya siswa Jalur A). */
  sekolah: string | null;
  alumni: boolean;
  /** Jalur A yang kursi sekolahnya berlaku sekarang: paket pribadi baru ditunda otomatis sampai tanggungan sekolah selesai. */
  ditanggungSekolah: boolean;
  email: string | null;
  saldo: number;
  langgananAktifSampai: string | null;
};
type PlanOpsi = { id: string; nama: string; harga: number; durasiHari: number | null };

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/**
 * Aktivasi manual setelah siswa membayar lewat tautan affiliate.id dan mengirim
 * bukti via WhatsApp (lib/billing/pembayaran-affiliate.ts): admin mencari
 * siswa, memilih langganan atau top-up saldo, mengisi catatan bukti, lalu
 * mengonfirmasi - akses/saldo siswa langsung aktif.
 */
export function AktivasiManualPanel() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [mencari, setMencari] = useState(false);
  const [hasil, setHasil] = useState<SiswaHasil[] | null>(null);
  const [terpilihId, setTerpilihId] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanOpsi[]>([]);
  const [tipe, setTipe] = useState<"langganan" | "topup">("langganan");
  const [planId, setPlanId] = useState("");
  const [nominal, setNominal] = useState<number>(SALDO_TOPUP_DENOMINASI[0]);
  const [catatan, setCatatan] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/plans");
      const data = await res.json().catch(() => null);
      if (ignore || !res.ok) return;
      const daftar: PlanOpsi[] = data?.plans ?? [];
      setPlans(daftar);
      setPlanId((cur) => cur || daftar[0]?.id || "");
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const terpilih = hasil?.find((s) => s.id === terpilihId) ?? null;

  async function cari(keyword: string) {
    setMencari(true);
    const res = await fetch(`/api/admin-pusat/aktivasi-manual?q=${encodeURIComponent(keyword)}`);
    const data = await res.json().catch(() => null);
    setMencari(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Gagal mencari siswa.");
      return;
    }
    setHasil(data.students ?? []);
  }

  function handleCari(e: FormEvent) {
    e.preventDefault();
    setTerpilihId(null);
    if (q.trim().length < 3) {
      toast.error("Ketik minimal 3 huruf nama, email, atau NISN siswa.");
      return;
    }
    void cari(q.trim());
  }

  async function handleKonfirmasi(e: FormEvent) {
    e.preventDefault();
    if (!terpilih) return;
    if (catatan.trim().length < 3) {
      toast.error("Catatan verifikasi wajib diisi.");
      return;
    }
    setSubmitting(true);
    const body =
      tipe === "langganan"
        ? { tipe, studentId: terpilih.id, planId, catatan }
        : { tipe, studentId: terpilih.id, nominal, catatan };
    const res = await fetch("/api/admin-pusat/aktivasi-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Gagal mengaktifkan.");
      return;
    }
    toast.success(
      data.tipe === "langganan"
        ? data.ditundaSampaiMulai
          ? `Langganan ${data.paket} untuk ${data.siswa} tercatat, tetapi ditunda karena sekolahnya masih menanggung: berlaku mulai ${formatWIBDate(data.ditundaSampaiMulai)} sampai ${formatWIBDate(data.berlakuSampai)}.`
          : `Langganan ${data.paket} aktif untuk ${data.siswa} sampai ${formatWIBDate(data.berlakuSampai)}.`
        : `Saldo ${data.siswa} bertambah ${formatRupiah(data.nominal)} (saldo sekarang ${formatRupiah(data.saldoBaru)}).`,
    );
    setCatatan("");
    void cari(q.trim()); // segarkan status & saldo siswa yang baru diaktifkan
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Aktivasi Manual (pembayaran via affiliate.id)</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Untuk siswa yang sudah membayar lewat tautan affiliate.id dan mengirim bukti ke WhatsApp - siswa mandiri,
          atau alumni/siswa sekolah yang lanjut belajar pribadi. Cocokkan dulu bukti pembayarannya, baru aktifkan di
          sini.
        </p>
      </div>

      <form onSubmit={handleCari} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="cari-siswa">Cari siswa (nama, email, atau NISN)</Label>
          <Input
            id="cari-siswa"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="mis. budi@gmail.com"
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={mencari} className="w-fit">
          {mencari ? "Mencari..." : "Cari"}
        </Button>
      </form>

      {hasil && hasil.length === 0 && (
        <p className="text-sm text-slate-500">Tidak ada siswa yang cocok.</p>
      )}

      {hasil && hasil.length > 0 && (
        <ul className="flex flex-col gap-2">
          {hasil.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setTerpilihId(s.id)}
                className={`flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  terpilihId === s.id
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span>
                  <span className="font-medium text-slate-900">{s.nama}</span>{" "}
                  <span className="text-xs text-slate-500">({s.jenjang})</span>
                  {s.jalur === "A" && (
                    <span className="ml-1.5 text-xs text-slate-500">
                      · {s.alumni ? "Alumni" : "Siswa"} {s.sekolah ?? "sekolah"}
                    </span>
                  )}
                  <br />
                  <span className="text-xs text-slate-500">{s.email ?? "tanpa email"}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  {s.ditanggungSekolah ? (
                    <Badge variant="neutral">Ditanggung sekolah</Badge>
                  ) : s.langgananAktifSampai ? (
                    <Badge variant="success">Aktif s.d. {formatWIBDate(s.langgananAktifSampai)}</Badge>
                  ) : (
                    <Badge variant="neutral">Belum berlangganan</Badge>
                  )}
                  <span className="text-slate-600">Saldo {formatRupiah(s.saldo)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {terpilih && (
        <form onSubmit={handleKonfirmasi} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <p className="text-sm font-medium text-slate-900">
            Aktivasi untuk: {terpilih.nama} <span className="text-slate-500">· {terpilih.email ?? "tanpa email"}</span>
          </p>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="tipe-aktivasi" checked={tipe === "langganan"} onChange={() => setTipe("langganan")} />
              Aktifkan langganan
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="tipe-aktivasi" checked={tipe === "topup"} onChange={() => setTipe("topup")} />
              Tambah saldo (top-up)
            </label>
          </div>

          {tipe === "langganan" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan-aktivasi">Paket</Label>
              <select
                id="plan-aktivasi"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} — {formatRupiah(p.harga)}
                    {p.durasiHari ? ` (${p.durasiHari} hari)` : ""}
                  </option>
                ))}
              </select>
              {terpilih.ditanggungSekolah && (
                <Alert variant="warning" className="text-xs">
                  Akses siswa ini sedang ditanggung sekolahnya{terpilih.sekolah ? ` (${terpilih.sekolah})` : ""}. Paket
                  pribadi tetap bisa dicatat (siswa sudah membayar), tetapi otomatis ditunda: berlaku setelah masa
                  tanggungan sekolah selesai, jadi harinya tidak terbuang.
                </Alert>
              )}
              {!terpilih.ditanggungSekolah && terpilih.langgananAktifSampai && (
                <Alert variant="warning" className="text-xs">
                  Siswa ini masih berlangganan sampai {formatWIBDate(terpilih.langgananAktifSampai)}. Masa aktif baru
                  ditambahkan setelah masa aktif sekarang habis (sisa hari tidak hangus).
                </Alert>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nominal-aktivasi">Nominal top-up</Label>
              <select
                id="nominal-aktivasi"
                value={nominal}
                onChange={(e) => setNominal(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {SALDO_TOPUP_DENOMINASI.map((n) => (
                  <option key={n} value={n}>
                    {formatRupiah(n)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="catatan-aktivasi">Catatan verifikasi (wajib)</Label>
            <Input
              id="catatan-aktivasi"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              required
              placeholder="mis. Bukti bayar dikirim via WA 1 Okt 14.02, pesanan affiliate.id #1234"
            />
          </div>

          <Button type="submit" disabled={submitting || (tipe === "langganan" && !planId)} className="w-fit">
            {submitting ? "Memproses..." : "Konfirmasi & aktifkan"}
          </Button>
        </form>
      )}
    </Card>
  );
}
