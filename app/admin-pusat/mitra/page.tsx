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

type Partner = {
  id: string;
  nama: string;
  kontak: string | null;
  email: string;
  referralCode: string;
  totalVoucher: number;
  voucherTerpakai: number;
  totalSekolahRujukan: number;
};

type Plan = { id: string; nama: string; harga: number };

type Voucher = {
  id: string;
  code: string;
  status: "unused" | "used" | "void";
  plan: { nama: string };
  partner: { nama: string };
};

type Commission = {
  id: string;
  amount: number | null;
  status: "pending" | "paid";
  note: string | null;
  partner: { id: string; nama: string };
  school: { id: string; nama: string };
};

type SchoolOption = { id: string; nama: string };

type PriceTier = { id: string; minJumlah: number; diskonPersen: number; label: string };

const emptyPartnerForm = { email: "", nama: "", kontak: "" };
const emptyCommissionForm = { partnerId: "", schoolId: "", note: "" };
const emptyTierForm = { minJumlah: "", diskonPersen: "", label: "" };

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/**
 * Jalur C (mitra/reseller, Bagian 5 & 6.5 dokumen rencana): admin pusat
 * membuat akun mitra + generate batch kode voucher per mitra. Dashboard
 * mitra sendiri (app/mitra/dashboard) hanya baca-saja dari data yang
 * dibuat di sini.
 */
