"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PersetujuanDaftar } from "@/components/auth/persetujuan-daftar";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { KirimUlangKonfirmasi } from "@/components/auth/kirim-ulang-konfirmasi";
import { bentukKodeValid, normalizeKodeReferral } from "@/lib/registrasi/referral-format";
import { PilihStatusSekolah, PilihWilayah } from "@/components/wilayah/pilih-wilayah";
import { labelStatusSekolah } from "@/lib/wilayah";
import { bentukDataAsalSekolah, perluLengkapiSekolahBaru, rapikanNamaSekolah } from "@/lib/registrasi/asal-sekolah";

type SchoolOption = {
  id: string;
  nama: string;
  npsn: string | null;
  kabupatenKota?: string | null;
  statusSekolah?: "negeri" | "swasta" | null;
};

function RegistrasiMandiriForm() {
  const searchParams = useSearchParams();
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [jenjang, setJenjang] = useState<"SD" | "SMP">("SD");
  const [kodeReferral, setKodeReferral] = useState(searchParams.get("ref") ?? "");
  // Hasil cek kode disimpan bersama kode yang dicek; ditampilkan hanya kalau masih sama dengan isian saat ini
  // (jadi tidak perlu di-reset saat isian berubah, dan hasil lama tidak pernah menempel di kode baru).
  const [cekKode, setCekKode] = useState<{
    kode: string;
    tipe: "voucher" | null;
    status?: "unused" | "used" | "expired" | "void";
    paket?: string;
    mitra?: string;
  } | null>(null);
  const kodeBersih = normalizeKodeReferral(kodeReferral);

  // Satu kolom "Asal sekolah": yang dipilih dari daftar dipakai sebagai sekolah terdaftar; bila tidak ada yang dipilih,
  // nama yang diketik langsung dipakai sebagai sekolah baru (tanpa tombol tambahan) dan kota/kabupaten + negeri/swasta
  // muncul otomatis di bawahnya. Lihat namaSekolahDiketik / pakaiNamaDiketik di bawah.
  const [sekolahQuery, setSekolahQuery] = useState("");
  const [sekolahHasil, setSekolahHasil] = useState<SchoolOption[]>([]);
  const [selectedSekolah, setSelectedSekolah] = useState<SchoolOption | null>(null);
  const [asalProvinsi, setAsalProvinsi] = useState("");
  const [asalKabupatenKota, setAsalKabupatenKota] = useState("");
  const [asalStatus, setAsalStatus] = useState("");
  const [sudahMencari, setSudahMencari] = useState(false);
  // Pencarian ditunda sebentar dan jawaban yang sudah basi (diketik lagi sebelum jawaban datang) dibuang, supaya daftar
  // tidak melompat ke hasil kata yang lebih lama.
  const urutanCariRef = useRef(0);
  const timerCariRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerCariRef.current) clearTimeout(timerCariRef.current);
    },
    [],
  );

  function cariSekolah(nilai: string, jenjangDipakai: "SD" | "SMP") {
    if (timerCariRef.current) clearTimeout(timerCariRef.current);
    const urutan = ++urutanCariRef.current;
    if (nilai.trim().length < 3) {
      setSekolahHasil([]);
      setSudahMencari(false);
      return;
    }
    timerCariRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/registrasi/cari-sekolah?q=${encodeURIComponent(nilai)}&jenjang=${jenjangDipakai}`);
        const data = await res.json().catch(() => null);
        if (urutan !== urutanCariRef.current) return;
        if (res.ok && data) {
          setSekolahHasil(data.schools ?? []);
          setSudahMencari(true);
        }
      } catch {
        // Pencarian hanya bantuan: pendaftaran tetap bisa dengan nama sekolah yang diketik.
      }
    }, 250);
  }

  function handleGantiJenjang(nilai: "SD" | "SMP") {
    setJenjang(nilai);
    // Sekolah terpilih milik jenjang sebelumnya tidak berlaku lagi; teks yang diketik dipertahankan dan dicari ulang
    // untuk jenjang baru.
    setSelectedSekolah(null);
    setSekolahHasil([]);
    setSudahMencari(false);
    cariSekolah(sekolahQuery, nilai);
  }

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // Terisi kalau akun sudah dibuat tapi email konfirmasi belum terkirim.
  const [emailPesan, setEmailPesan] = useState<string | null>(null);

  useEffect(() => {
    if (!bentukKodeValid(kodeBersih)) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/registrasi/cek-referral?kode=${encodeURIComponent(kodeBersih)}`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          tipe: "voucher" | null;
          status?: "unused" | "used" | "expired" | "void";
          paket?: string;
          mitra?: string;
        };
        setCekKode({ kode: kodeBersih, ...json });
      } catch {
        // Cek hanya bantuan; pendaftaran tetap jalan tanpa hasilnya.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [kodeBersih]);

  const hasilCek = cekKode && cekKode.kode === kodeBersih ? cekKode : null;

  function handleCariSekolah(value: string) {
    setSekolahQuery(value);
    setSelectedSekolah(null);
    cariSekolah(value, jenjang);
  }

  // Nama yang diketik, dirapikan (spasi ganda dibuang). Dipakai sebagai nama sekolah bila tidak ada yang dipilih dari daftar.
  const namaSekolahDiketik = rapikanNamaSekolah(sekolahQuery);
  const pakaiNamaDiketik = perluLengkapiSekolahBaru(selectedSekolah?.id ?? null, sekolahQuery);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (loading) return;

    // Tanpa sekolah yang dipilih dari daftar, nama yang diketik langsung dipakai (tanpa tombol tambahan).
    const asal = bentukDataAsalSekolah({
      dipilihId: selectedSekolah?.id ?? null,
      teksDiketik: sekolahQuery,
      provinsi: asalProvinsi,
      kabupatenKota: asalKabupatenKota,
      status: asalStatus,
    });
    if (!asal.ok) {
      setError(asal.error);
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/registrasi/mandiri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama,
          email,
          password,
          jenjang,
          ...asal.data,
          kodeReferral,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Gagal mendaftar. Coba lagi sebentar lagi.");
        return;
      }
      setEmailPesan(data?.emailTerkirim === false ? (data?.pesan ?? "Email konfirmasi belum terkirim.") : null);
      setDone(true);
    } catch {
      setError("Koneksi bermasalah. Periksa internetmu lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          {emailPesan ? "Akunmu sudah dibuat" : "Cek email kamu"}
        </h1>
        {emailPesan ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{emailPesan}</p>
        ) : (
          <p className="text-sm text-slate-600">
            Kami sudah mengirim link verifikasi ke {email}. Klik link itu untuk mengaktifkan
            akunmu, lalu masuk ke AyoTKA. Belum masuk? Cek juga folder spam.
          </p>
        )}
        <KirimUlangKonfirmasi email={email} />
        <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">
          Kembali ke halaman masuk
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Daftar - Siswa Mandiri</h1>
        <p className="text-sm font-medium text-slate-700">Gratis*</p>
        <p className="mt-0.5 text-xs text-slate-500">
          *Gratis untuk 1x Try Out per mata pelajaran. Paket Bulanan atau Semester tersedia bila kamu ingin latihan lebih banyak.
        </p>
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <Label htmlFor="nama">Nama lengkap</Label>
        <Input id="nama" required value={nama} onChange={(e) => setNama(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="jenjang">Jenjang sekolah</Label>
        <select
          id="jenjang"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={jenjang}
          onChange={(e) => handleGantiJenjang(e.target.value as "SD" | "SMP")}
        >
          <option value="SD">SD</option>
          <option value="SMP">SMP</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Jenjang menentukan try out dan mata pelajaran yang tampil setelah kamu masuk.
        </p>
      </div>

      <div>
        <Label htmlFor="asalSekolah">Asal sekolah</Label>
        <Input
          id="asalSekolah"
          required
          minLength={3}
          maxLength={120}
          autoComplete="off"
          aria-describedby="asalSekolahInfo"
          value={sekolahQuery}
          onChange={(e) => handleCariSekolah(e.target.value)}
        />
        {sekolahHasil.length > 0 && !selectedSekolah && (
          <div className="mt-1 flex flex-col gap-1 rounded-md border border-slate-200" data-daftar-sekolah>
            {sekolahHasil.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedSekolah(s);
                  setSekolahQuery(s.nama);
                  setSekolahHasil([]);
                }}
                className="px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                {s.nama}
                {(s.kabupatenKota || s.statusSekolah) && (
                  <span className="block text-xs text-slate-500">
                    {[s.kabupatenKota, s.statusSekolah ? labelStatusSekolah(s.statusSekolah) : null].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        <p id="asalSekolahInfo" className="mt-1 text-xs text-slate-500" data-info-asal-sekolah>
          {selectedSekolah
            ? "Sekolah dipilih dari daftar."
            : "Ketik nama sekolahmu lalu pilih dari daftar yang muncul. Kalau sekolahmu tidak ada di daftar, tidak perlu menekan apa pun: nama yang kamu ketik langsung dipakai dan akunmu langsung bisa dipakai."}
        </p>

        {pakaiNamaDiketik && (
          <div className="mt-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3" data-blok-sekolah-baru>
            <p className="text-sm text-slate-700">
              {sudahMencari && sekolahHasil.length === 0 ? "Sekolah itu belum ada di daftar kami. " : "Tidak memilih dari daftar? "}
              <span className="font-semibold text-slate-900">&quot;{namaSekolahDiketik}&quot;</span> akan dipakai sebagai asal sekolahmu. Lengkapi dua isian di bawah ini
              lalu langsung daftar; tanpa menunggu verifikasi admin.
            </p>
            <PilihWilayah
              idAwalan="asalSekolah"
              provinsi={asalProvinsi}
              kabupatenKota={asalKabupatenKota}
              onChange={(w) => {
                setAsalProvinsi(w.provinsi);
                setAsalKabupatenKota(w.kabupatenKota);
              }}
              wajib
              labelProvinsi="Provinsi sekolahmu"
              labelKabupatenKota="Kota/Kabupaten sekolahmu"
              kosongProvinsi="Pilih provinsi"
              kosongKabupatenKota="Pilih kota/kabupaten"
            />
            <PilihStatusSekolah id="asalSekolahStatus" value={asalStatus} onChange={setAsalStatus} wajib label="Sekolahmu negeri atau swasta?" />
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="kodeReferral">Kode voucher mitra (opsional)</Label>
        <Input
          id="kodeReferral"
          placeholder="Contoh: AB12CD34EF"
          autoCapitalize="characters"
          value={kodeReferral}
          onChange={(e) => setKodeReferral(e.target.value)}
          aria-describedby="kodeReferralInfo"
          className="font-mono uppercase tracking-wider"
        />
        <div id="kodeReferralInfo" aria-live="polite" className="mt-1.5 text-xs">
          {hasilCek?.tipe === "voucher" && hasilCek.status === "unused" && (
            <p className="font-medium text-emerald-700">
              Kode voucher dikenali: {hasilCek.paket}, dari mitra {hasilCek.mitra}. Begitu daftar, akunmu langsung
              berlangganan tanpa bayar.
            </p>
          )}
          {hasilCek?.tipe === "voucher" && hasilCek.status === "used" && (
            <p className="font-medium text-amber-700">
              Kode voucher ini sudah dipakai. Minta kode lain ke mitramu.
            </p>
          )}
          {hasilCek?.tipe === "voucher" && (hasilCek.status === "expired" || hasilCek.status === "void") && (
            <p className="font-medium text-amber-700">
              Kode voucher ini sudah tidak berlaku. Minta kode baru ke mitramu.
            </p>
          )}
          {hasilCek && hasilCek.tipe === null && (
            <p className="font-medium text-amber-700">
              Kode ini tidak dikenali. Periksa lagi penulisannya, atau kosongkan kolom ini kalau kamu tidak punya kode.
            </p>
          )}
          <p className={`leading-relaxed text-slate-500 ${hasilCek ? "mt-1" : ""}`}>
            Dapat kode voucher dari mitra (sekolah atau lembaga yang bekerja sama dengan AyoTKA)? Tulis kodenya di
            sini: akunmu langsung berlangganan tanpa bayar, dan tiap kode hanya bisa dipakai satu siswa. Kalau sudah
            punya akun, kode voucher bisa ditukar di menu Langganan &amp; Voucher.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Memproses..." : "Daftar sebagai Siswa Mandiri"}
      </Button>
      <PersetujuanDaftar />

      <div className="flex flex-col items-center gap-2 pt-1 text-center">
        <p className="text-sm text-slate-600">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
            Masuk di sini
          </Link>
        </p>
        <Link href="/registrasi" className="text-xs text-slate-400 hover:text-slate-600">
          &larr; Kembali ke pilihan pendaftaran
        </Link>
      </div>
    </form>
  );
}

export default function RegistrasiMandiriPage() {
  return (
    <Suspense fallback={null}>
      <RegistrasiMandiriForm />
    </Suspense>
  );
}
