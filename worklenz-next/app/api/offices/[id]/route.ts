import { NextRequest, NextResponse } from "next/server";
import { isOneOfRoles } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { requireUserProfile } from "@/lib/users/profile";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const profile = await requireUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await isOneOfRoles(["owner", "admin", "managing_director"]);
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as {
    code?: string;
    name?: string;
    city?: string;
    country?: string;
    managing_user_id?: string;
    active?: boolean;
  };

  const updated = await prisma.office.update({
    where: { id },
    data: {
      ...(body.code ? { code: body.code.trim().toUpperCase() } : {}),
      ...(body.name ? { name: body.name.trim() } : {}),
      ...(body.city !== undefined ? { city: body.city?.trim() || null } : {}),
      ...(body.country !== undefined ? { country: body.country?.trim() || null } : {}),
      ...(body.managing_user_id !== undefined ? { managingUserId: body.managing_user_id || null } : {}),
      ...(body.active !== undefined ? { active: body.active } : {})
    }
  });

  return NextResponse.json({ data: updated });
}
