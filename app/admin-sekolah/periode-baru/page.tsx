"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ImportSiswaModal } from "@/components/sekolah/import-siswa-modal";
import { BilahHapusMassal, CentangSemuaHalaman, useLulusMassal, usePilihan } from "@/components/sekolah/hapus-massal";
import { tanggalAkhirPeriode } from "@/lib/billing/periode-sekolah";
import { formatWIBDate } from "@/lib/utils/datetime";
import { FileSpreadsheet } from "lucide-react";

type Siswa = { id: string; nama: string; nisn: string | null };
type StatusLangganan = "belum_aktif" | "akan_datang" | "aktif" | "tenggang" | "berakhir";
type Kuota = {
  seatQuota: number | null;
  seatsUsed: number;
  validUntil: string | null;
  status: StatusLangganan;
  tenggangSampai: string | null;
  sisaHari: number | null;
};
type Permintaan = {
  id: string;
  kuotaDiminta: number;
  mulaiDiminta: string;
  berakhirDiminta: string;
  catatan: string | null;
  createdAt: string;
};
type PermintaanDiproses = Permintaan & { status: "disetujui" | "ditolak"; catatanAdmin: string | null };
type Perpanjangan = {
  menunggu: Permintaan | null;
  terakhirDiproses: PermintaanDiproses | null;
  siswaAktif: number;
  mulaiDefault: string;
  kuotaTerakhir: number | null;
};

function Langkah({ nomor, judul, children }: { nomor: number; judul: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
          {nomor}
        </span>
        <h2 className="text-base font-semibold text-slate-900">{judul}</h2>
      </div>
      {children}
    </section>
  );
}

function ringkasStatus(k: Kuota): { teks: string; varian: "success" | "warning" | "danger" | "neutral" | "info" } {
  switch (k.status) {
    case "aktif":
      return {
        teks: `Aktif sampai ${k.validUntil ? formatWIBDate(k.validUntil) : "-"}${
          k.sisaHari != null ? ` (${k.sisaHari === 0 ? "hari terakhir" : `${k.sisaHari} hari lagi`})` : ""
        }`,
        varian: k.sisaHari != null && k.sisaHari <= 7 ? "warning" : "success",
      };
    case "tenggang":
      return {
        teks: `Masa tenggang sampai ${k.tenggangSampai ? formatWIBDate(k.tenggangSampai) : "-"}`,
        varian: "warning",
      };
    case "berakhir":
      return { teks: `Berakhir pada ${k.validUntil ? formatWIBDate(k.validUntil) : "-"} (sekolah dibekukan)`, varian: "danger" };
    case "akan_datang":
      return { teks: "Periode berikutnya sudah dijadwalkan", varian: "info" };
    default:
      return { teks: "Langganan belum diaktifkan", varian: "neutral" };
  }
}

/**
 * Panduan "Periode Baru" satu layar: (1) tandai siswa yang lulus, (2) tambahkan siswa baru, (3) ajukan perpanjangan.
 * Siswa yang lanjut tidak perlu diimpor ulang - kursinya otomatis dibuat di periode baru begitu mereka ujian.
 * Admin sekolah hanya MENGAJUKAN; admin pusat yang mengaktifkan periode setelah pembayaran dikonfirmasi.
 */
