"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatWIBDate } from "@/lib/utils/datetime";

type Partner = { id: string; nama: string };
type SeatStatus = {
  seatQuota: number | null;
  validUntil: string | null;
  seatsUsed: number;
  referredByPartner: Partner | null;
  isFirstActivation: boolean;
  partners: Partner[];
};

const selectClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

/**
 * Jalur B (sekolah, Bagian 5 dokumen rencana): admin pusat mengaktifkan
 * kursi sekolah setelah transfer dikonfirmasi di luar sistem. Entitlement
 * per siswa dibuat otomatis (lazy) saat siswa butuh akses - lihat
 * lib/billing/entitlements.ts.
 */
export function SchoolSeatPanel({ schoolId }: { schoolId: string }) {
  const [status, setStatus] = useState<SeatStatus | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [seatQuota, setSeatQuota] = useState("100");
  const [validUntil, setValidUntil] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-pusat/schools/${schoolId}/seat`);
      if (res.ok) {
        const data = await res.json();
        if (!ignore) setStatus(data);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [schoolId, refreshKey]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch(`/api/admin-pusat/schools/${schoolId}/seat`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seatQuota: Number(seatQuota),
        validUntil,
        referredByPartnerId: partnerId || null,
      }),
    });
    const data = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(data?.error ?? "Gagal menyimpan kuota kursi.");
      return;
    }
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  if (!status) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Kursi Sekolah (Jalur B)</h2>
          <p className="text-sm text-slate-500">
            Aktifkan setelah transfer sekolah dikonfirmasi di luar sistem. Berlaku untuk semua siswa sekolah
            ini, bukan per mata pelajaran.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm((v) => !v);
            setError(null);
          }}
        >
          {showForm ? "Batal" : status.seatQuota == null ? "Aktifkan kuota" : "Ubah kuota"}
        </Button>
      </div>

      {status.seatQuota != null ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
            {status.seatsUsed.toLocaleString("id-ID")}/{status.seatQuota.toLocaleString("id-ID")} kursi
            terpakai
          </span>
          {status.validUntil && (
            <p className="mt-2 text-sm text-slate-600">Berlaku sampai {formatWIBDate(status.validUntil)}</p>
          )}
          {status.referredByPartner && (
            <p className="mt-1 text-sm text-slate-500">
              Rujukan mitra: <span className="font-medium text-slate-800">{status.referredByPartner.nama}</span>
            </p>
          )}
        </div>
      ) : (
        <Alert variant="warning">Kursi sekolah ini belum diaktifkan.</Alert>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="seatQuota">Kuota kursi</Label>
              <Input
                id="seatQuota"
                type="number"
                min={1}
                max={100000}
                required
                value={seatQuota}
                onChange={(e) => setSeatQuota(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="validUntil">Berlaku sampai</Label>
              <Input
                id="validUntil"
                type="date"
                required
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
          {status.isFirstActivation ? (
            <div>
              <Label htmlFor="partnerId">Rujukan mitra (opsional)</Label>
              <select
                id="partnerId"
                className={selectClassName}
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
              >
                <option value="">- Tidak ada rujukan mitra -</option>
                {status.partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Isi HANYA jika sekolah ini datang dari rujukan mitra - wajib diisi sekarang, tidak bisa
                ditambahkan setelah kursi diaktifkan (Bagian 4.1 dokumen rencana).
              </p>
            </div>
          ) : (
            <Badge variant="neutral">
              Kursi sudah pernah diaktifkan - rujukan mitra tidak bisa diubah lagi lewat form ini.
            </Badge>
          )}
          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      )}
    </div>
  );
}
