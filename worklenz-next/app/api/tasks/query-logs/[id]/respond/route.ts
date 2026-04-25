import { NextRequest, NextResponse } from "next/server";
import { isOneOfRoles } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { requireUserProfile } from "@/lib/users/profile";

type RouteContext = {
  params: Promise<{ id: string }>;
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

  const { id } = await params;
  const body = (await request.json()) as { response?: string; resolved?: boolean };

  if (!body.response?.trim()) {
    return NextResponse.json({ error: "response is required" }, { status: 400 });
  }

  const updated = await prisma.taskQueryLog.update({
    where: { id },
    data: {
      response: body.response.trim(),
      respondedById: profile.id,
      respondedAt: new Date(),
      ...(body.resolved !== undefined ? { resolved: body.resolved } : {})
    }
  });

  return NextResponse.json({ data: updated });
}
