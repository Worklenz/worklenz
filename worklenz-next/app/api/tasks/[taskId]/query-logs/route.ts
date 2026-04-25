import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUserProfile } from "@/lib/users/profile";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function GET(_: NextRequest, { params }: RouteContext) {
  const profile = await requireUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;
  const rows = await prisma.taskQueryLog.findMany({
    where: { taskId },
    include: {
      raisedBy: { select: { id: true, fullName: true } },
      respondedBy: { select: { id: true, fullName: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ data: rows });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const profile = await requireUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;
  const body = (await request.json()) as {
    drawing_ref?: string;
    description?: string;
    impact?: string;
  };

  if (!body.description?.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  const created = await prisma.taskQueryLog.create({
    data: {
      taskId,
      drawingRef: body.drawing_ref?.trim() || null,
      description: body.description.trim(),
      impact: body.impact?.trim() || null,
      raisedById: profile.id
    }
  });

  return NextResponse.json({ data: created });
}
