/**
 * Konversi angka rupiah ke kalimat terbilang bahasa Indonesia untuk dokumen invoice resmi.
 */
export function terbilang(nominal: number): string {
  const n = Math.abs(Math.floor(nominal));
  if (n === 0) return "Nol Rupiah";

  const satuan = [
    "",
    "Satu",
    "Dua",
    "Tiga",
    "Empat",
    "Lima",
    "Enam",
    "Tujuh",
    "Delapan",
    "Sembilan",
    "Sepuluh",
    "Sebelas",
  ];

  function hitung(x: number): string {
    if (x < 12) return satuan[x]!;
    if (x < 20) return hitung(x - 10) + " Belas";
    if (x < 100) return hitung(Math.floor(x / 10)) + " Puluh" + (x % 10 > 0 ? " " + hitung(x % 10) : "");
    if (x < 200) return "Seratus" + (x % 100 > 0 ? " " + hitung(x % 100) : "");
    if (x < 1000) return hitung(Math.floor(x / 100)) + " Ratus" + (x % 100 > 0 ? " " + hitung(x % 100) : "");
    if (x < 2000) return "Seribu" + (x % 1000 > 0 ? " " + hitung(x % 1000) : "");
    if (x < 1000000) return hitung(Math.floor(x / 1000)) + " Ribu" + (x % 1000 > 0 ? " " + hitung(x % 1000) : "");
    if (x < 1000000000) return hitung(Math.floor(x / 1000000)) + " Juta" + (x % 1000000 > 0 ? " " + hitung(x % 1000000) : "");
    if (x < 1000000000000) return hitung(Math.floor(x / 1000000000)) + " Miliar" + (x % 1000000000 > 0 ? " " + hitung(x % 1000000000) : "");
    return String(x);
  }

  return `${hitung(n).trim()} Rupiah`;
}
