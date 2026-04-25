import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logError, logInfo } from "@/lib/logging/axiom";
import { sendDailyDigestEmail } from "@/lib/email/resend";

function isAuthorized(authHeader: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  return authHeader === `Bearer ${secret}`;
}

export async function GET() {
  const h = await headers();
  if (!isAuthorized(h.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dateStr = today.toISOString().slice(0, 10);

  try {
    const [allStaff, todayAttendance, pendingReviewCount, admins] = await Promise.all([
      prisma.userProfile.findMany({
        where: { role: { in: ["qs", "senior_qs"] } },
        select: { id: true, fullName: true, email: true }
      }),
      prisma.attendance.findMany({
        where: { workDate: { gte: today, lt: tomorrow } },
        select: { userId: true }
      }),
      prisma.task.count({ where: { status: "SUBMITTED" } }),
      prisma.userProfile.findMany({
        where: { role: { in: ["managing_director", "admin", "owner"] } },
        select: { id: true, fullName: true, email: true }
      })
    ]);

    const presentIds = new Set(todayAttendance.map((a) => a.userId));
    const absentStaff = allStaff
      .filter((u) => !presentIds.has(u.id))
      .map((u) => ({ name: u.fullName ?? "", email: u.email }));

    let sent = 0;
    for (const admin of admins) {
      try {
        await sendDailyDigestEmail({
          to: admin.email,
          recipientName: admin.fullName ?? admin.email,
          date: dateStr,
          absentCount: absentStaff.length,
          pendingReviewCount,
          absentStaff
        });
        sent++;
      } catch (err) {
        await logError("cron.dailyDigest.emailError", {
          to: admin.email,
          message: err instanceof Error ? err.message : "Unknown"
        });
      }
    }

    await logInfo("cron.dailyDigest.run", {
      at: now.toISOString(),
      date: dateStr,
      absentCount: absentStaff.length,
      pendingReviewCount,
      emailsSent: sent
    });

    return NextResponse.json({
      ok: true,
      job: "daily-digest",
      absentCount: absentStaff.length,
      pendingReviewCount,
      emailsSent: sent
    });
  } catch (error) {
    await logError("cron.dailyDigest.error", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
