"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { PageSkeleton } from "@/components/ui/skeleton";
import { PilihStatusSekolah, PilihWilayah } from "@/components/wilayah/pilih-wilayah";

type Profil = {
  nama: string;
  npsn: string | null;
  jenjang: "SD" | "SMP";
  alamat: string | null;
  provinsi: string | null;
  kabupatenKota: string | null;
  statusSekolah: "negeri" | "swasta" | null;
};

/**
 * Profil sekolah: admin sekolah melengkapi alamat, provinsi, kota/kabupaten, dan status negeri/swasta sekolahnya.
 * Nama, NPSN, dan jenjang hanya bisa diubah admin pusat. Data wilayah dan status dipakai untuk memetakan nilai sekolah
 * per wilayah dan jenis sekolah di laporan.
 */
export default function ProfilSekolahPage() {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [alamat, setAlamat] = useState("");
  const [provinsi, setProvinsi] = useState("");
  const [kabupatenKota, setKabupatenKota] = useState("");
  const [statusSekolah, setStatusSekolah] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [gagalMuat, setGagalMuat] = useState<string | null>(null);

  function isiForm(p: Profil) {
    setProfil(p);
    setAlamat(p.alamat ?? "");
    setProvinsi(p.provinsi ?? "");
    setKabupatenKota(p.kabupatenKota ?? "");
    setStatusSekolah(p.statusSekolah ?? "");
  }

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch("/api/admin-sekolah/profil");
      const data = await res.json().catch(() => null);
      if (ignore) return;
      if (res.ok && data?.school) isiForm(data.school);
      else setGagalMuat(data?.error ?? "Profil sekolah belum bisa dimuat.");
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBerhasil(false);
    setMenyimpan(true);
    const res = await fetch("/api/admin-sekolah/profil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alamat, provinsi, kabupatenKota, statusSekolah }),
    });
    const data = await res.json().catch(() => null);
    setMenyimpan(false);
    if (!res.ok) {
      setError(data?.error ?? "Gagal menyimpan profil sekolah.");
      return;
    }
    isiForm(data.school);
    setBerhasil(true);
  }

  if (gagalMuat) return <Alert variant="danger">{gagalMuat}</Alert>;
  if (!profil) return <PageSkeleton />;

  const lengkap = Boolean(profil.provinsi && profil.kabupatenKota && profil.statusSekolah);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Profil Sekolah"
        description="Lengkapi wilayah dan status sekolah supaya nilai sekolahmu bisa dipetakan dan dibandingkan per provinsi, kota/kabupaten, dan jenis sekolah (negeri/swasta)."
      />

      {!lengkap && (
        <Alert variant="warning">
          Data sekolah belum lengkap: pilih provinsi, kota/kabupaten, dan status sekolah, lalu simpan. Selama belum lengkap,
          sekolahmu belum muncul di dashboard dinas pendidikan wilayahnya dan laporan belum bisa memakai pembanding wilayah.
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        {error && <Alert variant="danger">{error}</Alert>}
        {berhasil && <Alert variant="success">Profil sekolah tersimpan.</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="profilNama">Nama sekolah</Label>
            <Input id="profilNama" value={profil.nama} disabled readOnly />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="profilJenjang">Jenjang</Label>
              <Input id="profilJenjang" value={profil.jenjang} disabled readOnly />
            </div>
            <div>
              <Label htmlFor="profilNpsn">NPSN</Label>
              <Input id="profilNpsn" value={profil.npsn ?? "-"} disabled readOnly />
            </div>
          </div>
        </div>
        <p className="-mt-2 text-xs text-slate-500">Nama, jenjang, dan NPSN diubah oleh Admin Pusat AyoTKA.</p>

        <div>
          <Label htmlFor="profilAlamat">Alamat (opsional)</Label>
          <Input id="profilAlamat" value={alamat} maxLength={300} onChange={(e) => setAlamat(e.target.value)} />
        </div>

        <PilihWilayah
          idAwalan="profilSekolah"
          provinsi={provinsi}
          kabupatenKota={kabupatenKota}
          onChange={(w) => {
            setProvinsi(w.provinsi);
            setKabupatenKota(w.kabupatenKota);
          }}
        />

        <div className="sm:max-w-xs">
          <PilihStatusSekolah id="profilStatus" value={statusSekolah} onChange={setStatusSekolah} />
        </div>

        <Button type="submit" disabled={menyimpan} className="w-fit">
          {menyimpan ? "Menyimpan..." : "Simpan profil"}
        </Button>
      </form>
    </div>
  );
}
