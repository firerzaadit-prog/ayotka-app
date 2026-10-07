"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Table, TableContainer, Td, Th, Thead, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { formatWIBHariTanggalJam } from "@/lib/utils/datetime";

type MapelRingkas = { jenjang: string; namaMapel: string; jumlah: number; adaNilaiNasional: number; rerataNasional: number | null };
type Ringkasan = {
  mapel: MapelRingkas[];
  totalIndikator: number;
  diperbaruiTerakhir: string | null;
  soal: { tertaut: number; diLuarResmi: number; tanpaIndikator: number };
};
type HasilUnggah = { total: number; dibuat: number; diperbarui: number; samaPersis: number; tidakAdaDiBerkas: number };
type PaketSinkron = {
  packageId: string;
  nama: string;
  kodeSumber: string;
  soal: number;
  sudahTertaut: number;
  terisiDariSumber: number;
  baruTertaut: number;
  diLuarResmi: number;
  tidakBisaDicocokkan: number;
  sumberTanpaIndikator: number;
  galatSumber: string | null;
};
type LaporanSinkron = {
  masterKosong: boolean;
  paket: PaketSinkron[];
  total: { soal: number; tertaut: number; baruTertaut: number; terisiDariSumber: number; diLuarResmi: number };
};

const MAKS_BYTE = 2_000_000;

/**
 * Master indikator resmi Pusmendik Kemendikdasmen (berikut rerata nasionalnya) untuk rapor daya serap per indikator.
 * Admin pusat mengunggah berkas kemendikdasmen-official.json milik generator soal.ayotka.id, lalu mencocokkan soal yang
 * sudah diimpor. Soal baru otomatis dicocokkan saat diimpor.
 */
