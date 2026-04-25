import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/users/profile";

export async function GET() {
  const profile = await requireUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ data: profile });
}
