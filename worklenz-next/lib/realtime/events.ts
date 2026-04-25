import { createClient } from "@/lib/supabase/client";

export type WorklenzEvent = {
  event: string;
  entity: string;
  id: string;
  payload: Record<string, unknown>;
  actor: string;
  timestamp: string;
};

export function subscribeToProjectEvents(projectId: string, onEvent: (event: WorklenzEvent) => void) {
  const supabase = createClient();

  const channel = supabase
    .channel(`project:${projectId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tasks",
        filter: `project_id=eq.${projectId}`
      },
      (payload) => {
        onEvent({
          event: payload.eventType,
          entity: "task",
          id: String(payload.new?.id ?? payload.old?.id ?? ""),
          payload: payload.new ?? payload.old ?? {},
          actor: "system",
          timestamp: new Date().toISOString()
        });
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
