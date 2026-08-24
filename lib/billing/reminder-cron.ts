import { matchReminderKind, buildBillingReminderEmail } from "@/lib/billing/reminder";

type SubscriptionForReminder = {
  userId: string;
  berakhirAt: Date;
  user: { email: string };
  plan: { nama: string };
};

type ReminderClient = {
  subscription: {
    findMany: (args: {
      where: { status: { not: "batal" } };
      orderBy: { berakhirAt: "desc" };
      include: { user: { select: { email: true } }; plan: { select: { nama: true } } };
    }) => Promise<SubscriptionForReminder[]>;
  };
};

type SendMailFn = (input: { to: string; subject: string; text: string }) => Promise<boolean>;

/**
 * Tiket 6.9: kirim email H-7/H-3/H-0 ke pemilik subscription yang
 * berakhir_at-nya jatuh tepat di salah satu ambang itu HARI INI.
 *
 * Hanya subscription TERBARU per user yang dicek (bukan semua baris
 * historis) - lib/billing/cron.ts (renewal) sengaja membuat baris
 * Subscription baru tiap perpanjangan alih-alih menimpa yang lama, jadi
 * user yang sudah lama pernah berlangganan bisa punya banyak baris; baris
 * lama yang sudah tergantikan tidak boleh ikut memicu reminder.
 *
 * Terima prisma & sendMail sebagai parameter (bukan import langsung) -
 * sama seperti lib/billing/cron.ts, supaya modul ini tetap testable tanpa
 * DB/SMTP sungguhan dan bisa dipanggil dari skrip cron mandiri.
 *
 * Catatan operasional: TIDAK ada penanda "sudah dikirim" di DB - jalankan
 * cron ini maksimal sekali sehari (sama seperti tiket 6.6) supaya tidak
 * mengirim reminder yang sama dobel.
 */
export async function sendDueBillingReminders(
  prisma: ReminderClient,
  sendMail: SendMailFn,
  now: Date = new Date(),
): Promise<{ terkirim: number; dilewati: number }> {
  const subs = await prisma.subscription.findMany({
    where: { status: { not: "batal" } },
    orderBy: { berakhirAt: "desc" },
    include: { user: { select: { email: true } }, plan: { select: { nama: true } } },
  });

  const latestPerUser = new Map<string, SubscriptionForReminder>();
  for (const sub of subs) {
    if (!latestPerUser.has(sub.userId)) latestPerUser.set(sub.userId, sub);
  }

  let terkirim = 0;
  let dilewati = 0;

  for (const sub of latestPerUser.values()) {
    const kind = matchReminderKind(sub.berakhirAt, now);
    if (!kind) continue;

    const { subject, text } = buildBillingReminderEmail(kind, {
      berakhirAt: sub.berakhirAt,
      planNama: sub.plan.nama,
    });
    const ok = await sendMail({ to: sub.user.email, subject, text });
    if (ok) terkirim += 1;
    else dilewati += 1;
  }

  return { terkirim, dilewati };
}
