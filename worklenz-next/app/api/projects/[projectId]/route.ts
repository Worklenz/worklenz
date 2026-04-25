import { NextRequest, NextResponse } from "next/server";
import { isOneOfRoles } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { requireUserProfile } from "@/lib/users/profile";
import { logInfo } from "@/lib/logging/axiom";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_: NextRequest, { params }: RouteContext) {
  const profile = await requireUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      office: { select: { id: true, code: true, name: true } },
      _count: { select: { tasks: true } }
    }
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ data: project });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const profile = await requireUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await isOneOfRoles(["owner", "admin", "managing_director"]);
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { projectId } = await params;
  const body = (await request.json()) as {
    name?: string;
    code?: string;
    office_id?: string | null;
  };

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(body.name ? { name: body.name.trim() } : {}),
      ...(body.code ? { code: body.code.trim().toUpperCase() } : {}),
      ...(body.office_id !== undefined ? { officeId: body.office_id } : {})
    }
  });

  await logInfo("api.projects.update", { projectId, actor: profile.id });
  return NextResponse.json({ data: project });
}
