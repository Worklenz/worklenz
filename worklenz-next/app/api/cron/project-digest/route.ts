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

  const dateStr = new Date().toISOString().slice(0, 10);

  try {
    const [projects, admins] = await Promise.all([
      prisma.project.findMany({
        include: {
          _count: { select: { tasks: true } },
          tasks: {
            select: { status: true }
          }
        }
      }),
      prisma.userProfile.findMany({
        where: { role: { in: ["managing_director", "admin", "owner"] } },
        select: { id: true, fullName: true, email: true }
      })
    ]);

    const summaries = projects.map((p) => {
      const counts: Record<string, number> = {};
      for (const t of p.tasks) {
        counts[t.status] = (counts[t.status] ?? 0) + 1;
      }
      return { name: p.name, code: p.code, total: p._count.tasks, counts };
    });

    const pendingReviewCount = summaries.reduce((sum, s) => sum + (s.counts["SUBMITTED"] ?? 0), 0);
    const totalAbsent = 0;

    const digestLines = summaries
      .filter((s) => s.total > 0)
      .map(
        (s) =>
          `${s.code}: ${s.total} tasks — ${Object.entries(s.counts)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")}`
      );

    let sent = 0;
    for (const admin of admins) {
      try {
        await sendDailyDigestEmail({
          to: admin.email,
          recipientName: admin.fullName ?? admin.email,
          date: `${dateStr} (project digest)`,
          absentCount: totalAbsent,
          pendingReviewCount,
          absentStaff: digestLines.map((l) => ({ name: l, email: "" }))
        });
        sent++;
      } catch (err) {
        await logError("cron.projectDigest.emailError", {
          to: admin.email,
          message: err instanceof Error ? err.message : "Unknown"
        });
      }
    }

    await logInfo("cron.projectDigest.run", {
      at: new Date().toISOString(),
      projectCount: projects.length,
      emailsSent: sent
    });

    return NextResponse.json({
      ok: true,
      job: "project-digest",
      projectCount: projects.length,
      summaries,
      emailsSent: sent
    });
  } catch (error) {
    await logError("cron.projectDigest.error", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
