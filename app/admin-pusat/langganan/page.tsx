"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import { useDialog } from "@/components/ui/dialog";

type PlanFitur = { aiKuotaPerMapel: number; tryOutNasionalKuotaPerMapel: number };

type Plan = {
  id: string;
  kode: "monthly" | "semester";
  nama: string;
  harga: number;
  durasiHari: number | null;
  isActive: boolean;
  fitur: PlanFitur | null;
};

type BankAccount = {
  id: string;
  namaBank: string;
  nomorRekening: string;
  atasNama: string;
  isActive: boolean;
};

type VoucherTier = {
  id: string;
  minJumlah: number;
  diskonPersen: number;
  label: string;
};

const emptyPlanForm = {
  kode: "monthly" as "monthly" | "semester",
  nama: "",
  harga: "",
  durasiHari: "30",
  isActive: true,
  aiKuotaPerMapel: "1",
  tryOutNasionalKuotaPerMapel: "0",
};
const emptyBankForm = { namaBank: "", nomorRekening: "", atasNama: "" };
const emptyTierForm = { minJumlah: "", diskonPersen: "", label: "" };

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/**
 * Jalur A (siswa individu, dokumen rencana Bagian 3): admin pusat mengatur
 * harga & durasi plan monthly/semester yang dijual lewat Midtrans, plus
 * Rekening Tujuan yang dipakai untuk transfer manual Jalur B (sekolah).
 */
