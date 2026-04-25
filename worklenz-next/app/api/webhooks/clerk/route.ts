import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logError, logInfo } from "@/lib/logging/axiom";

type ClerkUserPayload = {
  id: string;
  email_addresses: { email_address: string }[];
  first_name: string | null;
  last_name: string | null;
  public_metadata: Record<string, unknown>;
};

type ClerkWebhookEvent = {
  type: string;
  data: ClerkUserPayload;
};

export async function POST(request: Request) {
  const h = await headers();
  const svixId = h.get("svix-id");
  const svixTimestamp = h.get("svix-timestamp");
  const svixSignature = h.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const wh = new Webhook(secret);

  let event: ClerkWebhookEvent;
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature
    }) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const clerkUser = event.data;
    const email = clerkUser.email_addresses[0]?.email_address;

    if (!email) {
      return NextResponse.json({ ok: true });
    }

    const fullName =
      [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(" ") || null;
    const metaRole = clerkUser.public_metadata?.role;
    const role = typeof metaRole === "string" ? metaRole : "qs";

    try {
      await prisma.userProfile.upsert({
        where: { clerkId: clerkUser.id },
        update: { email, fullName, role },
        create: { clerkId: clerkUser.id, email, fullName, role }
      });

      await logInfo("webhook.clerk.userSync", {
        clerkId: clerkUser.id,
        email,
        role,
        event: event.type
      });
    } catch (error) {
      await logError("webhook.clerk.userSync.error", {
        clerkId: clerkUser.id,
        message: error instanceof Error ? error.message : "Unknown error"
      });
      return NextResponse.json({ error: "Sync failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
