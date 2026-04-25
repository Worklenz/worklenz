import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { publishRealtimeEvent } from "@/lib/realtime/publish";
import { requireUserProfile } from "@/lib/users/profile";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(_: Request, { params }: RouteContext) {
  const profile = await requireUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      logs: { select: { minutes: true } }
    }
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const loggedMinutes = task.logs.reduce((sum, log) => sum + log.minutes, 0);
  if (loggedMinutes <= 0 && task.timeSpentMinute <= 0) {
    return NextResponse.json({ error: "Cannot submit without a time log" }, { status: 400 });
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date()
    }
  });

  await publishRealtimeEvent({
    channel: `project:${updated.projectId}`,
    event: "task.submitted",
    payload: {
      taskId: updated.id,
      projectId: updated.projectId,
      actorUserId: profile.id
    }
  });

  return NextResponse.json({ data: updated });
}
