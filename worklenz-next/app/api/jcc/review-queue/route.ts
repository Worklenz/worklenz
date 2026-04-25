import { NextRequest, NextResponse } from "next/server";
import { isOneOfRoles } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { requireUserProfile } from "@/lib/users/profile";

export async function GET(request: NextRequest) {
  const profile = await requireUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await isOneOfRoles(["owner", "admin", "managing_director", "senior_qs"]);
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const projectId = request.nextUrl.searchParams.get("project_id");
  const tasks = await prisma.task.findMany({
    where: {
      status: { in: ["SUBMITTED", "Submitted", "submitted"] },
      ...(projectId ? { projectId } : {})
    },
    include: {
      project: { select: { id: true, name: true, code: true } },
      assignee: { select: { id: true, fullName: true, email: true } }
    },
    orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }]
  });

  return NextResponse.json({ data: tasks });
}
