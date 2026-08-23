"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type Step = "kode" | "nama" | "verifikasi";
type StudentOption = { id: string; nama: string };

export default function RegistrasiSekolahPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("kode");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [kodeSekolah, setKodeSekolah] = useState("");
  const [namaSekolah, setNamaSekolah] = useState("");

  const [nama, setNama] = useState("");
  const [hasil, setHasil] = useState<StudentOption[]>([]);
  const [selected, setSelected] = useState<StudentOption | null>(null);

  const [verifMode, setVerifMode] = useState<"kode" | "tanggal">("kode");
  const [kodeKlaim, setKodeKlaim] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [punyaEmail, setPunyaEmail] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleCekKode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/registrasi/cek-kode-sekolah", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kodeSekolah }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Kode sekolah tidak valid.");
      return;
    }
    setNamaSekolah(data.nama);
    setStep("nama");
  }

  async function handleCariNama(value: string) {
    setNama(value);
    setSelected(null);
    if (value.trim().length < 3) {
      setHasil([]);
      return;
    }
    const res = await fetch(
      `/api/registrasi/cari-siswa?kodeSekolah=${encodeURIComponent(kodeSekolah)}&nama=${encodeURIComponent(value)}`,
    );
    const data = await res.json();
    if (res.ok) setHasil(data.students ?? []);
  }

  async function handleSubmitKlaim(e: FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError("Pilih namamu dari daftar dulu.");
      return;
    }
    setError(null);
    setLoading(true);

    const res = await fetch("/api/registrasi/klaim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kodeSekolah,
        studentId: selected.id,
        kodeKlaim: verifMode === "kode" ? kodeKlaim : undefined,
        tanggalLahir: verifMode === "tanggal" ? tanggalLahir : undefined,
        punyaEmail,
        email,
        password,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal mendaftar.");
      return;
    }
    router.push(data.redirectTo ?? "/siswa/dashboard");
    router.refresh();
  }

  if (step === "kode") {
    return (
      <form onSubmit={handleCekKode} className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Daftar - Siswa Sekolah</h1>
          <p className="text-sm text-slate-500">Masukkan Kode Sekolah yang diberikan admin sekolahmu.</p>
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div>
          <Label htmlFor="kodeSekolah">Kode Sekolah</Label>
          <Input
            id="kodeSekolah"
            required
            value={kodeSekolah}
            onChange={(e) => setKodeSekolah(e.target.value.toUpperCase())}
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Memeriksa..." : "Lanjut"}
        </Button>
        <Link href="/registrasi" className="text-center text-sm text-slate-500 hover:text-slate-700">
          Kembali
        </Link>
      </form>
    );
  }

  if (step === "nama") {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Cari namamu</h1>
          <p className="text-sm text-slate-500">
            Kamu mendaftar di <strong>{namaSekolah}</strong>, benar?
          </p>
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div>
          <Label htmlFor="nama">Nama lengkap (ketik minimal 3 huruf)</Label>
          <Input id="nama" value={nama} onChange={(e) => handleCariNama(e.target.value)} />
        </div>
        {hasil.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md border border-slate-200">
            {hasil.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s)}
                className={`px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  selected?.id === s.id ? "bg-slate-100 font-medium" : ""
                }`}
              >
                {s.nama}
              </button>
            ))}
          </div>
        )}
        {nama.trim().length >= 3 && hasil.length === 0 && (
          <p className="text-sm text-slate-500">
            Nama tidak ditemukan atau sudah pernah diklaim. Hubungi admin sekolahmu.
          </p>
        )}
        <Button type="button" disabled={!selected} onClick={() => setStep("verifikasi")} className="w-full">
          Ini aku
        </Button>
        <button
          type="button"
          onClick={() => setStep("kode")}
          className="text-center text-sm text-slate-500 hover:text-slate-700"
        >
          Kembali
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitKlaim} className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Verifikasi & buat akun</h1>
        <p className="text-sm text-slate-500">
          Halo, <strong>{selected?.nama}</strong>. Buktikan ini kamu, lalu buat password.
        </p>
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={verifMode === "kode"}
            onChange={() => setVerifMode("kode")}
          />
          Kode klaim
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={verifMode === "tanggal"}
            onChange={() => setVerifMode("tanggal")}
          />
          Tanggal lahir
        </label>
      </div>

      {verifMode === "kode" ? (
        <div>
          <Label htmlFor="kodeKlaim">Kode klaim (dari wali kelas)</Label>
          <Input id="kodeKlaim" required value={kodeKlaim} onChange={(e) => setKodeKlaim(e.target.value)} />
        </div>
      ) : (
        <div>
          <Label htmlFor="tanggalLahir">Tanggal lahir</Label>
          <Input
            id="tanggalLahir"
            type="date"
            required
            value={tanggalLahir}
            onChange={(e) => setTanggalLahir(e.target.value)}
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={punyaEmail} onChange={(e) => setPunyaEmail(e.target.checked)} />
        Saya punya email
      </label>

      {punyaEmail && (
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      )}
      {!punyaEmail && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Tidak punya email? Akunmu akan pakai NISN sebagai pengganti - pastikan NISN-mu sudah terdaftar
          admin sekolah.
        </p>
      )}

      <div>
        <Label htmlFor="password">Buat password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Memproses..." : "Buat akun"}
      </Button>
      <button
        type="button"
        onClick={() => setStep("nama")}
        className="text-center text-sm text-slate-500 hover:text-slate-700"
      >
        Kembali
      </button>
    </form>
  );
}
