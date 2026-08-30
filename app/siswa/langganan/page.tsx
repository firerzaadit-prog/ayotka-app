"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { PageSkeleton } from "@/components/ui/skeleton";
import { formatWIBDate } from "@/lib/utils/datetime";

type ServicePackage = {
  id: string;
  nama: string;
  hargaPerMapel: number;
  tryOutPerMapel: number;
  deskripsi: string | null;
};
type BankAccount = { id: string; namaBank: string; nomorRekening: string; atasNama: string };
type OrderStatus = "menunggu_verifikasi" | "disetujui" | "ditolak" | "kedaluwarsa";
type TryOutOrder = {
  id: string;
  jumlah: number;
  status: OrderStatus;
  catatanAdmin: string | null;
  createdAt: string;
  mapel: string[];
  paket: string;
  tryOutPerMapel: number;
};

type TryOutSubject = { id: string; nama: string; sisaTryOut: number; totalTryOut: number };
type TryOutData =
  | { jalur: "A" }
  | { jalur: "B"; servicePackages: ServicePackage[]; subjects: TryOutSubject[] };

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  menunggu_verifikasi: "Menunggu verifikasi",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  kedaluwarsa: "Kedaluwarsa",
};
const ORDER_STATUS_VARIANT: Record<OrderStatus, "warning" | "success" | "danger" | "neutral"> = {
  menunggu_verifikasi: "warning",
  disetujui: "success",
  ditolak: "danger",
  kedaluwarsa: "neutral",
};