export default function LanggananSettingsPage() {
  const toast = useToast();
  const { confirm } = useDialog();
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

  const [fiturDrafts, setFiturDrafts] = useState<Record<string, PlanFitur>>({});
  const [savingFiturId, setSavingFiturId] = useState<string | null>(null);

  const [hargaLa, setHargaLa] = useState("");
  const [hargaLaSaving, setHargaLaSaving] = useState(false);
  const [hargaLaSaved, setHargaLaSaved] = useState(false);

  const [marginLa, setMarginLa] = useState("");
  const [marginLaSaving, setMarginLaSaving] = useState(false);
  const [marginLaSaved, setMarginLaSaved] = useState(false);

  const [tiers, setTiers] = useState<VoucherTier[] | null>(null);
  const [showTierForm, setShowTierForm] = useState(false);
  const [tierForm, setTierForm] = useState(emptyTierForm);
  const [tierError, setTierError] = useState<string | null>(null);
  const [tierSubmitting, setTierSubmitting] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [planRes, bankRes, walletRes, tierRes] = await Promise.all([
        fetch("/api/admin-pusat/plans"),
        fetch("/api/admin-pusat/bank-accounts"),
        fetch("/api/admin-pusat/wallet-settings"),
        fetch("/api/admin-pusat/voucher-price-tiers"),
      ]);
      const planData = await planRes.json().catch(() => null);
      const bankData = await bankRes.json().catch(() => null);
      const walletData = await walletRes.json().catch(() => null);
      const tierData = await tierRes.json().catch(() => null);
      if (!ignore) {
        if (planRes.ok) setPlans(planData.plans ?? []);
        if (bankRes.ok) setAccounts(bankData.bankAccounts ?? []);
        if (walletRes.ok) {
          setHargaLa(String(walletData.hargaLearningAnalytics));
          setMarginLa(String(walletData.marginLearningAnalyticsPersen ?? 20));
        }
        if (tierRes.ok) setTiers(tierData.tiers ?? []);
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
      body: JSON.stringify({
        kode: planForm.kode,
        nama: planForm.nama,
        harga: Number(planForm.harga),
        durasiHari: Number(planForm.durasiHari),
        isActive: planForm.isActive,
        fitur: {
          aiKuotaPerMapel: Number(planForm.aiKuotaPerMapel),
          tryOutNasionalKuotaPerMapel: Number(planForm.tryOutNasionalKuotaPerMapel),
        },
      }),
    });
    const data = await res.json().catch(() => null);
    setPlanSubmitting(false);
    if (!res.ok) {
      setPlanError(data?.error ?? "Gagal menyimpan plan.");
      return;
    }
    setPlanForm(emptyPlanForm);
    setShowPlanForm(false);
    setRefreshKey((k) => k + 1);
  }

  function fiturDraftFor(plan: Plan): PlanFitur {
    return fiturDrafts[plan.id] ?? plan.fitur ?? { aiKuotaPerMapel: 1, tryOutNasionalKuotaPerMapel: 0 };
  }

  async function handleSaveFitur(plan: Plan) {
    setSavingFiturId(plan.id);
    const fitur = fiturDraftFor(plan);
    const res = await fetch(`/api/admin-pusat/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fitur }),
    });
    setSavingFiturId(null);
    if (res.ok) {
      setFiturDrafts((prev) => {
        const next = { ...prev };
        delete next[plan.id];
        return next;
      });
      setRefreshKey((k) => k + 1);
    }
  }

  async function handleSaveHargaLa(e: FormEvent) {
    e.preventDefault();
    setHargaLaSaving(true);
    setHargaLaSaved(false);
    const res = await fetch("/api/admin-pusat/wallet-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hargaLearningAnalytics: Number(hargaLa) }),
    });
    setHargaLaSaving(false);
    if (res.ok) setHargaLaSaved(true);
  }

  async function handleSaveMarginLa(e: FormEvent) {
    e.preventDefault();
    setMarginLaSaving(true);
    setMarginLaSaved(false);
    const res = await fetch("/api/admin-pusat/wallet-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marginLearningAnalyticsPersen: Number(marginLa) }),
    });
    setMarginLaSaving(false);
    if (res.ok) setMarginLaSaved(true);
  }

  async function handleTierSubmit(e: FormEvent) {
    e.preventDefault();
    setTierError(null);
    setTierSubmitting(true);
    const res = await fetch("/api/admin-pusat/voucher-price-tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minJumlah: Number(tierForm.minJumlah),
        diskonPersen: Number(tierForm.diskonPersen),
        label: tierForm.label,
      }),
    });
    const data = await res.json().catch(() => null);
    setTierSubmitting(false);
    if (!res.ok) {
      setTierError(data?.error ?? "Gagal menyimpan tier.");
      return;
    }
    setTierForm(emptyTierForm);
    setShowTierForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDeleteTier(tier: VoucherTier) {
    const ok = await confirm({
      title: `Hapus tier "${tier.label}"?`,
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin-pusat/voucher-price-tiers/${tier.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) setRefreshKey((k) => k + 1);
    else toast.error(data?.error ?? "Gagal menghapus tier.");
  }

  async function togglePlanActive(plan: Plan) {
    await fetch(`/api/admin-pusat/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !plan.isActive }),
    });
    setRefreshKey((k) => k + 1);
  }

  async function handleDeletePlan(plan: Plan) {
    const ok = await confirm({
      title: `Hapus plan "${plan.nama}"?`,
      description: "Plan yang sudah dipakai invoice/entitlement tidak bisa dihapus.",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin-pusat/plans/${plan.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) setRefreshKey((k) => k + 1);
    else toast.error(data?.error ?? "Gagal menghapus plan.");
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
    const ok = await confirm({
      title: `Hapus rekening ${acc.namaBank} - ${acc.nomorRekening}?`,
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin-pusat/bank-accounts/${acc.id}`, { method: "DELETE" });
    if (res.ok) setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Paket & Rekening"
        description="Plan monthly/semester dijual ke siswa mandiri lewat Midtrans (Jalur A). Rekening tujuan dipakai untuk transfer manual sekolah (Jalur B)."
      />

      {/* ─── Plan Langganan ─── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Plan Langganan</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Harga &amp; durasi plan yang dijual siswa mandiri lewat Midtrans.
            </p>
          </div>
          <Button onClick={() => setShowPlanForm((v) => !v)}>{showPlanForm ? "Batal" : "Tambah plan"}</Button>
        </div>

        {showPlanForm && (
          <form
            onSubmit={handlePlanSubmit}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
          >
            {planError && <Alert variant="danger">{planError}</Alert>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="planKode">Jenis plan</Label>
                <select
                  id="planKode"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={planForm.kode}
                  onChange={(e) => setPlanForm({ ...planForm, kode: e.target.value as "monthly" | "semester" })}
                >
                  <option value="monthly">Bulanan</option>
                  <option value="semester">Semester</option>
                </select>
              </div>
              <div>
                <Label htmlFor="planNama">Nama plan</Label>
                <Input
                  id="planNama"
                  required
                  placeholder='mis. "Langganan Bulanan"'
                  value={planForm.nama}
                  onChange={(e) => setPlanForm({ ...planForm, nama: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="planHarga">Harga (Rp)</Label>
                <Input
                  id="planHarga"
                  type="number"
                  min={0}
                  required
                  placeholder="mis. 39000"
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
            </div>
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div>
                <Label htmlFor="planAiKuota">Jatah Learning Analytics / mapel</Label>
                <Input
                  id="planAiKuota"
                  type="number"
                  min={0}
                  required
                  value={planForm.aiKuotaPerMapel}
                  onChange={(e) => setPlanForm({ ...planForm, aiKuotaPerMapel: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="planNasionalKuota">Jatah Try Out Nasional / mapel</Label>
                <Input
                  id="planNasionalKuota"
                  type="number"
                  min={0}
                  required
                  value={planForm.tryOutNasionalKuotaPerMapel}
                  onChange={(e) => setPlanForm({ ...planForm, tryOutNasionalKuotaPerMapel: e.target.value })}
                />
              </div>
              <p className="col-span-2 text-xs text-slate-500">
                Berlaku per mata pelajaran, reset tiap kali langganan diperpanjang. 0 = tidak dapat Try Out Nasional sama sekali.
              </p>
            </div>
            <Button type="submit" disabled={planSubmitting} className="w-fit">
              {planSubmitting ? "Menyimpan..." : "Simpan plan"}
            </Button>
          </form>
        )}

        {plans === null && <TableSkeleton columns={5} />}
        {plans?.length === 0 && (
          <EmptyState
            icon={<IconWallet />}
            title="Belum ada plan"
            description="Buat plan dulu supaya siswa mandiri bisa checkout. Contoh: Rp39.000/bulan."
            action={<Button onClick={() => setShowPlanForm(true)}>Tambah plan</Button>}
          />
        )}
        {plans && plans.length > 0 && (
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Nama Plan</Th>
                  <Th>Jenis</Th>
                  <Th>Harga</Th>
                  <Th>Durasi</Th>
                  <Th>Jatah LA / mapel</Th>
                  <Th>Jatah Try Out Nasional / mapel</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <tbody>
                {plans.map((p) => {
                  const draft = fiturDraftFor(p);
                  const isDirty = fiturDrafts[p.id] !== undefined;
                  return (
                  <Tr key={p.id}>
                    <Td className="font-medium text-slate-900">{p.nama}</Td>
                    <Td className="capitalize">{p.kode}</Td>
                    <Td className="font-semibold text-indigo-700">{formatRupiah(p.harga)}</Td>
                    <Td>{p.durasiHari ? `${p.durasiHari} hari` : "-"}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          className="w-16"
                          value={draft.aiKuotaPerMapel}
                          onChange={(e) =>
                            setFiturDrafts({
                              ...fiturDrafts,
                              [p.id]: { ...draft, aiKuotaPerMapel: Number(e.target.value) },
                            })
                          }
                        />
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          className="w-16"
                          value={draft.tryOutNasionalKuotaPerMapel}
                          onChange={(e) =>
                            setFiturDrafts({
                              ...fiturDrafts,
                              [p.id]: { ...draft, tryOutNasionalKuotaPerMapel: Number(e.target.value) },
                            })
                          }
                        />
                        {isDirty && (
                          <button
                            onClick={() => handleSaveFitur(p)}
                            disabled={savingFiturId === p.id}
                            className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                          >
                            {savingFiturId === p.id ? "..." : "Simpan"}
                          </button>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <Badge variant={p.isActive ? "success" : "neutral"}>
                        {p.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => togglePlanActive(p)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          onClick={() => handleDeletePlan(p)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                        >
                          Hapus
                        </button>
                      </div>
                    </Td>
                  </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableContainer>
        )}
      </section>

      {/* ─── Harga Learning Analytics ─── */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Harga Learning Analytics Tambahan</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Harga jual satu Learning Analytics tambahan (didebit dari saldo wallet siswa) begitu jatah gratis
            dari plan sudah habis.
          </p>
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <form onSubmit={handleSaveHargaLa} className="flex items-end gap-3">
            <div>
              <Label htmlFor="hargaLa">Harga Dasar (Rp)</Label>
              <Input
                id="hargaLa"
                type="number"
                min={0}
                required
                className="w-40"
                value={hargaLa}
                onChange={(e) => {
                  setHargaLa(e.target.value);
                  setHargaLaSaved(false);
                }}
              />
            </div>
            <Button type="submit" disabled={hargaLaSaving}>
              {hargaLaSaving ? "Menyimpan..." : "Simpan"}
            </Button>
            {hargaLaSaved && <span className="text-sm text-emerald-600">Tersimpan.</span>}
          </form>
          <form onSubmit={handleSaveMarginLa} className="flex items-end gap-3">
            <div>
              <Label htmlFor="marginLa">Margin Keuntungan (%)</Label>
              <Input
                id="marginLa"
                type="number"
                min={0}
                max={100}
                required
                className="w-24"
                value={marginLa}
                onChange={(e) => {
                  setMarginLa(e.target.value);
                  setMarginLaSaved(false);
                }}
              />
            </div>
            <Button type="submit" disabled={marginLaSaving}>
              {marginLaSaving ? "Menyimpan..." : "Simpan margin"}
            </Button>
            {marginLaSaved && <span className="text-sm text-emerald-600">Tersimpan.</span>}
          </form>
          {hargaLa && marginLa && (
            <p className="text-sm text-slate-500">
              Harga akhir ke siswa:{" "}
              <strong className="text-slate-800">
                Rp{Math.ceil((Number(hargaLa) * (1 + Number(marginLa) / 100)) / 100) * 100 || 0}
              </strong>{" "}
              (harga dasar + {marginLa}% margin)
            </p>
          )}
        </div>
      </section>

      {/* ─── Diskon Grosir Mitra ─── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Diskon Grosir Mitra</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Skema diskon otomatis saat mitra membeli voucher dalam jumlah besar. Dihitung dari tier
              dengan jumlah minimum tertinggi yang terpenuhi.
            </p>
          </div>
          <Button onClick={() => setShowTierForm((v) => !v)}>{showTierForm ? "Batal" : "Tambah tier"}</Button>
        </div>

        {showTierForm && (
          <form
            onSubmit={handleTierSubmit}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
          >
            {tierError && <Alert variant="danger">{tierError}</Alert>}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="tierMin">Jumlah minimum (voucher)</Label>
                <Input
                  id="tierMin"
                  type="number"
                  min={1}
                  required
                  placeholder="mis. 10"
                  value={tierForm.minJumlah}
                  onChange={(e) => setTierForm({ ...tierForm, minJumlah: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="tierDiskon">Diskon (%)</Label>
                <Input
                  id="tierDiskon"
                  type="number"
                  min={1}
                  max={100}
                  required
                  placeholder="mis. 25"
                  value={tierForm.diskonPersen}
                  onChange={(e) => setTierForm({ ...tierForm, diskonPersen: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="tierLabel">Label (tampil ke mitra)</Label>
                <Input
                  id="tierLabel"
                  required
                  placeholder='mis. "10-49 siswa"'
                  value={tierForm.label}
                  onChange={(e) => setTierForm({ ...tierForm, label: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" disabled={tierSubmitting} className="w-fit">
              {tierSubmitting ? "Menyimpan..." : "Simpan tier"}
            </Button>
          </form>
        )}

        {tiers === null && <TableSkeleton columns={4} />}
        {tiers?.length === 0 && (
          <EmptyState
            icon={<IconWallet />}
            title="Belum ada tier diskon"
            description="Tambah tier diskon agar mitra mendapat harga grosir saat membeli voucher dalam jumlah besar."
            action={<Button onClick={() => setShowTierForm(true)}>Tambah tier</Button>}
          />
        )}
        {tiers && tiers.length > 0 && (
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Label</Th>
                  <Th>Min. Voucher</Th>
                  <Th>Diskon</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <tbody>
                {tiers.sort((a, b) => a.minJumlah - b.minJumlah).map((tier) => (
                  <Tr key={tier.id}>
                    <Td className="font-medium text-slate-900">{tier.label}</Td>
                    <Td>≥ {tier.minJumlah} voucher</Td>
                    <Td>
                      <span className="font-semibold text-emerald-700">{tier.diskonPersen}%</span>
                    </Td>
                    <Td className="text-right">
                      <button
                        onClick={() => handleDeleteTier(tier)}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                      >
                        Hapus
                      </button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        )}
      </section>

      {/* ─── Rekening Tujuan ─── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Rekening Tujuan</h2>
          <Button onClick={() => setShowBankForm((v) => !v)}>{showBankForm ? "Batal" : "Tambah rekening"}</Button>
        </div>
        <p className="-mt-2 text-sm text-slate-500">
          Dipakai untuk transfer manual sekolah (Jalur B) - diberikan langsung ke sekolah, bukan ditampilkan
          otomatis di aplikasi siswa.
        </p>

        {showBankForm && (
          <form
            onSubmit={handleBankSubmit}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
          >
            {bankError && <Alert variant="danger">{bankError}</Alert>}
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

        {accounts === null && <TableSkeleton columns={5} />}
        {accounts?.length === 0 && (
          <EmptyState
            icon={<IconWallet />}
            title="Belum ada rekening"
            description="Tambah rekening tujuan untuk transfer manual sekolah."
            action={<Button onClick={() => setShowBankForm(true)}>Tambah rekening</Button>}
          />
        )}
        {accounts && accounts.length > 0 && (
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Bank</Th>
                  <Th>Nomor rekening</Th>
                  <Th>Atas nama</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <tbody>
                {accounts.map((acc) => (
                  <Tr key={acc.id}>
                    <Td className="font-medium text-slate-900">{acc.namaBank}</Td>
                    <Td className="font-mono">{acc.nomorRekening}</Td>
                    <Td>{acc.atasNama}</Td>
                    <Td>
                      <Badge variant={acc.isActive ? "success" : "neutral"}>
                        {acc.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => toggleBankActive(acc)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          {acc.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          onClick={() => handleDeleteBank(acc)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                        >
                          Hapus
                        </button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        )}
      </section>
    </div>
  );
}
