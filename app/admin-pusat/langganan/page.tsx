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

type Plan = {
  id: string;
  kode: "monthly" | "semester";
  nama: string;
  harga: number;
  durasiHari: number | null;
  isActive: boolean;
};

type BankAccount = {
  id: string;
  namaBank: string;
  nomorRekening: string;
  atasNama: string;
  isActive: boolean;
};

const emptyPlanForm = { kode: "monthly" as "monthly" | "semester", nama: "", harga: "", durasiHari: "30", isActive: true };
const emptyBankForm = { namaBank: "", nomorRekening: "", atasNama: "" };

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
      body: JSON.stringify({
        kode: planForm.kode,
        nama: planForm.nama,
        harga: Number(planForm.harga),
        durasiHari: Number(planForm.durasiHari),
        isActive: planForm.isActive,
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
                  <Th>Status</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <tbody>
                {plans.map((p) => (
                  <Tr key={p.id}>
                    <Td className="font-medium text-slate-900">{p.nama}</Td>
                    <Td className="capitalize">{p.kode}</Td>
                    <Td className="font-semibold text-indigo-700">{formatRupiah(p.harga)}</Td>
                    <Td>{p.durasiHari ? `${p.durasiHari} hari` : "-"}</Td>
                    <Td>
                      <Badge variant={p.isActive ? "success" : "neutral"}>
                        {p.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => togglePlanActive(p)}
                          className="text-sm font-medium text-slate-600 hover:text-slate-900"
                        >
                          {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          onClick={() => handleDeletePlan(p)}
                          className="text-sm font-medium text-rose-600 hover:underline"
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
                          className="text-sm font-medium text-slate-600 hover:text-slate-900"
                        >
                          {acc.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          onClick={() => handleDeleteBank(acc)}
                          className="text-sm font-medium text-rose-600 hover:underline"
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
