import { describe, expect, it, vi } from "vitest";
import { matchReminderKind, buildBillingReminderEmail } from "@/lib/billing/reminder";
import { sendDueBillingReminders } from "@/lib/billing/reminder-cron";

const DAY_MS = 24 * 60 * 60 * 1000;
// Tengah hari WIB, jauh dari batas pergantian tanggal - baseline aman untuk offset ±N hari.
const NOW = new Date("2026-06-15T05:00:00.000Z"); // 15 Juni 2026, 12:00 WIB

describe("matchReminderKind (Tiket 6.9, Bagian 7.1 brief: pengingat H-7/H-3/H-0)", () => {
  it("H-0 kalau berakhir_at hari ini (WIB)", () => {
    expect(matchReminderKind(new Date("2026-06-15T10:00:00.000Z"), NOW)).toBe("H-0");
  });

  it("H-3 kalau berakhir_at persis 3 hari lagi (WIB)", () => {
    expect(matchReminderKind(new Date("2026-06-18T10:00:00.000Z"), NOW)).toBe("H-3");
  });

  it("H-7 kalau berakhir_at persis 7 hari lagi (WIB)", () => {
    expect(matchReminderKind(new Date("2026-06-22T10:00:00.000Z"), NOW)).toBe("H-7");
  });

  it("null untuk hari-hari di luar H-7/H-3/H-0 (mis. H-1, H-2, H-4, H-8)", () => {
    for (const offsetDays of [1, 2, 4, 5, 6, 8, 10]) {
      const berakhirAt = new Date(NOW.getTime() + offsetDays * DAY_MS);
      expect(matchReminderKind(berakhirAt, NOW)).toBeNull();
    }
  });

  it("null kalau berakhir_at sudah lewat (bukan H-0 untuk yang sudah kedaluwarsa kemarin)", () => {
    expect(matchReminderKind(new Date("2026-06-14T10:00:00.000Z"), NOW)).toBeNull();
  });

  it("H-0 tetap kena walau berakhir_at jam 23:59 WIB dan now jam 00:05 WIB di hari kalender yang sama", () => {
    const berakhirMalam = new Date("2026-06-15T16:59:00.000Z"); // 15 Juni 23:59 WIB
    const nowDiniHari = new Date("2026-06-14T17:05:00.000Z"); // 15 Juni 00:05 WIB
    expect(matchReminderKind(berakhirMalam, nowDiniHari)).toBe("H-0");
  });
});

describe("buildBillingReminderEmail", () => {
  it("H-0: subjek & isi menyebut 'hari ini', bukan 'X hari lagi'", () => {
    const email = buildBillingReminderEmail("H-0", {
      berakhirAt: new Date("2026-06-15T10:00:00.000Z"),
      planNama: "Bulanan Siswa",
    });
    expect(email.subject).toMatch(/hari ini/i);
    expect(email.text).toMatch(/HARI INI/);
    expect(email.text).toContain("Bulanan Siswa");
  });

  it("H-7: subjek & isi menyebut '7 hari lagi'", () => {
    const email = buildBillingReminderEmail("H-7", {
      berakhirAt: new Date("2026-06-22T10:00:00.000Z"),
      planNama: "Bulanan Siswa",
    });
    expect(email.subject).toMatch(/7 hari lagi/);
    expect(email.text).toMatch(/7 hari lagi/);
  });
});

describe("sendDueBillingReminders", () => {
  function makeFakePrisma(subs: Array<{ userId: string; berakhirAt: Date; email: string; planNama: string }>) {
    return {
      subscription: {
        findMany: vi.fn(async () =>
          subs.map((s) => ({
            userId: s.userId,
            berakhirAt: s.berakhirAt,
            user: { email: s.email },
            plan: { nama: s.planNama },
          })),
        ),
      },
    };
  }

  it("kirim email cuma untuk subscription yang jatuh di H-7/H-3/H-0, lewati sisanya", async () => {
    const prisma = makeFakePrisma([
      { userId: "u1", berakhirAt: NOW, email: "u1@test.id", planNama: "Bulanan" }, // H-0
      { userId: "u2", berakhirAt: new Date(NOW.getTime() + DAY_MS), email: "u2@test.id", planNama: "Bulanan" }, // H-1, tidak match
    ]);
    const sendMail = vi.fn(async () => true);

    const result = await sendDueBillingReminders(prisma, sendMail, NOW);

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "u1@test.id" }));
    expect(result).toEqual({ terkirim: 1, dilewati: 0 });
  });

  it("user dengan beberapa baris subscription (riwayat perpanjangan) - cuma baris TERBARU (berakhir_at paling akhir) yang dicek, baris lama diabaikan", async () => {
    // Baris lama kebetulan berakhir_at-nya jatuh H-0 hari ini, tapi sudah
    // digantikan baris baru (masih jauh aktif) - TIDAK boleh kirim reminder.
    const prisma = makeFakePrisma([
      { userId: "u1", berakhirAt: new Date(NOW.getTime() + 20 * DAY_MS), email: "u1@test.id", planNama: "Baru" },
      { userId: "u1", berakhirAt: NOW, email: "u1@test.id", planNama: "Lama" },
    ]);
    const sendMail = vi.fn(async () => true);

    const result = await sendDueBillingReminders(prisma, sendMail, NOW);

    expect(sendMail).not.toHaveBeenCalled();
    expect(result).toEqual({ terkirim: 0, dilewati: 0 });
  });

  it("hitung 'dilewati' kalau sendMail gagal/return false (mis. SMTP belum dikonfigurasi)", async () => {
    const prisma = makeFakePrisma([
      { userId: "u1", berakhirAt: NOW, email: "u1@test.id", planNama: "Bulanan" },
    ]);
    const sendMail = vi.fn(async () => false);

    const result = await sendDueBillingReminders(prisma, sendMail, NOW);

    expect(result).toEqual({ terkirim: 0, dilewati: 1 });
  });
});
