/**
 * Pembuat berkas ZIP sederhana (tanpa kompresi, "store") untuk mengunduh banyak rapor PDF sekaligus. PDF sudah terkompresi,
 * jadi menyimpannya apa adanya tidak merugikan, dan penulis ini tidak butuh pustaka tambahan. Murni (hanya Uint8Array),
 * jadi jalan di peramban maupun server dan bisa diuji. Nama berkas ditulis UTF-8 (bendera bit 11). Batas format ZIP biasa
 * (bukan ZIP64): paling banyak 65.535 berkas dan 4 GB.
 */
export type BerkasZip = { nama: string; isi: Uint8Array };

const MAKS_BERKAS = 0xffff;
const MAKS_BYTE = 0xffffffff;

let tabelCrc: Uint32Array | null = null;

function crc32(data: Uint8Array): number {
  if (!tabelCrc) {
    tabelCrc = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabelCrc[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = tabelCrc[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Tanggal dan jam gaya MS-DOS (ketelitian 2 detik, tahun mulai 1980). */
function waktuDos(d: Date): { jam: number; tanggal: number } {
  const tahun = Math.min(2107, Math.max(1980, d.getFullYear()));
  return {
    jam: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    tanggal: ((tahun - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Nama berkas aman di dalam ZIP: tanpa jalur, tanpa karakter kendali, tidak kosong, paling panjang 150 karakter. */
export function bersihkanNamaZip(nama: string): string {
  const bersih = nama
    .replace(/[\\/]+/g, "-")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 150);
  return bersih || "berkas";
}

/** Nama yang sama diberi nomor ("a.pdf", "a (2).pdf", "a (3).pdf") tanpa membedakan huruf besar kecil. Urutan tetap. */
export function namaUnik(daftar: string[]): string[] {
  const dipakai = new Set<string>();
  const hitung = new Map<string, number>();
  return daftar.map((nama) => {
    const dasar = bersihkanNamaZip(nama);
    const kunci = dasar.toLowerCase();
    if (!dipakai.has(kunci)) {
      dipakai.add(kunci);
      return dasar;
    }
    const titik = dasar.lastIndexOf(".");
    const [kepala, ekor] = titik > 0 ? [dasar.slice(0, titik), dasar.slice(titik)] : [dasar, ""];
    let n = hitung.get(kunci) ?? 1;
    let kandidat: string;
    do {
      n++;
      kandidat = `${kepala} (${n})${ekor}`;
    } while (dipakai.has(kandidat.toLowerCase()));
    hitung.set(kunci, n);
    dipakai.add(kandidat.toLowerCase());
    return kandidat;
  });
}

export function buatZip(berkas: BerkasZip[], waktu: Date = new Date()): Uint8Array {
  if (berkas.length > MAKS_BERKAS) throw new Error(`ZIP memuat paling banyak ${MAKS_BERKAS} berkas.`);
  const penyandi = new TextEncoder();
  const { jam, tanggal } = waktuDos(waktu);

  const bagian: Uint8Array[] = [];
  const direktori: Uint8Array[] = [];
  let posisi = 0;

  for (const b of berkas) {
    const nama = penyandi.encode(b.nama);
    if (nama.length > 0xffff) throw new Error("Nama berkas terlalu panjang.");
    const crc = crc32(b.isi);
    const ukuran = b.isi.length;
    if (ukuran > MAKS_BYTE) throw new Error("Berkas terlalu besar untuk ZIP.");

    const lokal = new Uint8Array(30 + nama.length);
    const v = new DataView(lokal.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true); // versi minimal
    v.setUint16(6, 0x0800, true); // nama UTF-8
    v.setUint16(8, 0, true); // tanpa kompresi
    v.setUint16(10, jam, true);
    v.setUint16(12, tanggal, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, ukuran, true);
    v.setUint32(22, ukuran, true);
    v.setUint16(26, nama.length, true);
    v.setUint16(28, 0, true);
    lokal.set(nama, 30);

    const pusat = new Uint8Array(46 + nama.length);
    const p = new DataView(pusat.buffer);
    p.setUint32(0, 0x02014b50, true);
    p.setUint16(4, 20, true); // dibuat dengan versi
    p.setUint16(6, 20, true);
    p.setUint16(8, 0x0800, true);
    p.setUint16(10, 0, true);
    p.setUint16(12, jam, true);
    p.setUint16(14, tanggal, true);
    p.setUint32(16, crc, true);
    p.setUint32(20, ukuran, true);
    p.setUint32(24, ukuran, true);
    p.setUint16(28, nama.length, true);
    p.setUint32(42, posisi, true); // letak kepala lokal
    pusat.set(nama, 46);

    bagian.push(lokal, b.isi);
    direktori.push(pusat);
    posisi += lokal.length + ukuran;
    if (posisi > MAKS_BYTE) throw new Error("ZIP terlalu besar.");
  }

  const ukuranDirektori = direktori.reduce((n, d) => n + d.length, 0);
  const akhir = new Uint8Array(22);
  const a = new DataView(akhir.buffer);
  a.setUint32(0, 0x06054b50, true);
  a.setUint16(8, berkas.length, true);
  a.setUint16(10, berkas.length, true);
  a.setUint32(12, ukuranDirektori, true);
  a.setUint32(16, posisi, true);

  const hasil = new Uint8Array(posisi + ukuranDirektori + 22);
  let geser = 0;
  for (const potong of [...bagian, ...direktori, akhir]) {
    hasil.set(potong, geser);
    geser += potong.length;
  }
  return hasil;
}
