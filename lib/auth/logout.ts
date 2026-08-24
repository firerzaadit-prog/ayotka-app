import "server-only";
import { prisma } from "@/lib/db/prisma";

export async function closeOpenLoginSession(userId: string): Promise<void> {
  const openSession = await prisma.loginLog.findFirst({
    where: { userId, logoutAt: null },
    orderBy: { loginAt: "desc" },
  });
  if (openSession) {
    await prisma.loginLog.update({
      where: { id: openSession.id },
      data: { logoutAt: new Date() },
    });
  }
}
