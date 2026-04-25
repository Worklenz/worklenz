import { NextRequest, NextResponse } from "next/server";
import { isOneOfRoles } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { requireUserProfile } from "@/lib/users/profile";

export async function GET() {
  const profile = await requireUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const offices = await prisma.office.findMany({
    orderBy: { name: "asc" }
  });

  return NextResponse.json({ data: offices });
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

  const body = (await request.json()) as {
    code?: string;
    name?: string;
    city?: string;
    country?: string;
    managing_user_id?: string;
    active?: boolean;
  };

  if (!body.code || !body.name) {
    return NextResponse.json({ error: "code and name are required" }, { status: 400 });
  }

  const created = await prisma.office.create({
    data: {
      code: body.code.trim().toUpperCase(),
      name: body.name.trim(),
      city: body.city?.trim() || null,
      country: body.country?.trim() || null,
      managingUserId: body.managing_user_id || null,
      active: body.active ?? true
    }
  });

  return NextResponse.json({ data: created });
}
