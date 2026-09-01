import { RichText } from "@/components/soal/rich-text";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

const FORMAT_LABEL: Record<string, string> = {
  pg: "PG",
  pg_kompleks: "PG Kompleks",
  pg_kategori: "PG Kategori",
};

export type PerSoal = {
  questionId: string;
  format: string;
  teks: string;
  skor: number | null;
  skorMaks: number;
  // Bentuk aslinya beda-beda per format (lihat cast per blok di bawah) - dan
  // dipakai dari dua sumber dgn tipe beda: JSON.parse() di halaman siswa
  // (lewat fetch) vs Prisma JsonValue langsung di halaman admin (server
  // component, tanpa round-trip JSON) - unknown supaya cocok utk keduanya.
  jawabanJson?: unknown;
  pembahasan?: string | null;
  options?: { id: string; label: string; teks: string; isCorrect: boolean }[];
  statements?: { id: string; teks: string; correctLabel: string }[];
  categories?: { id: string; label: string }[];
};

/**
 * Diekstrak dari app/siswa/hasil/[id]/page.tsx (Tiket 4.10) supaya bisa
 * dipakai juga di halaman detail siswa admin pusat - satu tempat untuk
 * aturan render per format soal (pg/pg_kompleks/pg_kategori), bukan
 * disalin dua kali. canShowPembahasan datang apa adanya dari buildHasil()
 * (sama persis dipakai PDF rapor) - bukan gerbang izin per-viewer.
 */
export function RincianJawaban({
  perSoal,
  canShowPembahasan,
}: {
  perSoal: PerSoal[];
  canShowPembahasan: boolean;
}) {
  return (
    <div>
      {!canShowPembahasan && (
        <Alert variant="warning" className="mb-3">
          Pembahasan lengkap akan tersedia setelah jendela ujian kelasnya ditutup.
        </Alert>
      )}
      <div className="flex flex-col gap-3">
        {perSoal.map((s, i) => (
          <Card key={s.questionId}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Soal {i + 1} · {FORMAT_LABEL[s.format] ?? s.format}
              </span>
              <Badge variant={(s.skor ?? 0) >= s.skorMaks ? "success" : "danger"}>
                {(s.skor ?? 0) >= s.skorMaks ? "Benar" : "Salah"}
              </Badge>
            </div>
            <p className="mb-2 text-sm">
              <RichText text={s.teks} />
            </p>
            {canShowPembahasan && s.options && s.options.length > 0 && (() => {
              const jawaban = s.jawabanJson as { option_id?: string; option_ids?: string[] } | null;
              const selectedId = jawaban?.option_id;
              const selectedIds = new Set(jawaban?.option_ids ?? []);
              return (
                <ul className="mb-2 flex flex-col gap-1 text-sm">
                  {s.options.map((o) => {
                    const isSelected = s.format === "pg" ? o.id === selectedId : selectedIds.has(o.id);
                    const isCorrect = o.isCorrect;
                    return (
                      <li
                        key={o.id}
                        className={[
                          "flex items-start gap-2 rounded-lg px-2 py-1",
                          isCorrect && isSelected ? "bg-emerald-50 font-medium text-emerald-700" :
                          isCorrect ? "bg-emerald-50 font-medium text-emerald-700" :
                          isSelected ? "bg-rose-50 font-medium text-rose-600" :
                          "text-slate-500"
                        ].filter(Boolean).join(" ")}
                      >
                        <span className="shrink-0">{o.label}.</span>
                        <span className="flex-1"><RichText text={o.teks} /></span>
                        <span className="shrink-0 text-xs">
                          {isCorrect && isSelected && "✓ Jawaban (benar)"}
                          {isCorrect && !isSelected && "✓ Kunci"}
                          {!isCorrect && isSelected && "✗ Jawaban"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
            {canShowPembahasan && s.statements && s.statements.length > 0 && (() => {
              const jawaban = s.jawabanJson as Record<string, string> | null;
              return (
                <ul className="mb-2 flex flex-col gap-1 text-sm">
                  {s.statements.map((st) => {
                    const siswaJawab = s.categories?.find((c) => c.id === (jawaban?.[st.id]))?.label ?? null;
                    const benar = siswaJawab === st.correctLabel;
                    return (
                      <li key={st.id} className="rounded-lg px-2 py-1">
                        <span className="text-slate-600"><RichText text={st.teks} /></span>
                        <div className="mt-1 flex gap-4 text-xs">
                          <span className={siswaJawab ? (benar ? "font-medium text-emerald-700" : "font-medium text-rose-600") : "text-slate-400"}>
                            Jawaban: {siswaJawab ?? "—"}{!benar && siswaJawab ? " ✗" : benar ? " ✓" : ""}
                          </span>
                          {!benar && <span className="font-medium text-emerald-700">Kunci: {st.correctLabel} ✓</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
            {canShowPembahasan && s.pembahasan && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="font-medium">Pembahasan: </span>
                <RichText text={s.pembahasan} />
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
