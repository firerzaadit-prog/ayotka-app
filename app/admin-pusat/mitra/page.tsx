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

const emptyPartnerForm = { email: "", nama: "", kontak: "" };

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

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [partnerRes, planRes] = await Promise.all([
        fetch("/api/admin-pusat/partners"),
        fetch("/api/admin-pusat/plans"),
      ]);
      const partnerData = await partnerRes.json().catch(() => null);
      const planData = await planRes.json().catch(() => null);
      if (!ignore) {
        if (partnerRes.ok) setPartners(partnerData.partners ?? []);
        if (planRes.ok) setPlans(planData.plans ?? []);
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
    </div>
  );
}
