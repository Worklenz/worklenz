import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { redis } from "@/lib/cache/redis";
import { prisma } from "@/lib/db/prisma";
import { logError, logInfo } from "@/lib/logging/axiom";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const cacheKey = `project:${projectId}:tasks`;

  try {
    const cached = await redis().get(cacheKey);
    if (cached) {
      return NextResponse.json({ source: "cache", data: cached });
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 250
    });

    await redis().set(cacheKey, tasks, { ex: 60 });
    await logInfo("api.project.tasks.list", { projectId, count: tasks.length });

    return NextResponse.json({ source: "db", data: tasks });
  } catch (error) {
    await logError("api.project.tasks.list.error", {
      projectId,
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  try {
    const payload = (await request.json()) as { title?: string; description?: string };
    if (!payload.title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        title: payload.title,
        description: payload.description ?? null,
        projectId
      }
    });

    await redis().del(`project:${projectId}:tasks`);
    await logInfo("api.project.tasks.create", { projectId, taskId: task.id, actor: userId });

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    await logError("api.project.tasks.create.error", {
      projectId,
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