export default function IndikatorResmiPage() {
  const toast = useToast();
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [berkasNama, setBerkasNama] = useState<string | null>(null);
  const [isiBerkas, setIsiBerkas] = useState<string | null>(null);
  const [jumlahBaris, setJumlahBaris] = useState<number | null>(null);
  const [galatBerkas, setGalatBerkas] = useState<string[]>([]);
  const [mengunggah, setMengunggah] = useState(false);
  const [hasilUnggah, setHasilUnggah] = useState<HasilUnggah | null>(null);
  const [menyinkron, setMenyinkron] = useState(false);
  const [laporan, setLaporan] = useState<LaporanSinkron | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Muat ulang setelah unggah/pencocokan (dipanggil dari penangan klik, bukan dari efek).
  async function muat() {
    const res = await fetch("/api/admin-pusat/indikator");
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Gagal memuat data indikator.");
      return;
    }
    setError(null);
    setRingkasan(data.ringkasan);
  }

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/indikator");
      const data = await res.json().catch(() => null);
      if (ignore) return;
      if (!res.ok) {
        setError(data?.error ?? "Gagal memuat data indikator.");
        return;
      }
      setRingkasan(data.ringkasan);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function pilihBerkas(e: React.ChangeEvent<HTMLInputElement>) {
    const berkas = e.target.files?.[0];
    setHasilUnggah(null);
    setGalatBerkas([]);
    setIsiBerkas(null);
    setJumlahBaris(null);
    setBerkasNama(berkas?.name ?? null);
    if (!berkas) return;
    if (berkas.size > MAKS_BYTE) {
      setGalatBerkas(["Berkas terlalu besar (maksimal 2 MB)."]);
      return;
    }
    const teks = await berkas.text();
    try {
      const isi: unknown = JSON.parse(teks);
      if (!Array.isArray(isi)) {
        setGalatBerkas(["Isi berkas harus berupa larik (array) indikator, seperti kemendikdasmen-official.json."]);
        return;
      }
      setJumlahBaris(isi.length);
      setIsiBerkas(teks);
    } catch {
      setGalatBerkas(["Berkas bukan JSON yang valid."]);
    }
  }

  async function unggah() {
    if (!isiBerkas) return;
    setMengunggah(true);
    setGalatBerkas([]);
    setHasilUnggah(null);
    const res = await fetch("/api/admin-pusat/indikator/master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: isiBerkas,
    });
    const data = await res.json().catch(() => null);
    setMengunggah(false);
    if (!res.ok) {
      setGalatBerkas(data?.galat?.length ? data.galat : [data?.error ?? "Gagal mengunggah master."]);
      toast.error(data?.error ?? "Gagal mengunggah master.");
      return;
    }
    setHasilUnggah(data.hasil);
    toast.success("Master indikator tersimpan.");
    setBerkasNama(null);
    setIsiBerkas(null);
    setJumlahBaris(null);
    if (inputRef.current) inputRef.current.value = "";
    await muat();
  }

  async function sinkron() {
    setMenyinkron(true);
    setLaporan(null);
    const res = await fetch("/api/admin-pusat/indikator/sinkron", { method: "POST" });
    const data = await res.json().catch(() => null);
    setMenyinkron(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Gagal mencocokkan soal.");
      return;
    }
    setLaporan(data.laporan);
    if (data.laporan.masterKosong) toast.error("Unggah master indikator dulu.");
    else toast.success("Pencocokan selesai.");
    await muat();
  }

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!ringkasan) return <PageSkeleton />;

  const adaMaster = ringkasan.totalIndikator > 0;
  const totalSoal = ringkasan.soal.tertaut + ringkasan.soal.diLuarResmi + ringkasan.soal.tanpaIndikator;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Indikator Resmi"
        description="Indikator resmi Pusmendik Kemendikdasmen beserta rerata nasionalnya, dasar rapor daya serap per indikator di rapor siswa dan laporan sekolah."
      />

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Master indikator</h2>
          {ringkasan.diperbaruiTerakhir && (
            <span className="text-xs text-slate-500">Diperbarui {formatWIBHariTanggalJam(ringkasan.diperbaruiTerakhir)}</span>
          )}
        </div>
        {adaMaster ? (
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Jenjang</Th>
                  <Th>Mata pelajaran</Th>
                  <Th>Indikator</Th>
                  <Th>Punya rerata nasional</Th>
                  <Th>Rerata nasional</Th>
                </Tr>
              </Thead>
              <tbody>
                {ringkasan.mapel.map((m) => (
                  <Tr key={`${m.jenjang}|${m.namaMapel}`}>
                    <Td>{m.jenjang}</Td>
                    <Td className="font-medium text-slate-900">{m.namaMapel}</Td>
                    <Td>{m.jumlah}</Td>
                    <Td>
                      {m.adaNilaiNasional}/{m.jumlah}
                    </Td>
                    <Td>{m.rerataNasional === null ? "-" : `${m.rerataNasional.toFixed(1)}%`}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        ) : (
          <Alert variant="warning">
            Master indikator belum diunggah. Tanpa master, rapor per indikator belum bisa ditampilkan dan soal yang diimpor belum
            bisa dicocokkan.
          </Alert>
        )}
        <p className="mt-2 text-xs text-slate-500">SMA tersimpan di master tetapi belum dipakai (AyoTKA belum punya mapel SMA).</p>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Unggah master</h2>
        <p className="mb-3 text-sm text-slate-500">
          Pilih berkas <span className="font-mono text-xs">kemendikdasmen-official.json</span> (ada di repositori generator soal.ayotka.id,
          folder <span className="font-mono text-xs">src/lib/taxonomy</span>). Mengunggah ulang aman: nilai nasional dan hierarki diperbarui,
          tidak ada indikator yang dihapus.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            onChange={pilihBerkas}
            className="text-sm text-slate-700 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
          />
          <Button onClick={unggah} disabled={!isiBerkas || mengunggah}>
            {mengunggah ? "Mengunggah..." : "Unggah"}
          </Button>
        </div>
        {berkasNama && jumlahBaris !== null && (
          <p className="mt-2 text-xs text-slate-500">
            {berkasNama}: {jumlahBaris} indikator terbaca, siap diunggah.
          </p>
        )}
        {galatBerkas.length > 0 && (
          <Alert variant="danger" className="mt-3">
            <p className="font-medium">Berkas tidak diterima, tidak ada yang disimpan:</p>
            <ul className="mt-1 list-disc pl-5">
              {galatBerkas.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </Alert>
        )}
        {hasilUnggah && (
          <Alert variant="success" className="mt-3">
            {hasilUnggah.total} indikator diproses: <strong>{hasilUnggah.dibuat}</strong> baru, <strong>{hasilUnggah.diperbarui}</strong>{" "}
            diperbarui, {hasilUnggah.samaPersis} sama persis
            {hasilUnggah.tidakAdaDiBerkas > 0 && <>, {hasilUnggah.tidakAdaDiBerkas} ada di sistem tetapi tidak ada di berkas ini (dibiarkan)</>}.
            Berikutnya: cocokkan soal yang sudah diimpor.
          </Alert>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Soal di Bank Soal</h2>
            <p className="text-sm text-slate-500">
              Soal baru otomatis dicocokkan saat diimpor. Tombol ini untuk soal yang diimpor sebelum fitur ini ada, atau setelah master
              diperbarui. Aman diulang; yang sudah terisi tidak ditimpa.
            </p>
          </div>
          <Button variant="secondary" onClick={sinkron} disabled={menyinkron || !adaMaster}>
            {menyinkron ? "Mencocokkan..." : "Cocokkan soal yang sudah diimpor"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">{ringkasan.soal.tertaut} soal tertaut ke indikator resmi</Badge>
          <Badge variant="neutral">{ringkasan.soal.diLuarResmi} di luar indikator resmi</Badge>
          <Badge variant="neutral">{ringkasan.soal.tanpaIndikator} tanpa indikator</Badge>
          <Badge variant="info">{totalSoal} soal seluruhnya</Badge>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Hanya soal yang tertaut ke indikator resmi yang ikut hitungan daya serap per indikator. Soal buatan sendiri atau dari Excel
          tidak punya indikator.
        </p>

        {laporan && laporan.masterKosong && (
          <Alert variant="warning" className="mt-3">
            Master belum diunggah, tidak ada yang diproses.
          </Alert>
        )}
        {laporan && !laporan.masterKosong && (
          <div className="mt-4 flex flex-col gap-3">
            <Alert variant="success">
              {laporan.paket.length} paket diperiksa. <strong>{laporan.total.baruTertaut}</strong> soal baru tertaut,{" "}
              {laporan.total.terisiDariSumber} soal terisi indikatornya dari sumber; total tertaut sekarang {laporan.total.tertaut} dari{" "}
              {laporan.total.soal} soal.
            </Alert>
            {laporan.paket.some((p) => p.galatSumber) && (
              <Alert variant="warning">
                Sebagian paket tidak bisa membaca soal sumbernya (lihat kolom Catatan). Coba lagi nanti; paket lain tetap diproses.
              </Alert>
            )}
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Paket</Th>
                    <Th>Soal</Th>
                    <Th>Tertaut</Th>
                    <Th>Baru tertaut</Th>
                    <Th>Di luar resmi</Th>
                    <Th>Catatan</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {laporan.paket.map((p) => (
                    <Tr key={p.packageId}>
                      <Td className="font-medium text-slate-900">
                        {p.nama}
                        <span className="block text-xs font-normal text-slate-400">{p.kodeSumber}</span>
                      </Td>
                      <Td>{p.soal}</Td>
                      <Td>{p.sudahTertaut + p.baruTertaut}</Td>
                      <Td>{p.baruTertaut}</Td>
                      <Td>{p.diLuarResmi}</Td>
                      <Td className="text-xs text-slate-500">
                        {p.galatSumber
                          ? `Sumber tidak terbaca: ${p.galatSumber}`
                          : [
                              p.tidakBisaDicocokkan > 0 ? `${p.tidakBisaDicocokkan} soal tidak ditemukan/ambigu di sumber` : null,
                              p.sumberTanpaIndikator > 0 ? `${p.sumberTanpaIndikator} soal tanpa indikator di sumber` : null,
                            ]
                              .filter(Boolean)
                              .join("; ") || "-"}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
