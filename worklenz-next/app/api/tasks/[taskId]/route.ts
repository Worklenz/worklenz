import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUserProfile } from "@/lib/users/profile";
import { redis } from "@/lib/cache/redis";
import { logInfo } from "@/lib/logging/axiom";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

const ALLOWED_STATUSES = ["ASSIGNED", "ON_HOLD", "REVISION_REQUIRED", "SUBMITTED", "APPROVED", "REJECTED"];

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const profile = await requireUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string | null;
    status?: string;
    assignee_id?: string | null;
    planned_rate?: number | null;
    actual_rate?: number | null;
    time_spent_minute?: number;
  };

  if (body.status && !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(body.title ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.assignee_id !== undefined ? { assigneeId: body.assignee_id } : {}),
      ...(body.planned_rate !== undefined ? { plannedRate: body.planned_rate } : {}),
      ...(body.actual_rate !== undefined ? { actualRate: body.actual_rate } : {}),
      ...(body.time_spent_minute !== undefined ? { timeSpentMinute: body.time_spent_minute } : {})
    },
    include: {
      assignee: { select: { id: true, fullName: true, email: true } }
    }
  });

  await redis().del(`project:${task.projectId}:tasks`);
  await logInfo("api.tasks.update", { taskId, actor: profile.id });

  return NextResponse.json({ data: updated });
}
