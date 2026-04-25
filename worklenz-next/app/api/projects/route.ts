import { NextRequest, NextResponse } from "next/server";
import { isOneOfRoles } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { requireUserProfile } from "@/lib/users/profile";
import { logError, logInfo } from "@/lib/logging/axiom";

export async function GET(request: NextRequest) {
  const profile = await requireUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const officeId = request.nextUrl.searchParams.get("office_id");

  try {
    const projects = await prisma.project.findMany({
      where: officeId ? { officeId } : {},
      include: {
        office: { select: { id: true, code: true, name: true } },
        _count: { select: { tasks: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ data: projects });
  } catch (error) {
    await logError("api.projects.list.error", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const profile = await requireUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await isOneOfRoles(["owner", "admin", "managing_director"]);
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      code?: string;
      office_id?: string;
    };

    if (!body.name?.trim() || !body.code?.trim()) {
      return NextResponse.json({ error: "name and code are required" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name: body.name.trim(),
        code: body.code.trim().toUpperCase(),
        officeId: body.office_id ?? null
      }
    });

    await logInfo("api.projects.create", { projectId: project.id, actor: profile.id });
    return NextResponse.json({ data: project }, { status: 201 });
  } catch (error) {
    await logError("api.projects.create.error", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
