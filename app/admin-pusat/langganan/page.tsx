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

type ServicePackage = {
  id: string;
  nama: string;
  hargaPerMapel: number;
  tryOutPerMapel: number;
  deskripsi: string | null;
  isActive: boolean;
};

type BankAccount = {
  id: string;
  namaBank: string;
  nomorRekening: string;
  atasNama: string;
  isActive: boolean;
};

const emptyPkgForm = {
  nama: "",
  hargaPerMapel: "",
  tryOutPerMapel: "3",
  deskripsi: "",
  isActive: true,
};
const emptyBankForm = { namaBank: "", nomorRekening: "", atasNama: "" };

const selectClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/** Tampilkan tabel skema penawaran otomatis berdasarkan paket yang dipilih */
function SkemaPenawaranTable({ pkg }: { pkg: ServicePackage }) {
  const rows = [1, 2, 3];
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
      <p className="mb-3 text-sm font-medium text-indigo-800">
        Skema Penawaran — {pkg.nama}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="pb-2 pr-4">Jumlah Mata Pelajaran</th>
            <th className="pb-2 pr-4">Biaya/Siswa</th>
            <th className="pb-2">Fasilitas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => (
            <tr key={n} className="border-t border-slate-200">
              <td className="py-2 pr-4 font-medium text-slate-900">{n} Mata Pelajaran</td>
              <td className="py-2 pr-4 text-indigo-700 font-semibold">{formatRupiah(pkg.hargaPerMapel * n)}</td>
              <td className="py-2 text-slate-600">{pkg.tryOutPerMapel}× Try Out TKA/mata pelajaran</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Pengaturan Paket Layanan (Bagian 7.3 brief) + Rekening Tujuan.
 * Admin pusat bisa buat banyak paket berbeda (nama, harga/mapel, jumlah
 * TryOut/mapel). Siswa mandiri memilih paket saat checkout.
 */
export default function LanggananSettingsPage() {
  const toast = useToast();
  const { confirm } = useDialog();
  const [packages, setPackages] = useState<ServicePackage[] | null>(null);
  const [showPkgForm, setShowPkgForm] = useState(false);
  const [pkgForm, setPkgForm] = useState(emptyPkgForm);
  const [pkgError, setPkgError] = useState<string | null>(null);
  const [pkgSubmitting, setPkgSubmitting] = useState(false);

  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState(emptyBankForm);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankSubmitting, setBankSubmitting] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [pkgRes, bankRes] = await Promise.all([
        fetch("/api/admin-pusat/service-packages"),
        fetch("/api/admin-pusat/bank-accounts"),
      ]);
      const pkgData = await pkgRes.json().catch(() => null);
      const bankData = await bankRes.json().catch(() => null);
      if (!ignore) {
        if (pkgRes.ok) setPackages(pkgData.packages ?? []);
        if (bankRes.ok) setAccounts(bankData.bankAccounts ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  async function handlePkgSubmit(e: FormEvent) {
    e.preventDefault();
    setPkgError(null);
    setPkgSubmitting(true);
    const res = await fetch("/api/admin-pusat/service-packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama: pkgForm.nama,
        hargaPerMapel: Number(pkgForm.hargaPerMapel),
        tryOutPerMapel: Number(pkgForm.tryOutPerMapel),
        deskripsi: pkgForm.deskripsi || undefined,
        isActive: pkgForm.isActive,
      }),
    });
    const data = await res.json().catch(() => null);
    setPkgSubmitting(false);
    if (!res.ok) {
      setPkgError(data?.error ?? "Gagal menyimpan paket.");
      return;
    }
    setPkgForm(emptyPkgForm);
    setShowPkgForm(false);
    setRefreshKey((k) => k + 1);
  }

  async function togglePkgActive(pkg: ServicePackage) {
    await fetch(`/api/admin-pusat/service-packages/${pkg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !pkg.isActive }),
    });
    setRefreshKey((k) => k + 1);
  }

  async function handleDeletePkg(pkg: ServicePackage) {
    const ok = await confirm({
      title: `Hapus paket "${pkg.nama}"?`,
      description: "Paket yang sudah dipakai order tidak bisa dihapus.",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin-pusat/service-packages/${pkg.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) setRefreshKey((k) => k + 1);
    else toast.error(data?.error ?? "Gagal menghapus paket.");
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
        title="Paket Layanan & Pembayaran"
        description="Bagian 7.3: Rp20.000/siswa/mata pelajaran sudah termasuk 3× Try Out TKA. Admin pusat bisa membuat banyak paket berbeda yang bisa dipilih siswa mandiri."
      />

      {/* ─── Paket Layanan ─── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Paket Layanan</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Setiap paket berisi harga per mata pelajaran dan jumlah Try Out yang didapat siswa mandiri.
            </p>
          </div>
          <Button onClick={() => setShowPkgForm((v) => !v)}>{showPkgForm ? "Batal" : "Tambah paket"}</Button>
        </div>

        {showPkgForm && (
          <form
            onSubmit={handlePkgSubmit}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
          >
            {pkgError && <Alert variant="danger">{pkgError}</Alert>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pkgNama">Nama paket</Label>
                <Input
                  id="pkgNama"
                  required
                  placeholder='mis. "Paket Standar TKA"'
                  value={pkgForm.nama}
                  onChange={(e) => setPkgForm({ ...pkgForm, nama: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pkgStatus">Status</Label>
                <select
                  id="pkgStatus"
                  className={selectClassName}
                  value={pkgForm.isActive ? "aktif" : "nonaktif"}
                  onChange={(e) => setPkgForm({ ...pkgForm, isActive: e.target.value === "aktif" })}
                >
                  <option value="aktif">Aktif (terlihat siswa)</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pkgHarga">Harga per mata pelajaran (Rp)</Label>
                <Input
                  id="pkgHarga"
                  type="number"
                  min={0}
                  required
                  placeholder="mis. 20000"
                  value={pkgForm.hargaPerMapel}
                  onChange={(e) => setPkgForm({ ...pkgForm, hargaPerMapel: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pkgTryOut">Jumlah Try Out per mata pelajaran</Label>
                <Input
                  id="pkgTryOut"
                  type="number"
                  min={1}
                  required
                  placeholder="3"
                  value={pkgForm.tryOutPerMapel}
                  onChange={(e) => setPkgForm({ ...pkgForm, tryOutPerMapel: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="pkgDeskripsi">Deskripsi (opsional)</Label>
              <Input
                id="pkgDeskripsi"
                placeholder="mis. Cocok untuk persiapan UTBK mapel Matematika & Bahasa Indonesia"
                value={pkgForm.deskripsi}
                onChange={(e) => setPkgForm({ ...pkgForm, deskripsi: e.target.value })}
              />
            </div>

            {/* Preview skema penawaran */}
            {pkgForm.hargaPerMapel && pkgForm.tryOutPerMapel && (
              <SkemaPenawaranTable
                pkg={{
                  id: "preview",
                  nama: pkgForm.nama || "Pratinjau",
                  hargaPerMapel: Number(pkgForm.hargaPerMapel),
                  tryOutPerMapel: Number(pkgForm.tryOutPerMapel),
                  deskripsi: null,
                  isActive: true,
                }}
              />
            )}

            <Button type="submit" disabled={pkgSubmitting} className="w-fit">
              {pkgSubmitting ? "Menyimpan..." : "Simpan paket"}
            </Button>
          </form>
        )}

        {packages === null && <TableSkeleton columns={5} />}
        {packages?.length === 0 && (
          <EmptyState
            icon={<IconWallet />}
            title="Belum ada paket layanan"
            description="Buat paket dulu supaya siswa mandiri bisa checkout. Contoh: Rp20.000/mapel, 3× Try Out."
            action={<Button onClick={() => setShowPkgForm(true)}>Tambah paket</Button>}
          />
        )}
        {packages && packages.length > 0 && (
          <div className="flex flex-col gap-6">
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Nama Paket</Th>
                    <Th>Harga/Mapel</Th>
                    <Th>Try Out/Mapel</Th>
                    <Th>Status</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <tbody>
                  {packages.map((p) => (
                    <Tr key={p.id}>
                      <Td>
                        <div>
                          <span className="font-medium text-slate-900">{p.nama}</span>
                          {p.deskripsi && (
                            <p className="mt-0.5 text-xs text-slate-400">{p.deskripsi}</p>
                          )}
                        </div>
                      </Td>
                      <Td className="font-semibold text-indigo-700">{formatRupiah(p.hargaPerMapel)}</Td>
                      <Td>{p.tryOutPerMapel}×</Td>
                      <Td>
                        <Badge variant={p.isActive ? "success" : "neutral"}>
                          {p.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => togglePkgActive(p)}
                            className="text-sm font-medium text-slate-600 hover:text-slate-900"
                          >
                            {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                          <button
                            onClick={() => handleDeletePkg(p)}
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

            {/* Preview skema penawaran untuk setiap paket aktif */}
            {packages.filter((p) => p.isActive).length > 0 && (
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-slate-700">Pratinjau Skema Penawaran (paket aktif)</h3>
                {packages
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <SkemaPenawaranTable key={p.id} pkg={p} />
                  ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ─── Rekening Tujuan ─── */}
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
            description="Tambah rekening tujuan supaya siswa mandiri bisa transfer pembayaran."
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
