import { createClient } from "@supabase/supabase-js";

type PublishEventInput = {
  channel: string;
  event: string;
  payload: Record<string, unknown>;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

export async function publishRealtimeEvent(input: PublishEventInput) {
  const channel = supabaseAdmin.channel(input.channel);

  const status = await channel.send({
    type: "broadcast",
    event: input.event,
    payload: {
      ...input.payload,
      timestamp: new Date().toISOString()
    }
  });

  await supabaseAdmin.removeChannel(channel);
  return status;
}
