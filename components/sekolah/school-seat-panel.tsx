"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatWIBDate, tanggalWIB } from "@/lib/utils/datetime";
import { geserTanggal, tanggalAkhirPeriode } from "@/lib/billing/periode-sekolah";

type Partner = { id: string; nama: string };
type StatusPeriode = "akan_datang" | "aktif" | "tenggang" | "berakhir" | "dicabut";
type Periode = {
  id: string;
  nama: string | null;
  mulai: string;
  berakhir: string;
  masaTenggangHari: number;
  akhirEfektif: string;
  seatQuota: number;
  catatan: string | null;
  dicabutAt: string | null;
  status: StatusPeriode;
  kursiTerpakai: number;
};
type Data = {
  periode: Periode[];
  siswaTerdaftar: number;
  referredByPartner: Partner | null;
  isFirstActivation: boolean;
  partners: Partner[];
  tenggangDefaultHari: number;
};
type FormState = {
  /** null = periode baru; terisi = mengubah periode itu. */
  id: string | null;
  nama: string;
  mulai: string;
  berakhir: string;
  seatQuota: string;
  masaTenggangHari: string;
  catatan: string;
  partnerId: string;
};

const STATUS_LABEL: Record<StatusPeriode, string> = {
  akan_datang: "Akan datang",
  aktif: "Aktif",
  tenggang: "Masa tenggang",
  berakhir: "Berakhir",
  dicabut: "Dicabut",
};
const STATUS_VARIAN: Record<StatusPeriode, "neutral" | "success" | "warning" | "danger" | "info"> = {
  akan_datang: "info",
  aktif: "success",
  tenggang: "warning",
  berakhir: "neutral",
  dicabut: "danger",
};

const selectClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

/**
 * Langganan kursi sekolah per PERIODE (semester/tahun ajaran). Admin pusat mengaktifkan periode setelah transfer
 * sekolah dikonfirmasi di luar sistem; perpanjangan = menambah periode baru (riwayat tersimpan). Kursi per siswa
 * dibuat otomatis (lazy) saat siswa butuh akses - lihat lib/billing/entitlements.ts dan lib/billing/periode-sekolah.ts.
 */
