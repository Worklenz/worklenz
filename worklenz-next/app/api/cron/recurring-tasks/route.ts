import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logError, logInfo } from "@/lib/logging/axiom";
import { sendRevisionReminderEmail } from "@/lib/email/resend";

function isAuthorized(authHeader: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  return authHeader === `Bearer ${secret}`;
}

const STALE_DAYS = 7;

export async function GET() {
  const h = await headers();
  if (!isAuthorized(h.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  try {
    const staleTasks = await prisma.task.findMany({
      where: {
        status: "REVISION_REQUIRED",
        updatedAt: { lt: cutoff }
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, fullName: true, email: true } }
      }
    });

    let notified = 0;
    for (const task of staleTasks) {
      if (!task.assignee?.email) continue;

      const daysSince = Math.floor(
        (Date.now() - task.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      try {
        await sendRevisionReminderEmail({
          to: task.assignee.email,
          recipientName: task.assignee.fullName ?? task.assignee.email,
          taskTitle: task.title,
          projectName: task.project.name,
          daysSinceRevision: daysSince,
          reviewComment: task.reviewComment ?? undefined
        });
        notified++;
      } catch (err) {
        await logError("cron.recurringTasks.emailError", {
          taskId: task.id,
          message: err instanceof Error ? err.message : "Unknown"
        });
      }
    }

    await logInfo("cron.recurringTasks.run", {
      at: new Date().toISOString(),
      staleCount: staleTasks.length,
      notified
    });

    return NextResponse.json({
      ok: true,
      job: "recurring-tasks",
      staleCount: staleTasks.length,
      notified
    });
  } catch (error) {
    await logError("cron.recurringTasks.error", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
