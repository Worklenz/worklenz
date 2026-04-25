import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logError, logInfo } from "@/lib/logging/axiom";
import { sendReviewPendingEmail } from "@/lib/email/resend";

function isAuthorized(authHeader: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  return authHeader === `Bearer ${secret}`;
}

const HOURS_THRESHOLD = 24;

export async function GET() {
  const h = await headers();
  if (!isAuthorized(h.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - HOURS_THRESHOLD * 60 * 60 * 1000);

  try {
    const [pendingTasks, reviewers] = await Promise.all([
      prisma.task.findMany({
        where: {
          status: "SUBMITTED",
          submittedAt: { lt: cutoff }
        },
        include: {
          project: { select: { id: true, name: true, code: true } },
          assignee: { select: { id: true, fullName: true, email: true } }
        },
        orderBy: { submittedAt: "asc" }
      }),
      prisma.userProfile.findMany({
        where: { role: { in: ["managing_director", "senior_qs", "admin", "owner"] } },
        select: { id: true, fullName: true, email: true }
      })
    ]);

    if (pendingTasks.length === 0) {
      await logInfo("cron.notifications.run", {
        at: new Date().toISOString(),
        pendingCount: 0,
        emailsSent: 0
      });
      return NextResponse.json({ ok: true, job: "notifications", pendingCount: 0, emailsSent: 0 });
    }

    const taskSummaries = pendingTasks.map((t) => ({
      title: t.title,
      projectName: t.project.name,
      assigneeName: t.assignee?.fullName ?? t.assignee?.email ?? "Unknown",
      submittedHoursAgo: Math.floor(
        (Date.now() - (t.submittedAt?.getTime() ?? Date.now())) / (1000 * 60 * 60)
      )
    }));

    let sent = 0;
    for (const reviewer of reviewers) {
      try {
        await sendReviewPendingEmail({
          to: reviewer.email,
          recipientName: reviewer.fullName ?? reviewer.email,
          pendingCount: pendingTasks.length,
          tasks: taskSummaries
        });
        sent++;
      } catch (err) {
        await logError("cron.notifications.emailError", {
          to: reviewer.email,
          message: err instanceof Error ? err.message : "Unknown"
        });
      }
    }

    await logInfo("cron.notifications.run", {
      at: new Date().toISOString(),
      pendingCount: pendingTasks.length,
      emailsSent: sent
    });

    return NextResponse.json({
      ok: true,
      job: "notifications",
      pendingCount: pendingTasks.length,
      emailsSent: sent
    });
  } catch (error) {
    await logError("cron.notifications.error", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
