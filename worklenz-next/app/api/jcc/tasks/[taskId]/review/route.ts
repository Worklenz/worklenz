import { NextRequest, NextResponse } from "next/server";
import { isOneOfRoles } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { publishRealtimeEvent } from "@/lib/realtime/publish";
import { requireUserProfile } from "@/lib/users/profile";

const OUTCOME_TO_STATUS: Record<string, string> = {
  approved: "APPROVED",
  revision_required: "REVISION_REQUIRED",
  rejected: "REJECTED",
  on_hold: "ON_HOLD"
};

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const profile = await requireUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await isOneOfRoles(["owner", "admin", "managing_director", "senior_qs"]);
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { taskId } = await params;
  const body = (await request.json()) as { outcome?: string; comment?: string };
  const outcome = (body.outcome ?? "").toLowerCase();

  if (!OUTCOME_TO_STATUS[outcome]) {
    return NextResponse.json({ error: "Invalid review outcome" }, { status: 400 });
  }

  if (outcome === "rejected" && !body.comment?.trim()) {
    return NextResponse.json({ error: "Comment is required for rejected outcome" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const revisionIncrement = outcome === "revision_required" ? 1 : 0;
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: OUTCOME_TO_STATUS[outcome],
      reviewOutcome: outcome,
      reviewComment: body.comment?.trim() || task.reviewComment,
      reviewedAt: new Date(),
      revisionCount: {
        increment: revisionIncrement
      }
    }
  });

  await publishRealtimeEvent({
    channel: `project:${updated.projectId}`,
    event: "task.reviewed",
    payload: {
      taskId: updated.id,
      projectId: updated.projectId,
      outcome,
      actorUserId: profile.id
    }
  });

  return NextResponse.json({ data: updated });
}
