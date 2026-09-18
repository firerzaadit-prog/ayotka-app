const strokeProps = { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/**
 * Kompas - dipilih mewakili Matematika (mengukur, menggambar bangun
 * geometri). Sengaja satu kaki lurus & satu kaki bersiku (mirip kompas
 * gambar sungguhan, dengan kaki-kaki kecil di ujung bawah) supaya tidak
 * terbaca seperti huruf "A" di ukuran kecil.
 */
export function IconKompas({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="4.2" r="1.3" {...strokeProps} />
      <path d="M12 5.5 7 19.5M12 5.5l2.5 5.5L17 19.5" {...strokeProps} />
      <path d="M6.2 19.5h1.6M16.2 19.5h1.6" {...strokeProps} />
    </svg>
  );
}

/** Buku terbuka - dipilih mewakili Bahasa Indonesia (membaca, sastra). */
export function IconBuku({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 6c-2-1.4-4.6-2-7-1.7v13.4c2.4-.3 5 .3 7 1.7 2-1.4 4.6-2 7-1.7V4.3c-2.4-.3-5 .3-7 1.7Z"
        {...strokeProps}
      />
      <path d="M12 6v13.4" {...strokeProps} />
    </svg>
  );
}

/** Atom - dipilih mewakili IPA (sains). Dua orbit (bukan tiga) supaya tidak terlihat seperti roda gigi di ukuran kecil. */
export function IconAtom({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="9" ry="4" stroke="currentColor" strokeWidth={1.5} />
      <ellipse cx="12" cy="12" rx="9" ry="4" stroke="currentColor" strokeWidth={1.5} transform="rotate(90 12 12)" />
    </svg>
  );
}

/** Balon percakapan - dipilih mewakili Bahasa Inggris (percakapan, kosakata). */
export function IconPercakapan({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6.5L8 18.5V15H6a2 2 0 0 1-2-2V6Z"
        {...strokeProps}
      />
      <path d="M8 8h8M8 11h5" {...strokeProps} />
    </svg>
  );
}

/** Fallback generik (dokumen) - dipakai kalau nama mapel tidak cocok pola yang dikenal. */
export function IconMapelGenerik({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5H6A.5.5 0 0 1 5.5 20V4a.5.5 0 0 1 .5-.5Z" {...strokeProps} />
      <path d="M15 3.5V6a1 1 0 0 0 1 1h2.5" {...strokeProps} />
      <path d="M8.5 12h7M8.5 15.5h7" {...strokeProps} />
    </svg>
  );
}

/**
 * Cocokkan ikon per nama mata pelajaran (case-insensitive, substring) -
 * dipakai bersama oleh Mapel (homepage) dan daftar try out siswa supaya
 * satu bahasa visual yang sama dipakai di kedua tempat.
 */
export function getMapelIcon(subjectNama: string): (props: { className?: string }) => React.JSX.Element {
  const n = subjectNama.toLowerCase();
  if (n.includes("matematika")) return IconKompas;
  if (n.includes("bahasa indonesia")) return IconBuku;
  if (n.includes("ipa")) return IconAtom;
  if (n.includes("bahasa inggris") || n.includes("english")) return IconPercakapan;
  return IconMapelGenerik;
}
