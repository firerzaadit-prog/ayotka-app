import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { getAiAutoAnalysisSettings, setHargaLearningAnalytics, setMarginLearningAnalytics } from "@/lib/ai/settings";

/** Bagian D/G (permintaan user): harga jual & margin Learning Analytics tambahan - admin pusat atur di halaman Paket & Rekening. */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const settings = await getAiAutoAnalysisSettings();
  return NextResponse.json({
    hargaLearningAnalytics: settings.hargaLearningAnalytics,
    marginLearningAnalyticsPersen: settings.marginLearningAnalyticsPersen,
  });
}

const patchSchema = z.object({
  hargaLearningAnalytics: z.coerce.number().int().min(0, "Harga tidak boleh negatif").optional(),
  marginLearningAnalyticsPersen: z.coerce.number().int().min(0, "Margin tidak boleh negatif").max(100, "Margin maks 100%").optional(),
});

export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const before = await getAiAutoAnalysisSettings();

  let after = before;
  if (parsed.data.hargaLearningAnalytics !== undefined) {
    after = await setHargaLearningAnalytics(parsed.data.hargaLearningAnalytics);
  }
  if (parsed.data.marginLearningAnalyticsPersen !== undefined) {
    after = await setMarginLearningAnalytics(parsed.data.marginLearningAnalyticsPersen);
  }

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "app_settings",
    entitasId: after.id,
    before: { hargaLearningAnalytics: before.hargaLearningAnalytics, marginLearningAnalyticsPersen: before.marginLearningAnalyticsPersen },
    after: { hargaLearningAnalytics: after.hargaLearningAnalytics, marginLearningAnalyticsPersen: after.marginLearningAnalyticsPersen },
    ip: getClientIp(request),
  });

  return NextResponse.json({
    hargaLearningAnalytics: after.hargaLearningAnalytics,
    marginLearningAnalyticsPersen: after.marginLearningAnalyticsPersen,
  });
}

