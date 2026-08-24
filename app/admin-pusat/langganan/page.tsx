"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

type Plan = {
  id: string;
  nama: string;
  target: "sekolah" | "siswa";
  harga: number;
  durasiHari: number;
  kuota: number | null;
};

type BankAccount = {
  id: string;
  namaBank: string;
  nomorRekening: string;
  atasNama: string;
  isActive: boolean;
};

const emptyPlanForm = { nama: "", target: "siswa" as "sekolah" | "siswa", harga: "", durasiHari: "", kuota: "" };
const emptyBankForm = { namaBank: "", nomorRekening: "", atasNama: "" };

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/** Pengaturan dasar Fase 6: paket langganan (belum ada tiket eksplisit, tapi dibutuhkan tiket 6.3/6.4/6.8) + rekening tujuan (Tiket 6.2). */
export default function LanggananSettingsPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planSubmitting, setPlanSubmitting] = useState(false);

  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState(emptyBankForm);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankSubmitting, setBankSubmitting] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [planRes, bankRes] = await Promise.all([
        fetch("/api/admin-pusat/plans"),
        fetch("/api/admin-pusat/bank-accounts"),
      ]);
      const planData = await planRes.json().catch(() => null);
      const bankData = await bankRes.json().catch(() => null);
      if (!ignore) {
        if (planRes.ok) setPlans(planData.plans ?? []);
        if (bankRes.ok) setAccounts(bankData.bankAccounts ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  async function handlePlanSubmit(e: FormEvent) {
    e.preventDefault();
    setPlanError(null);
    setPlanSubmitting(true);
    const res = await fetch("/api/admin-pusat/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planForm),
    });
    const data = await res.json().catch(() => null);
    setPlanSubmitting(false);
    if (!res.ok) {
      setPlanError(data?.error ?? "Gagal menyimpan paket.");
      return;
    }
    setPlanForm(emptyPlanForm);
    setShowPlanForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDeletePlan(plan: Plan) {
    if (!window.confirm(`Hapus paket "${plan.nama}"?`)) return;
    const res = await fetch(`/api/admin-pusat/plans/${plan.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) setRefreshKey((k) => k + 1);
    else alert(data?.error ?? "Gagal menghapus paket.");
  }

  async function handleBankSubmit(e: FormEvent) {
    e.preventDefault();
    setBankError(null);
    setBankSubmitting(true);
    const res = await fetch("/api/admin-pusat/bank-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bankForm),
    });
    const data = await res.json().catch(() => null);
    setBankSubmitting(false);
    if (!res.ok) {
      setBankError(data?.error ?? "Gagal menyimpan rekening.");
      return;
    }
    setBankForm(emptyBankForm);
    setShowBankForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function toggleBankActive(acc: BankAccount) {
    await fetch(`/api/admin-pusat/bank-accounts/${acc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !acc.isActive }),
    });
    setRefreshKey((k) => k + 1);
  }

  async function handleDeleteBank(acc: BankAccount) {
    if (!window.confirm(`Hapus rekening ${acc.namaBank} - ${acc.nomorRekening}?`)) return;
    const res = await fetch(`/api/admin-pusat/bank-accounts/${acc.id}`, { method: "DELETE" });
    if (res.ok) setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Pengaturan Langganan</h1>
        <p className="text-sm text-slate-500">Paket langganan & rekening tujuan pembayaran manual.</p>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Paket Langganan</h2>
          <Button onClick={() => setShowPlanForm((v) => !v)}>{showPlanForm ? "Batal" : "Tambah paket"}</Button>
        </div>

        {showPlanForm && (
          <form
            onSubmit={handlePlanSubmit}
            className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
          >
            {planError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{planError}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="planNama">Nama paket</Label>
                <Input
                  id="planNama"
                  required
                  placeholder='mis. "Bulanan Siswa"'
                  value={planForm.nama}
                  onChange={(e) => setPlanForm({ ...planForm, nama: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="planTarget">Untuk</Label>
                <select
                  id="planTarget"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={planForm.target}
                  onChange={(e) => setPlanForm({ ...planForm, target: e.target.value as "sekolah" | "siswa" })}
                >
                  <option value="siswa">Siswa mandiri</option>
                  <option value="sekolah">Sekolah</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="planHarga">Harga (Rp)</Label>
                <Input
                  id="planHarga"
                  type="number"
                  min={0}
                  required
                  value={planForm.harga}
                  onChange={(e) => setPlanForm({ ...planForm, harga: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="planDurasi">Durasi (hari)</Label>
                <Input
                  id="planDurasi"
                  type="number"
                  min={1}
                  required
                  placeholder="30"
                  value={planForm.durasiHari}
                  onChange={(e) => setPlanForm({ ...planForm, durasiHari: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="planKuota">Kuota (opsional)</Label>
                <Input
                  id="planKuota"
                  type="number"
                  min={1}
                  placeholder="mis. kuota siswa sekolah"
                  value={planForm.kuota}
                  onChange={(e) => setPlanForm({ ...planForm, kuota: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" disabled={planSubmitting} className="w-fit">
              {planSubmitting ? "Menyimpan..." : "Simpan paket"}
            </Button>
          </form>
        )}

        {plans === null && <p className="text-sm text-slate-500">Memuat...</p>}
        {plans?.length === 0 && (
          <EmptyState
            title="Belum ada paket langganan"
            description="Buat paket dulu supaya siswa mandiri bisa checkout dan sekolah bisa dipasangkan langganan."
            action={<Button onClick={() => setShowPlanForm(true)}>Tambah paket</Button>}
          />
        )}
        {plans && plans.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Nama</th>
                  <th className="px-4 py-2 font-medium">Untuk</th>
                  <th className="px-4 py-2 font-medium">Harga</th>
                  <th className="px-4 py-2 font-medium">Durasi</th>
                  <th className="px-4 py-2 font-medium">Kuota</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-900">{p.nama}</td>
                    <td className="px-4 py-2 capitalize">{p.target}</td>
                    <td className="px-4 py-2">{formatRupiah(p.harga)}</td>
                    <td className="px-4 py-2">{p.durasiHari} hari</td>
                    <td className="px-4 py-2">{p.kuota ?? "-"}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleDeletePlan(p)}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Rekening Tujuan</h2>
          <Button onClick={() => setShowBankForm((v) => !v)}>{showBankForm ? "Batal" : "Tambah rekening"}</Button>
        </div>
        <p className="-mt-2 text-sm text-slate-500">
          Ditampilkan ke siswa mandiri saat checkout. Hanya rekening aktif yang terlihat siswa.
        </p>

        {showBankForm && (
          <form
            onSubmit={handleBankSubmit}
            className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
          >
            {bankError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{bankError}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="namaBank">Nama bank</Label>
                <Input
                  id="namaBank"
                  required
                  placeholder="mis. BCA"
                  value={bankForm.namaBank}
                  onChange={(e) => setBankForm({ ...bankForm, namaBank: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="nomorRekening">Nomor rekening</Label>
                <Input
                  id="nomorRekening"
                  required
                  value={bankForm.nomorRekening}
                  onChange={(e) => setBankForm({ ...bankForm, nomorRekening: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="atasNama">Atas nama</Label>
              <Input
                id="atasNama"
                required
                value={bankForm.atasNama}
                onChange={(e) => setBankForm({ ...bankForm, atasNama: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={bankSubmitting} className="w-fit">
              {bankSubmitting ? "Menyimpan..." : "Simpan rekening"}
            </Button>
          </form>
        )}

        {accounts === null && <p className="text-sm text-slate-500">Memuat...</p>}
        {accounts?.length === 0 && (
          <EmptyState
            title="Belum ada rekening"
            description="Tambah rekening tujuan supaya siswa mandiri bisa transfer pembayaran."
            action={<Button onClick={() => setShowBankForm(true)}>Tambah rekening</Button>}
          />
        )}
        {accounts && accounts.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Bank</th>
                  <th className="px-4 py-2 font-medium">Nomor rekening</th>
                  <th className="px-4 py-2 font-medium">Atas nama</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-900">{acc.namaBank}</td>
                    <td className="px-4 py-2 font-mono">{acc.nomorRekening}</td>
                    <td className="px-4 py-2">{acc.atasNama}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          acc.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {acc.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => toggleBankActive(acc)}
                          className="text-sm font-medium text-slate-600 hover:text-slate-900"
                        >
                          {acc.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          onClick={() => handleDeleteBank(acc)}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