export default function MitraPage() {
  const toast = useToast();
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [partnerForm, setPartnerForm] = useState(emptyPartnerForm);
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const [partnerSubmitting, setPartnerSubmitting] = useState(false);
  const [createdPartner, setCreatedPartner] = useState<{ email: string; tempPassword: string } | null>(null);

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [jumlah, setJumlah] = useState("10");
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherSubmitting, setVoucherSubmitting] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[] | null>(null);

  const [vouchers, setVouchers] = useState<Voucher[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [commissions, setCommissions] = useState<Commission[] | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [showCommissionForm, setShowCommissionForm] = useState(false);
  const [commissionForm, setCommissionForm] = useState(emptyCommissionForm);
  const [commissionError, setCommissionError] = useState<string | null>(null);
  const [commissionSubmitting, setCommissionSubmitting] = useState(false);
  const [savingCommissionId, setSavingCommissionId] = useState<string | null>(null);
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});

  const [tiers, setTiers] = useState<PriceTier[] | null>(null);
  const [showTierForm, setShowTierForm] = useState(false);
  const [tierForm, setTierForm] = useState(emptyTierForm);
  const [tierError, setTierError] = useState<string | null>(null);
  const [tierSubmitting, setTierSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [partnerRes, planRes, commissionRes, schoolRes, tierRes] = await Promise.all([
        fetch("/api/admin-pusat/partners"),
        fetch("/api/admin-pusat/plans"),
        fetch("/api/admin-pusat/partner-commissions"),
        fetch("/api/admin-pusat/schools"),
        fetch("/api/admin-pusat/voucher-price-tiers"),
      ]);
      const partnerData = await partnerRes.json().catch(() => null);
      const planData = await planRes.json().catch(() => null);
      const commissionData = await commissionRes.json().catch(() => null);
      const schoolData = await schoolRes.json().catch(() => null);
      const tierData = await tierRes.json().catch(() => null);
      if (!ignore) {
        if (commissionRes.ok) setCommissions(commissionData.commissions ?? []);
        if (schoolRes.ok) setSchools((schoolData.schools ?? []).map((s: SchoolOption) => ({ id: s.id, nama: s.nama })));
        if (partnerRes.ok) setPartners(partnerData.partners ?? []);
        if (planRes.ok) setPlans(planData.plans ?? []);
        if (tierRes.ok) setTiers(tierData.tiers ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!selectedPartnerId) {
        if (!ignore) setVouchers([]);
        return;
      }
      if (!ignore) setVouchers(null);
      const res = await fetch(`/api/admin-pusat/vouchers?partnerId=${selectedPartnerId}`);
      const data = await res.json().catch(() => null);
      if (!ignore) setVouchers(res.ok ? (data.vouchers ?? []) : []);
    })();
    return () => {
      ignore = true;
    };
  }, [selectedPartnerId, refreshKey]);

  async function handlePartnerSubmit(e: FormEvent) {
    e.preventDefault();
    setPartnerError(null);
    setPartnerSubmitting(true);
    const res = await fetch("/api/admin-pusat/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: partnerForm.email,
        nama: partnerForm.nama,
        kontak: partnerForm.kontak || undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    setPartnerSubmitting(false);
    if (!res.ok) {
      setPartnerError(data?.error ?? "Gagal membuat akun mitra.");
      return;
    }
    setCreatedPartner({ email: partnerForm.email, tempPassword: data.tempPassword });
    setPartnerForm(emptyPartnerForm);
    setShowPartnerForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleGenerateVouchers(e: FormEvent) {
    e.preventDefault();
    setVoucherError(null);
    setGeneratedCodes(null);
    if (!selectedPartnerId || !selectedPlanId) {
      setVoucherError("Pilih mitra dan plan terlebih dahulu.");
      return;
    }
    setVoucherSubmitting(true);
    const res = await fetch("/api/admin-pusat/vouchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId: selectedPartnerId, planId: selectedPlanId, jumlah: Number(jumlah) }),
    });
    const data = await res.json().catch(() => null);
    setVoucherSubmitting(false);
    if (!res.ok) {
      setVoucherError(data?.error ?? "Gagal membuat voucher.");
      return;
    }
    setGeneratedCodes(data.vouchers.map((v: Voucher) => v.code));
    setRefreshKey((k) => k + 1);
    toast.success(`${data.vouchers.length} kode voucher berhasil dibuat.`);
  }

  async function handleCreateCommission(e: FormEvent) {
    e.preventDefault();
    setCommissionError(null);
    if (!commissionForm.partnerId || !commissionForm.schoolId) {
      setCommissionError("Pilih mitra dan sekolah terlebih dahulu.");
      return;
    }
    setCommissionSubmitting(true);
    const res = await fetch("/api/admin-pusat/partner-commissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(commissionForm),
    });
    const data = await res.json().catch(() => null);
    setCommissionSubmitting(false);
    if (!res.ok) {
      setCommissionError(data?.error ?? "Gagal mencatat komisi.");
      return;
    }
    setCommissionForm(emptyCommissionForm);
    setShowCommissionForm(false);
    setRefreshKey((k) => k + 1);
    toast.success("Rujukan telat berhasil dicatat sebagai komisi pending.");
  }

  async function handleSetAmount(commission: Commission, rawAmount: string) {
    const amount = Number(rawAmount.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(amount) || amount < 0 || rawAmount.trim() === "") {
      toast.error("Nominal tidak valid.");
      return;
    }
    setSavingCommissionId(commission.id);
    const res = await fetch(`/api/admin-pusat/partner-commissions/${commission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json().catch(() => null);
    setSavingCommissionId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Gagal menyimpan nominal.");
      return;
    }
    setAmountDrafts((prev) => {
      const next = { ...prev };
      delete next[commission.id];
      return next;
    });
    setRefreshKey((k) => k + 1);
    toast.success("Nominal komisi disimpan.");
  }

  async function handleTierSubmit(e: FormEvent) {
    e.preventDefault();
    setTierError(null);
    setTierSubmitting(true);
    const res = await fetch("/api/admin-pusat/voucher-price-tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tierForm),
    });
    const data = await res.json().catch(() => null);
    setTierSubmitting(false);
    if (!res.ok) {
      setTierError(data?.error ?? "Gagal menyimpan tingkatan.");
      return;
    }
    setTierForm(emptyTierForm);
    setShowTierForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDeleteTier(tier: PriceTier) {
    if (!window.confirm(`Hapus tingkatan "${tier.label}"?`)) return;
    const res = await fetch(`/api/admin-pusat/voucher-price-tiers/${tier.id}`, { method: "DELETE" });
    if (res.ok) setRefreshKey((k) => k + 1);
    else toast.error("Gagal menghapus tingkatan.");
  }

  async function handleMarkPaid(commission: Commission) {
    setSavingCommissionId(commission.id);
    const res = await fetch(`/api/admin-pusat/partner-commissions/${commission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    const data = await res.json().catch(() => null);
    setSavingCommissionId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Gagal menandai lunas.");
      return;
    }
    setRefreshKey((k) => k + 1);
    toast.success("Komisi ditandai sudah dibayar.");
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Mitra & Voucher"
        description="Akun mitra/reseller (Jalur C) untuk generate & bagikan kode voucher ke siswa. Mitra tidak pernah melihat identitas siswa yang memakai vouchernya."
      />

      {/* ─── Daftar Mitra ─── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Akun Mitra</h2>
          <Button onClick={() => setShowPartnerForm((v) => !v)}>
            {showPartnerForm ? "Batal" : "Tambah mitra"}
          </Button>
        </div>

        {createdPartner && (
          <Alert variant="success">
            Akun mitra berhasil dibuat untuk <strong>{createdPartner.email}</strong>. Password
            sementara: <strong className="font-mono">{createdPartner.tempPassword}</strong> —
            sampaikan lewat jalur aman (bukan email), akun wajib ganti password saat login
            pertama. Password ini tidak akan ditampilkan lagi.
          </Alert>
        )}

        {showPartnerForm && (
          <form
            onSubmit={handlePartnerSubmit}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
          >
            {partnerError && <Alert variant="danger">{partnerError}</Alert>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="partnerNama">Nama mitra</Label>
                <Input
                  id="partnerNama"
                  required
                  value={partnerForm.nama}
                  onChange={(e) => setPartnerForm({ ...partnerForm, nama: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="partnerEmail">Email login</Label>
                <Input
                  id="partnerEmail"
                  type="email"
                  required
                  value={partnerForm.email}
                  onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="partnerKontak">Kontak (opsional)</Label>
              <Input
                id="partnerKontak"
                placeholder="mis. nomor WhatsApp"
                value={partnerForm.kontak}
                onChange={(e) => setPartnerForm({ ...partnerForm, kontak: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={partnerSubmitting} className="w-fit">
              {partnerSubmitting ? "Menyimpan..." : "Buat akun mitra"}
            </Button>
          </form>
        )}

        {partners === null && <TableSkeleton columns={5} />}
        {partners?.length === 0 && (
          <EmptyState
            icon={<IconWallet />}
            title="Belum ada mitra"
            description="Tambah akun mitra untuk mulai membagikan kode voucher."
            action={<Button onClick={() => setShowPartnerForm(true)}>Tambah mitra</Button>}
          />
        )}
        {partners && partners.length > 0 && (
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Nama</Th>
                  <Th>Email</Th>
                  <Th>Kode referral</Th>
                  <Th>Voucher</Th>
                  <Th>Sekolah rujukan</Th>
                </Tr>
              </Thead>
              <tbody>
                {partners.map((p) => (
                  <Tr
                    key={p.id}
                    className={p.id === selectedPartnerId ? "bg-indigo-50" : "cursor-pointer"}
                    onClick={() => setSelectedPartnerId(p.id)}
                  >
                    <Td className="font-medium text-slate-900">{p.nama}</Td>
                    <Td>{p.email}</Td>
                    <Td className="font-mono">{p.referralCode}</Td>
                    <Td>
                      {p.voucherTerpakai}/{p.totalVoucher} terpakai
                    </Td>
                    <Td>{p.totalSekolahRujukan}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        )}
      </section>

      {/* ─── Skema Diskon Voucher (Bagian A, permintaan user) ─── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Skema Diskon Voucher</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Diskon grosir yang otomatis diterapkan saat mitra beli voucher sendiri lewat Midtrans -
              diurutkan dari jumlah minimal terbesar saat dihitung, tidak perlu deploy ulang untuk mengubahnya.
            </p>
          </div>
          <Button onClick={() => setShowTierForm((v) => !v)}>{showTierForm ? "Batal" : "Tambah tingkatan"}</Button>
        </div>

        {showTierForm && (
          <form
            onSubmit={handleTierSubmit}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
          >
            {tierError && <Alert variant="danger">{tierError}</Alert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="tierMinJumlah">Jumlah minimal</Label>
                <Input
                  id="tierMinJumlah"
                  type="number"
                  min={1}
                  required
                  placeholder="mis. 2"
                  value={tierForm.minJumlah}
                  onChange={(e) => setTierForm({ ...tierForm, minJumlah: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="tierDiskon">Diskon (%)</Label>
                <Input
                  id="tierDiskon"
                  type="number"
                  min={0}
                  max={100}
                  required
                  placeholder="mis. 20"
                  value={tierForm.diskonPersen}
                  onChange={(e) => setTierForm({ ...tierForm, diskonPersen: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="tierLabel">Label</Label>
                <Input
                  id="tierLabel"
                  required
                  placeholder='mis. "2-9 voucher"'
                  value={tierForm.label}
                  onChange={(e) => setTierForm({ ...tierForm, label: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" disabled={tierSubmitting} className="w-fit">
              {tierSubmitting ? "Menyimpan..." : "Simpan tingkatan"}
            </Button>
          </form>
        )}

        {tiers === null && <TableSkeleton columns={4} />}
        {tiers?.length === 0 && (
          <EmptyState
            icon={<IconWallet />}
            title="Belum ada tingkatan diskon"
            description="Tanpa tingkatan, mitra beli voucher dengan harga penuh (0% diskon)."
            action={<Button onClick={() => setShowTierForm(true)}>Tambah tingkatan</Button>}
          />
        )}
        {tiers && tiers.length > 0 && (
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Label</Th>
                  <Th>Jumlah minimal</Th>
                  <Th>Diskon</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <tbody>
                {tiers
                  .slice()
                  .sort((a, b) => b.minJumlah - a.minJumlah)
                  .map((t) => (
                    <Tr key={t.id}>
                      <Td className="font-medium text-slate-900">{t.label}</Td>
                      <Td>{t.minJumlah}+</Td>
                      <Td className="font-semibold text-indigo-700">{t.diskonPersen}%</Td>
                      <Td className="text-right">
                        <button
                          onClick={() => handleDeleteTier(t)}
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

      {/* ─── Generate Voucher ─── */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Generate Voucher</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Pilih mitra (atau klik baris di tabel atas), lalu buat batch kode voucher untuk satu plan.
          </p>
        </div>

        <form
          onSubmit={handleGenerateVouchers}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          {voucherError && <Alert variant="danger">{voucherError}</Alert>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="voucherPartner">Mitra</Label>
              <select
                id="voucherPartner"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
              >
                <option value="">Pilih mitra</option>
                {partners?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="voucherPlan">Plan</Label>
              <select
                id="voucherPlan"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
              >
                <option value="">Pilih plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="voucherJumlah">Jumlah kode</Label>
              <Input
                id="voucherJumlah"
                type="number"
                min={1}
                max={500}
                required
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={voucherSubmitting} className="w-fit">
            {voucherSubmitting ? "Membuat..." : "Buat batch voucher"}
          </Button>
        </form>

        {generatedCodes && (
          <Alert variant="success">
            <p className="mb-2">{generatedCodes.length} kode berhasil dibuat — salin dan berikan ke mitra:</p>
            <div className="flex flex-wrap gap-2 font-mono text-xs">
              {generatedCodes.map((code) => (
                <span key={code} className="rounded bg-white/60 px-2 py-1">
                  {code}
                </span>
              ))}
            </div>
          </Alert>
        )}

        {selectedPartnerId && (
          <>
            {vouchers === null && <TableSkeleton columns={3} />}
            {vouchers?.length === 0 && (
              <EmptyState icon={<IconWallet />} title="Belum ada voucher untuk mitra ini" description="Buat batch voucher di atas." />
            )}
            {vouchers && vouchers.length > 0 && (
              <TableContainer>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Kode</Th>
                      <Th>Plan</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <tbody>
                    {vouchers.map((v) => (
                      <Tr key={v.id}>
                        <Td className="font-mono">{v.code}</Td>
                        <Td>{v.plan.nama}</Td>
                        <Td>
                          <Badge variant={v.status === "used" ? "success" : v.status === "unused" ? "neutral" : "danger"}>
                            {v.status === "used" ? "Terpakai" : v.status === "unused" ? "Belum dipakai" : "Dibatalkan"}
                          </Badge>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </section>

      {/* ─── Komisi Mitra ─── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Komisi Mitra</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Komisi otomatis tercatat saat sekolah rujukan diaktifkan (Jalur B). Klaim rujukan yang telat
              dicatat bisa ditambah manual di sini setelah diverifikasi terpisah - tidak pernah otomatis.
            </p>
          </div>
          <Button onClick={() => setShowCommissionForm((v) => !v)}>
            {showCommissionForm ? "Batal" : "Catat rujukan telat"}
          </Button>
        </div>

        {showCommissionForm && (
          <form
            onSubmit={handleCreateCommission}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
          >
            {commissionError && <Alert variant="danger">{commissionError}</Alert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="commissionPartner">Mitra</Label>
                <select
                  id="commissionPartner"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={commissionForm.partnerId}
                  onChange={(e) => setCommissionForm({ ...commissionForm, partnerId: e.target.value })}
                >
                  <option value="">Pilih mitra</option>
                  {partners?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="commissionSchool">Sekolah</Label>
                <select
                  id="commissionSchool"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={commissionForm.schoolId}
                  onChange={(e) => setCommissionForm({ ...commissionForm, schoolId: e.target.value })}
                >
                  <option value="">Pilih sekolah</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="commissionNote">Catatan verifikasi</Label>
              <Input
                id="commissionNote"
                required
                placeholder="mis. Dikonfirmasi lewat WhatsApp dengan kepala sekolah tgl ..."
                value={commissionForm.note}
                onChange={(e) => setCommissionForm({ ...commissionForm, note: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={commissionSubmitting} className="w-fit">
              {commissionSubmitting ? "Menyimpan..." : "Catat komisi"}
            </Button>
          </form>
        )}

        {commissions === null && <TableSkeleton columns={5} />}
        {commissions?.length === 0 && (
          <EmptyState icon={<IconWallet />} title="Belum ada komisi" description="Komisi muncul otomatis saat sekolah rujukan mitra diaktifkan." />
        )}
        {commissions && commissions.length > 0 && (
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Mitra</Th>
                  <Th>Sekolah</Th>
                  <Th>Nominal</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <tbody>
                {commissions.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-medium text-slate-900">{c.partner.nama}</Td>
                    <Td>{c.school.nama}</Td>
                    <Td>
                      {c.status === "paid" ? (
                        c.amount != null ? formatRupiah(c.amount) : "-"
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            className="w-32"
                            placeholder="Nominal"
                            value={amountDrafts[c.id] ?? (c.amount != null ? String(c.amount) : "")}
                            onChange={(e) => setAmountDrafts({ ...amountDrafts, [c.id]: e.target.value })}
                          />
                          <button
                            onClick={() => handleSetAmount(c, amountDrafts[c.id] ?? String(c.amount ?? ""))}
                            disabled={savingCommissionId === c.id}
                            className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                          >
                            Simpan
                          </button>
                        </div>
                      )}
                    </Td>
                    <Td>
                      <Badge variant={c.status === "paid" ? "success" : "warning"}>
                        {c.status === "paid" ? "Sudah dibayar" : "Menunggu"}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      {c.status === "pending" && (
                        <button
                          onClick={() => handleMarkPaid(c)}
                          disabled={savingCommissionId === c.id || c.amount == null}
                          title={c.amount == null ? "Isi nominal dulu sebelum menandai lunas" : undefined}
                          className="text-sm font-medium text-emerald-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Tandai lunas
                        </button>
                      )}
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