/** Tiket 6.3 / Bagian 7.3 brief: checkout siswa mandiri — pilih paket + mapel, transfer manual, unggah bukti. */
export default function LanggananSiswaPage() {
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [tryOutOrders, setTryOutOrders] = useState<TryOutOrder[] | null>(null);
  const [tryOut, setTryOut] = useState<TryOutData | null>(null);

  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [tryOutFile, setTryOutFile] = useState<File | null>(null);
  const [tryOutError, setTryOutError] = useState<string | null>(null);
  const [tryOutSuccess, setTryOutSuccess] = useState(false);
  const [tryOutSubmitting, setTryOutSubmitting] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [bankRes, tryOutRes, tryOutOrderRes] = await Promise.all([
        fetch("/api/siswa/bank-accounts"),
        fetch("/api/siswa/subject-tryout"),
        fetch("/api/siswa/subject-tryout/orders"),
      ]);
      const bankData = await bankRes.json().catch(() => null);
      const tryOutData = await tryOutRes.json().catch(() => null);
      const tryOutOrderData = await tryOutOrderRes.json().catch(() => null);
      if (!ignore) {
        if (bankRes.ok) setAccounts(bankData.bankAccounts ?? []);
        if (tryOutRes.ok) setTryOut(tryOutData);
        if (tryOutOrderRes.ok) setTryOutOrders(tryOutOrderData.orders ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  function toggleSubject(id: string) {
    setSelectedSubjectIds((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id],
    );
  }

  const selectedPackage =
    tryOut && tryOut.jalur === "B"
      ? tryOut.servicePackages.find((p) => p.id === selectedPackageId) ?? null
      : null;

  async function handleTryOutSubmit(e: FormEvent) {
    e.preventDefault();
    setTryOutError(null);
    setTryOutSuccess(false);

    if (!selectedPackageId) {
      setTryOutError("Pilih paket layanan dulu.");
      return;
    }
    if (selectedSubjectIds.length === 0) {
      setTryOutError("Pilih minimal 1 mata pelajaran.");
      return;
    }
    if (!tryOutFile) {
      setTryOutError("Unggah bukti transfer dulu.");
      return;
    }

    setTryOutSubmitting(true);
    const formData = new FormData();
    formData.set("servicePackageId", selectedPackageId);
    for (const id of selectedSubjectIds) formData.append("subjectIds", id);
    formData.set("file", tryOutFile);

    const res = await fetch("/api/siswa/subject-tryout/orders", { method: "POST", body: formData });
    const data = await res.json().catch(() => null);
    setTryOutSubmitting(false);

    if (!res.ok) {
      setTryOutError(data?.error ?? "Gagal mengirim order.");
      return;
    }
    setTryOutSuccess(true);
    setSelectedPackageId("");
    setSelectedSubjectIds([]);
    setTryOutFile(null);
    setRefreshKey((k) => k + 1);
  }

  if (!tryOut || !accounts || !tryOutOrders) {
    return <PageSkeleton />;
  }

  if (tryOut.jalur === "A") {
    return (
      <div className="flex flex-col gap-2">
        <PageHeader title="Langganan" />
        <Card>
          <p className="text-sm text-slate-600">
            Akunmu terdaftar lewat sekolah. Akses Try Out ditanggung oleh sekolahmu — kamu tidak
            perlu membeli paket sendiri.
          </p>
        </Card>
      </div>
    );
  }

  const hasPendingOrder = tryOutOrders.some((o) => o.status === "menunggu_verifikasi");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Paket Try Out"
        description="Beli paket Try Out per mata pelajaran. Pilih paket, pilih mata pelajaran yang ingin dilatih, lalu transfer sesuai nominal."
      />

      {/* ─── Info kuota sisa ─── */}
      {tryOut.subjects.some((s) => s.totalTryOut > 0) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">Kuota Try Out Kamu</h2>
          <div className="flex flex-wrap gap-2">
            {tryOut.subjects
              .filter((s) => s.totalTryOut > 0)
              .map((s) => (
                <Badge key={s.id} variant={s.sisaTryOut > 0 ? "success" : "neutral"}>
                  {s.nama}: {s.sisaTryOut}/{s.totalTryOut} tersisa
                </Badge>
              ))}
          </div>
        </section>
      )}

      {/* ─── Skema Penawaran ─── */}
      {tryOut.servicePackages.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">Skema Penawaran</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tryOut.servicePackages.map((pkg) => (
              <div
                key={pkg.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="font-semibold text-slate-900">{pkg.nama}</p>
                {pkg.deskripsi && (
                  <p className="mt-1 text-xs text-slate-500">{pkg.deskripsi}</p>
                )}
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Mapel</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Biaya</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Try Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3].map((n) => (
                        <tr key={n} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 text-slate-700">{n} Mapel</td>
                          <td className="px-3 py-1.5 font-semibold text-indigo-700">
                            {formatRupiah(pkg.hargaPerMapel * n)}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">{pkg.tryOutPerMapel}×/mapel</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Form Checkout ─── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Beli Paket Try Out</h2>

        {hasPendingOrder ? (
          <Alert variant="warning">
            Ordermu sedang menunggu verifikasi admin. Tunggu itu diproses sebelum membuat order baru.
          </Alert>
        ) : tryOut.servicePackages.length === 0 ? (
          <Alert variant="danger">
            Belum ada paket layanan yang tersedia. Hubungi admin pusat.
          </Alert>
        ) : (
          <form
            onSubmit={handleTryOutSubmit}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
          >
            {tryOutError && <Alert variant="danger">{tryOutError}</Alert>}
            {tryOutSuccess && (
              <Alert variant="success">
                Order terkirim! Admin akan memverifikasi bukti transfermu. Kuota try out akan
                ditambahkan setelah disetujui.
              </Alert>
            )}

            {/* Pilih Paket */}
            <div>
              <Label htmlFor="pilihPaket">Pilih paket layanan</Label>
              <select
                id="pilihPaket"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={selectedPackageId}
                onChange={(e) => {
                  setSelectedPackageId(e.target.value);
                  setSelectedSubjectIds([]);
                }}
              >
                <option value="">- Pilih paket -</option>
                {tryOut.servicePackages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} — {formatRupiah(p.hargaPerMapel)}/mapel, {p.tryOutPerMapel}× Try Out
                  </option>
                ))}
              </select>
            </div>

            {/* Pilih Mata Pelajaran */}
            {selectedPackageId && (
              <div>
                <Label>Pilih mata pelajaran</Label>
                <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
                  {tryOut.subjects.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedSubjectIds.includes(s.id)}
                        onChange={() => toggleSubject(s.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
                      />
                      {s.nama}
                      {s.totalTryOut > 0 && (
                        <span className="text-xs text-slate-400">
                          ({s.sisaTryOut}/{s.totalTryOut} tersisa)
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                {selectedPackage && selectedSubjectIds.length > 0 && (
                  <p className="mt-2 text-sm text-slate-600">
                    Total:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatRupiah(selectedPackage.hargaPerMapel * selectedSubjectIds.length)}
                    </span>{" "}
                    ({selectedSubjectIds.length} mata pelajaran × {selectedPackage.tryOutPerMapel}× Try Out/mapel)
                  </p>
                )}
              </div>
            )}

            {/* Info Rekening */}
            {accounts.length > 0 ? (
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-700">Transfer ke salah satu rekening berikut:</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {accounts.map((acc) => (
                    <li key={acc.id}>
                      <span className="font-medium">{acc.namaBank}</span>{" "}
                      <span className="font-mono">{acc.nomorRekening}</span> a.n. {acc.atasNama}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Alert variant="danger">Belum ada rekening tujuan aktif. Hubungi admin pusat.</Alert>
            )}

            {/* Upload Bukti */}
            <div>
              <Label htmlFor="buktiTryOut">Bukti transfer (gambar/PDF, maks. 5 MB)</Label>
              <Input
                id="buktiTryOut"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => setTryOutFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <Button type="submit" disabled={tryOutSubmitting} className="w-fit">
              {tryOutSubmitting ? "Mengirim..." : "Kirim order"}
            </Button>
          </form>
        )}
      </section>

      {/* ─── Riwayat Order ─── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Riwayat Order</h2>
        {tryOutOrders.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada order.</p>
        ) : (
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Tanggal</Th>
                  <Th>Paket</Th>
                  <Th>Mata pelajaran</Th>
                  <Th>Jumlah</Th>
                  <Th>Status</Th>
                  <Th>Catatan admin</Th>
                </Tr>
              </Thead>
              <tbody>
                {tryOutOrders.map((o) => (
                  <Tr key={o.id}>
                    <Td>{formatWIBDate(o.createdAt)}</Td>
                    <Td>
                      <div>
                        <span className="font-medium text-slate-900">{o.paket}</span>
                        <p className="text-xs text-slate-400">{o.tryOutPerMapel}× Try Out/mapel</p>
                      </div>
                    </Td>
                    <Td>{o.mapel.join(", ")}</Td>
                    <Td>{formatRupiah(o.jumlah)}</Td>
                    <Td>
                      <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                        {ORDER_STATUS_LABEL[o.status]}
                      </Badge>
                    </Td>
                    <Td className="text-slate-500">{o.catatanAdmin ?? "-"}</Td>
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
