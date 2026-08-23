import "server-only";
import { prisma } from "@/lib/db/prisma";

type AuditAction = "create" | "update" | "delete";

/**
 * Tiket 1.7: hook audit log terpusat. Dipanggil di setiap route
 * handler/server action yang create/update/delete data pada tabel utama.
 * Tidak melempar error kalau gagal ditulis - audit log tidak boleh membuat
 * aksi utama pengguna gagal.
 */
export async function logAudit(params: {
  userId: string | null;
  aksi: AuditAction;
  entitas: string;
  entitasId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        aksi: params.aksi,
        entitas: params.entitas,
        entitasId: params.entitasId,
        beforeJson: params.before === undefined ? undefined : (params.before as object),
        afterJson: params.after === undefined ? undefined : (params.after as object),
        ip: params.ip ?? null,
      },
    });
  } catch (error) {
    console.error("Gagal menulis audit log", { entitas: params.entitas, error });
  }
}

/** Ambil IP klien dari header request (dipasang di depan proxy/load balancer). */
export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}
