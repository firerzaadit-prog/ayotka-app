"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Label, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { IconChart } from "@/components/ui/empty-state-icons";
import type { KesiapanPerSekolah } from "@/lib/analytics/global";
import { KESIAPAN_SUBJECTS } from "@/lib/analytics/kesiapan";

const selectClassName =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

function persentaseVariant(pct: number): "danger" | "warning" | "success" {
  if (pct < 60) return "danger";
  if (pct < 80) return "warning";
  return "success";
}

function PersentaseBadge({ pct, total }: { pct: number; total: number }) {
  if (total === 0) {
    return <span className="text-xs text-slate-400">Belum ada data</span>;
  }
  return <Badge variant={persentaseVariant(pct)}>{pct.toFixed(0)}%</Badge>;
}

/** Dashboard dinas pendidikan: kesiapan TKA lintas sekolah, akses baca saja. */
export default function DinasPendidikanDashboardPage() {
  const [jenjang, setJenjang] = useState("");
  const [wilayah, setWilayah] = useState("");
  const [perSekolah, setPerSekolah] = useState<KesiapanPerSekolah[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    const timeout = setTimeout(async () => {
      const qs = new URLSearchParams();
      if (jenjang) qs.set("jenjang", jenjang);
      if (wilayah) qs.set("wilayah", wilayah);
      const res = await fetch(`/api/dinas-pendidikan/kesiapan?${qs.toString()}`);
      const data = await res.json().catch(() => null);
      if (!ignore) {
        if (res.ok) {
          setPerSekolah(data.perSekolah ?? []);
          setError(null);
        } else {
          setError(data?.error ?? "Gagal memuat data kesiapan.");
        }
      }
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(timeout);
    };
  }, [jenjang, wilayah]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kesiapan TKA Antar Sekolah"
        description="Persentase kesiapan siswa menghadapi TKA di tiap sekolah, berdasarkan skor terbaik siswa dan kategori capaian resmi Kemendikdasmen (Kurang/Memadai/Baik/Istimewa)."
      />

      <Alert variant="info">
        Angka SD memakai standar resmi SMP karena Kemendikdasmen belum merilis rentang nilai
        resmi khusus SD — labelnya sama, cuma dokumen sumbernya masih menunggu terbit. IPA &amp;
        Bahasa Inggris (SMP) memakai standar kategori Bahasa Indonesia SMP - kedua mapel ini di
        luar cakupan resmi TKA, yang hanya menguji Matematika &amp; Bahasa Indonesia.
      </Alert>

      <div className="flex flex-wrap gap-4">
        <div>
          <Label htmlFor="filJenjang">Jenjang</Label>
          <select
            id="filJenjang"
            className={selectClassName}
            value={jenjang}
            onChange={(e) => setJenjang(e.target.value)}
          >
            <option value="">Semua jenjang</option>
            <option value="SD">SD</option>
            <option value="SMP">SMP</option>
          </select>
        </div>
        <div>
          <Label htmlFor="filWilayah">Cari alamat/wilayah</Label>
          <Input
            id="filWilayah"
            placeholder='mis. "Malang"'
            value={wilayah}
            onChange={(e) => setWilayah(e.target.value)}
            className="w-48"
          />
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {!error && perSekolah === null && <TableSkeleton columns={5} />}

      {!error && perSekolah !== null && perSekolah.length === 0 && (
        <EmptyState
          icon={<IconChart />}
          title="Belum ada data"
          description="Belum ada sekolah aktif yang cocok dengan filter ini."
        />
      )}

      {perSekolah && perSekolah.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Sekolah</Th>
                <Th>Jenjang</Th>
                <Th>Kesiapan Gabungan</Th>
                {KESIAPAN_SUBJECTS.map((nama) => (
                  <Th key={nama}>{nama}</Th>
                ))}
              </Tr>
            </Thead>
            <tbody>
              {perSekolah.map((s) => (
                <Tr key={s.schoolId}>
                  <Td className="font-medium text-slate-900">{s.nama}</Td>
                  <Td>{s.jenjang}</Td>
                  <Td>
                    <PersentaseBadge pct={s.gabungan.persentaseSiap} total={s.gabungan.total} />
                  </Td>
                  {s.perMapel.map((m) => (
                    <Td key={m.subjectNama}>
                      <PersentaseBadge pct={m.breakdown.persentaseSiap} total={m.breakdown.total} />
                    </Td>
                  ))}
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
