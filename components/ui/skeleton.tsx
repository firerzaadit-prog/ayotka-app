import { cn } from "@/lib/utils/cn";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";

/** Kotak abu-abu berkedip - blok dasar untuk loading state pengganti teks "Memuat...". */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200", className)} />;
}

/** Kerangka tabel saat data belum datang - meniru bentuk tabel asli supaya tidak "loncat" saat data muncul. */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <TableContainer>
      <Table>
        <Thead>
          <Tr>
            {Array.from({ length: columns }).map((_, i) => (
              <Th key={i}>
                <Skeleton className="h-3 w-16" />
              </Th>
            ))}
          </Tr>
        </Thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <Tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <Td key={c}>
                  <Skeleton className={cn("h-4", c === 0 ? "w-32" : "w-20")} />
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableContainer>
  );
}

/** Kerangka daftar kartu vertikal (bukan tabel) - untuk halaman kartu/list siswa, mis. dashboard ujian. */
export function ListSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Kerangka halaman detail penuh - dipakai saat seluruh halaman (bukan cuma tabel) masih memuat. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <ListSkeleton items={3} />
    </div>
  );
}