export function SchoolSeatPanel({ schoolId }: { schoolId: string }) {
  const toast = useToast();
  const { confirm } = useDialog();
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/admin-pusat/schools/${schoolId}/periode`);
      if (res.ok) {
        const json = await res.json();
        if (!ignore) setData(json);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [schoolId, refreshKey]);

  if (!data) return null;

  const periodeBerlaku = data.periode.filter((p) => p.status !== "dicabut");
  const berjalan = periodeBerlaku.find((p) => p.status === "aktif" || p.status === "tenggang") ?? null;

  function bukaFormBaru() {
    if (!data) return;
    // Periode baru dimulai sehari setelah periode terakhir berakhir (berkesinambungan); kalau belum ada, hari ini.
    const terakhir = periodeBerlaku.reduce<Periode | null>(
      (acuan, p) => (!acuan || new Date(p.berakhir) > new Date(acuan.berakhir) ? p : acuan),
      null,
    );
    const hariIni = tanggalWIB();
    const mulaiDefault = terakhir ? geserTanggal(tanggalWIB(new Date(terakhir.berakhir)), 1) : hariIni;
    setError(null);
    setForm({
      id: null,
      nama: "",
      mulai: mulaiDefault,
      berakhir: tanggalAkhirPeriode(mulaiDefault, 6),
      seatQuota: String(terakhir?.seatQuota ?? 100),
      masaTenggangHari: String(data.tenggangDefaultHari),
      catatan: "",
      partnerId: "",
    });
  }

  function bukaFormUbah(p: Periode) {
    setError(null);
    setForm({
      id: p.id,
      nama: p.nama ?? "",
      mulai: tanggalWIB(new Date(p.mulai)),
      berakhir: tanggalWIB(new Date(p.berakhir)),
      seatQuota: String(p.seatQuota),
      masaTenggangHari: String(p.masaTenggangHari),
      catatan: p.catatan ?? "",
      partnerId: "",
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form || !data) return;
    setError(null);
    setSubmitting(true);

    const payload = {
      nama: form.nama.trim() || null,
      mulai: form.mulai,
      berakhir: form.berakhir,
      seatQuota: Number(form.seatQuota),
      masaTenggangHari: Number(form.masaTenggangHari),
      catatan: form.catatan.trim() || null,
      ...(form.id === null && data.isFirstActivation ? { referredByPartnerId: form.partnerId || null } : {}),
    };
    const res = await fetch(
      form.id === null
        ? `/api/admin-pusat/schools/${schoolId}/periode`
        : `/api/admin-pusat/schools/${schoolId}/periode/${form.id}`,
      {
        method: form.id === null ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(json?.error ?? "Gagal menyimpan periode.");
      return;
    }
    setForm(null);
    setRefreshKey((k) => k + 1);
  }

  async function handleCabut(p: Periode) {
    const ok = await confirm({
      title: "Cabut periode ini?",
      description:
        "Gunakan hanya untuk periode yang salah input. Kursi siswa dari periode ini ikut dicabut, jadi siswa kehilangan akses sekolah yang bersumber dari periode ini. Untuk memperpanjang, tambahkan periode baru, jangan mencabut.",
      confirmLabel: "Ya, cabut periode",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin-pusat/schools/${schoolId}/periode/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dicabut: true }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(json?.error ?? "Gagal mencabut periode.");
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Langganan Kursi Sekolah</h2>
          <p className="text-sm text-slate-500">
            Aktifkan setelah transfer sekolah dikonfirmasi di luar sistem. Berlaku untuk semua siswa sekolah ini, bukan
            per mata pelajaran. Perpanjangan = tambah periode baru; riwayat periode tersimpan.
          </p>
        </div>
        <Button onClick={() => (form ? setForm(null) : bukaFormBaru())}>
          {form ? "Batal" : data.isFirstActivation ? "Aktifkan langganan" : "Perpanjang periode"}
        </Button>
      </div>

      {data.isFirstActivation && <Alert variant="warning">Langganan sekolah ini belum diaktifkan.</Alert>}
      {!data.isFirstActivation && !berjalan && (
        <Alert variant="warning">
          Tidak ada periode yang sedang berlaku: sekolah dibekukan (siswa tidak bisa memulai ujian baru, admin sekolah
          tidak bisa menambah siswa) sampai periode baru ditambahkan.
        </Alert>
      )}
      {berjalan && data.siswaTerdaftar >= berjalan.seatQuota && (
        <Alert variant="warning">
          Kuota penuh - admin sekolah tidak bisa menambah atau mengimpor siswa baru sampai kuota ditambah.
        </Alert>
      )}
      {data.referredByPartner && (
        <p className="text-sm text-slate-500">
          Rujukan mitra: <span className="font-medium text-slate-800">{data.referredByPartner.nama}</span>
        </p>
      )}

      {data.periode.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.periode.map((p) => (
            <li
              key={p.id}
              className={`rounded-xl border bg-white p-4 ${p.status === "dicabut" ? "border-slate-200 opacity-60" : "border-slate-200"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_VARIAN[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                  <span className="text-sm font-semibold text-slate-900">{p.nama ?? "Periode langganan"}</span>
                </div>
                {p.status !== "dicabut" && (
                  <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
                    {p.kursiTerpakai.toLocaleString("id-ID")}/{p.seatQuota.toLocaleString("id-ID")} kursi terpakai
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {formatWIBDate(p.mulai)} sampai {formatWIBDate(p.berakhir)}
                {p.masaTenggangHari > 0 && (
                  <span className="text-slate-500">
                    {" "}
                    · tenggang {p.masaTenggangHari} hari (sampai {formatWIBDate(p.akhirEfektif)})
                  </span>
                )}
              </p>
              {p.catatan && <p className="mt-1 text-sm text-slate-500">{p.catatan}</p>}
              {p.status !== "dicabut" && (
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => bukaFormUbah(p)}
                    className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    Ubah
                  </button>
                  <button
                    onClick={() => handleCabut(p)}
                    className="rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                  >
                    Cabut
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {form && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          <h3 className="text-sm font-semibold text-slate-900">
            {form.id === null ? (data.isFirstActivation ? "Aktifkan langganan" : "Periode baru") : "Ubah periode"}
          </h3>
          {error && <Alert variant="danger">{error}</Alert>}
          <div>
            <Label htmlFor="periodeNama">Nama periode (opsional)</Label>
            <Input
              id="periodeNama"
              maxLength={100}
              placeholder="mis. Semester Ganjil 2026/2027"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="periodeMulai">Mulai</Label>
              <Input
                id="periodeMulai"
                type="date"
                required
                value={form.mulai}
                onChange={(e) => setForm({ ...form, mulai: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="periodeBerakhir">Berakhir (sampai akhir hari ini)</Label>
              <Input
                id="periodeBerakhir"
                type="date"
                required
                value={form.berakhir}
                onChange={(e) => setForm({ ...form, berakhir: e.target.value })}
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={!form.mulai}
                  onClick={() => setForm({ ...form, berakhir: tanggalAkhirPeriode(form.mulai, 6) })}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Semester (6 bulan)
                </button>
                <button
                  type="button"
                  disabled={!form.mulai}
                  onClick={() => setForm({ ...form, berakhir: tanggalAkhirPeriode(form.mulai, 12) })}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Setahun (12 bulan)
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="periodeKuota">Kuota kursi</Label>
              <Input
                id="periodeKuota"
                type="number"
                min={1}
                max={100000}
                required
                value={form.seatQuota}
                onChange={(e) => setForm({ ...form, seatQuota: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">
                Siswa terdaftar saat ini: {data.siswaTerdaftar.toLocaleString("id-ID")}. Untuk periode yang langsung
                berlaku, kuota tidak boleh di bawah angka itu.
              </p>
            </div>
            <div>
              <Label htmlFor="periodeTenggang">Masa tenggang (hari)</Label>
              <Input
                id="periodeTenggang"
                type="number"
                min={0}
                max={90}
                required
                value={form.masaTenggangHari}
                onChange={(e) => setForm({ ...form, masaTenggangHari: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">
                Setelah periode berakhir siswa masih bisa memulai ujian selama masa tenggang.
              </p>
            </div>
          </div>
          <div>
            <Label htmlFor="periodeCatatan">Catatan (opsional)</Label>
            <Input
              id="periodeCatatan"
              maxLength={500}
              placeholder="mis. nomor transfer atau kesepakatan"
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
            />
          </div>
          {form.id === null && data.isFirstActivation && (
            <div>
              <Label htmlFor="partnerId">Rujukan mitra (opsional)</Label>
              <select
                id="partnerId"
                className={selectClassName}
                value={form.partnerId}
                onChange={(e) => setForm({ ...form, partnerId: e.target.value })}
              >
                <option value="">- Tidak ada rujukan mitra -</option>
                {data.partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Isi HANYA jika sekolah ini datang dari rujukan mitra - wajib diisi sekarang, tidak bisa ditambahkan
                setelah langganan diaktifkan (Bagian 4.1 dokumen rencana).
              </p>
            </div>
          )}
          {form.id === null && !data.isFirstActivation && (
            <Badge variant="neutral">
              Sekolah sudah pernah diaktifkan - rujukan mitra tidak bisa diubah lewat form ini; komisi perpanjangan
              dicatat manual.
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
