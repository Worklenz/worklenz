import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { publishRealtimeEvent } from "@/lib/realtime/publish";

type BroadcastPayload = {
  channel: string;
  event: string;
  payload: Record<string, unknown>;
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as BroadcastPayload;
  if (!body.channel || !body.event || !body.payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const status = await publishRealtimeEvent({
    channel: body.channel,
    event: body.event,
    payload: {
      ...body.payload,
      actor: userId
    }
  });

  return NextResponse.json({ ok: true, status });
}