export default function PeriodeBaruPage() {
  const toast = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [siswa, setSiswa] = useState<Siswa[] | null>(null);
  const [kuota, setKuota] = useState<Kuota | null>(null);
  const [perpanjangan, setPerpanjangan] = useState<Perpanjangan | null>(null);
  const [cari, setCari] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [showImport, setShowImport] = useState(false);
  const pilihan = usePilihan();
  const lulus = useLulusMassal(() => {
    pilihan.kosongkan();
    setRefreshKey((k) => k + 1);
  });

  // Isian form: null = pakai usulan (turunan dari data), terisi = pilihan admin sekolah.
  const [mulaiInput, setMulaiInput] = useState<string | null>(null);
  const [berakhirInput, setBerakhirInput] = useState<string | null>(null);
  const [kuotaInput, setKuotaInput] = useState<string | null>(null);
  const [catatan, setCatatan] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [rs, rk, rp] = await Promise.all([
        fetch("/api/admin-sekolah/siswa?status=aktif"),
        fetch("/api/admin-sekolah/kuota"),
        fetch("/api/admin-sekolah/perpanjangan"),
      ]);
      const [ds, dk, dp] = await Promise.all([
        rs.json().catch(() => null),
        rk.json().catch(() => null),
        rp.json().catch(() => null),
      ]);
      if (ignore) return;
      setSiswa(rs.ok ? (ds?.students ?? []) : []);
      if (rk.ok) setKuota(dk);
      if (rp.ok) setPerpanjangan(dp);
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const mulai = mulaiInput ?? perpanjangan?.mulaiDefault ?? "";
  const berakhir = berakhirInput ?? (mulai ? tanggalAkhirPeriode(mulai, 6) : "");
  const kuotaDiminta = kuotaInput ?? String(Math.max(1, perpanjangan?.siswaAktif ?? 1));

  const disaring = (siswa ?? []).filter((s) => {
    const q = cari.trim().toLowerCase();
    return !q || s.nama.toLowerCase().includes(q) || (s.nisn ?? "").toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(disaring.length / pageSize));
  const halaman = disaring.slice((page - 1) * pageSize, page * pageSize);
  const idSemua = disaring.map((s) => s.id);
  const idHalaman = halaman.map((s) => s.id);
  // Yang ditandai lulus hanya yang dicentang DAN masih tampil menurut pencarian: jumlah di bilah = jumlah yang diproses.
  const terpilih = idSemua.filter((id) => pilihan.dipilih.has(id));

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    setMengirim(true);
    const res = await fetch("/api/admin-sekolah/perpanjangan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kuotaDiminta: Number(kuotaDiminta), mulai, berakhir, catatan: catatan.trim() || null }),
    });
    const data = await res.json().catch(() => null);
    setMengirim(false);
    if (!res.ok) {
      setGalat(data?.error ?? "Gagal mengajukan perpanjangan.");
      return;
    }
    toast.success("Permintaan perpanjangan terkirim ke admin pusat.");
    setCatatan("");
    setRefreshKey((k) => k + 1);
  }

  const status = kuota ? ringkasStatus(kuota) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Periode Baru"
        description="Siapkan pergantian semester atau tahun ajaran: tandai siswa yang lulus, tambahkan siswa baru, lalu ajukan perpanjangan langganan."
      />

      {status && kuota && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <span className="font-medium text-slate-700">Langganan saat ini:</span>
          <Badge variant={status.varian}>{status.teks}</Badge>
          {kuota.seatQuota != null && (
            <span className="text-slate-500">
              {kuota.seatsUsed.toLocaleString("id-ID")}/{kuota.seatQuota.toLocaleString("id-ID")} kursi terpakai
            </span>
          )}
        </div>
      )}

      <Langkah nomor={1} judul="Tandai siswa yang lulus">
        <p className="text-sm text-slate-600">
          Centang siswa yang sudah lulus lalu tandai lulus. Mereka pindah ke tab Alumni dan tidak memakai kursi sekolah
          lagi, tetapi akun, riwayat, dan nilainya tetap ada dan tetap terhitung di analitik. Siswa yang lanjut tidak
          perlu diapa-apakan.
        </p>
        <div className="w-56">
          <Label htmlFor="cariLulus">Cari nama/NISN</Label>
          <Input
            id="cariLulus"
            placeholder="Ketik nama atau NISN..."
            value={cari}
            onChange={(e) => {
              setCari(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {siswa === null && <TableSkeleton columns={3} />}
        {siswa !== null && siswa.length === 0 && (
          <p className="text-sm text-slate-500">Belum ada siswa aktif di sekolah ini.</p>
        )}
        {siswa !== null && siswa.length > 0 && disaring.length === 0 && (
          <p className="text-sm text-slate-500">Tidak ada siswa yang cocok dengan &quot;{cari}&quot;.</p>
        )}
        {disaring.length > 0 && (
          <>
            <BilahHapusMassal
              jumlahDipilih={terpilih.length}
              jumlahSemua={idSemua.length}
              sedangHapus={lulus.sedangUbah}
              onPilihSemua={() => pilihan.aturBanyak(idSemua, true)}
              onBatal={pilihan.kosongkan}
              aksiLain={{ label: "Tandai lulus", onClick: () => lulus.ubah(terpilih, true) }}
            />
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th className="w-10">
                      <CentangSemuaHalaman
                        idHalaman={idHalaman}
                        dipilih={pilihan.dipilih}
                        onUbah={(nyala) => pilihan.aturBanyak(idHalaman, nyala)}
                      />
                    </Th>
                    <Th>Nama</Th>
                    <Th>NISN</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {halaman.map((s) => (
                    <Tr key={s.id} className={pilihan.dipilih.has(s.id) ? "bg-indigo-50/40" : undefined}>
                      <Td className="w-10">
                        <input
                          type="checkbox"
                          aria-label={`Pilih ${s.nama}`}
                          className="accent-indigo-600"
                          checked={pilihan.dipilih.has(s.id)}
                          onChange={() => pilihan.toggle(s.id)}
                        />
                      </Td>
                      <Td className="font-medium text-slate-900">{s.nama}</Td>
                      <Td className="font-mono text-xs">{s.nisn ?? "-"}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={disaring.length}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(ukuran) => {
                setPageSize(ukuran);
                setPage(1);
              }}
            />
          </>
        )}
      </Langkah>

      <Langkah nomor={2} judul="Tambahkan siswa baru">
        <p className="text-sm text-slate-600">
          Import siswa baru dari Excel atau tambahkan satu per satu. Siswa yang sudah ada tidak perlu diimpor ulang.
          {kuota?.seatQuota != null &&
            ` Sisa kursi di periode ini: ${Math.max(0, kuota.seatQuota - kuota.seatsUsed).toLocaleString("id-ID")}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowImport(true)}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4 text-indigo-600" />
            Import Excel
          </Button>
          <Link href="/admin-sekolah/siswa" className={buttonClassName("secondary")}>
            Tambah satu per satu
          </Link>
        </div>
        <ImportSiswaModal
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          onSuccess={() => setRefreshKey((k) => k + 1)}
          role="admin_sekolah"
        />
      </Langkah>

      <Langkah nomor={3} judul="Ajukan perpanjangan langganan">
        {perpanjangan === null ? (
          <TableSkeleton columns={2} />
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Siswa aktif saat ini: <span className="font-semibold text-slate-900">{perpanjangan.siswaAktif.toLocaleString("id-ID")}</span>.
              Isi kuota sesuai jumlah siswa yang akan memakai kursi. Admin pusat akan mengaktifkan periode setelah pembayaran
              dikonfirmasi.
            </p>

            {perpanjangan.terakhirDiproses?.status === "ditolak" && !perpanjangan.menunggu && (
              <Alert variant="warning">
                Permintaan terakhir ditolak admin pusat
                {perpanjangan.terakhirDiproses.catatanAdmin ? `: ${perpanjangan.terakhirDiproses.catatanAdmin}` : "."} Anda
                bisa mengajukan lagi di bawah.
              </Alert>
            )}

            {perpanjangan.menunggu ? (
              <Alert variant="info">
                Permintaan perpanjangan sudah diajukan pada {formatWIBDate(perpanjangan.menunggu.createdAt)}: kuota{" "}
                {perpanjangan.menunggu.kuotaDiminta.toLocaleString("id-ID")} siswa, periode{" "}
                {formatWIBDate(perpanjangan.menunggu.mulaiDiminta)} sampai {formatWIBDate(perpanjangan.menunggu.berakhirDiminta)}.
                Menunggu diproses admin pusat.
              </Alert>
            ) : (
              <form onSubmit={kirim} className="flex flex-col gap-4">
                {galat && <Alert variant="danger">{galat}</Alert>}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="pjMulai">Mulai</Label>
                    <Input
                      id="pjMulai"
                      type="date"
                      required
                      value={mulai}
                      onChange={(e) => setMulaiInput(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pjBerakhir">Berakhir</Label>
                    <Input
                      id="pjBerakhir"
                      type="date"
                      required
                      value={berakhir}
                      onChange={(e) => setBerakhirInput(e.target.value)}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={!mulai}
                        onClick={() => setBerakhirInput(tanggalAkhirPeriode(mulai, 6))}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                      >
                        Semester (6 bulan)
                      </button>
                      <button
                        type="button"
                        disabled={!mulai}
                        onClick={() => setBerakhirInput(tanggalAkhirPeriode(mulai, 12))}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                      >
                        Setahun (12 bulan)
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="pjKuota">Kuota kursi yang diminta</Label>
                    <Input
                      id="pjKuota"
                      type="number"
                      min={1}
                      max={100000}
                      required
                      value={kuotaDiminta}
                      onChange={(e) => setKuotaInput(e.target.value)}
                    />
                    {perpanjangan.kuotaTerakhir != null && (
                      <p className="mt-1 text-xs text-slate-500">
                        Kuota periode sebelumnya: {perpanjangan.kuotaTerakhir.toLocaleString("id-ID")}.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="pjCatatan">Catatan untuk admin pusat (opsional)</Label>
                    <Input
                      id="pjCatatan"
                      maxLength={500}
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={mengirim || !mulai || !berakhir} className="w-fit">
                  {mengirim ? "Mengirim..." : "Ajukan perpanjangan"}
                </Button>
              </form>
            )}
          </>
        )}
      </Langkah>
    </div>
  );
}
