import { ImportProvider, ProviderResult } from "./provider-types";
import { ImportJob, StageTaskRow } from "../imports-service";
import axios from "axios";

interface MondayOptions {
  token?: string;
  boardId?: number | string;
}

interface MondayColumnValue {
  id: string;
  text?: string;
  value?: any;
}

interface MondayItem {
  id: string;
  name: string;
  column_values?: MondayColumnValue[];
}

interface MondayBoard {
  id: string;
  name: string;
  items?: MondayItem[];
  items_page?: {
    items: MondayItem[];
  };
}

interface MondayResponse {
  data?: {
    boards?: MondayBoard[];
    items?: MondayItem[];
  };
}

export default class MondayProvider implements ImportProvider {
  name = "monday";

  async ingest(
    job: ImportJob,
    payload?: Record<string, unknown>,
  ): Promise<ProviderResult> {
    const opts = ((payload?.sourceReference as MondayOptions) ||
      (job.source_reference as any) ||
      {}) as MondayOptions;

    console.log("[Monday Provider] Options received:", opts);

    if (!opts.token || !opts.boardId) {
      console.log("[Monday Provider] Missing token or boardId:", {
        hasToken: !!opts.token,
        boardId: opts.boardId,
      });
      return { tasks: [], raw: { warning: "Missing Monday token/boardId" } };
    }

    const query = `query ($boardId: [ID!]) { 
      boards(ids: $boardId) { 
        items_page (limit: 200) { 
          items { 
            id 
            name 
            column_values { 
              id 
              text 
              value 
            }
          }
        }
      } 
    }`;
    const variables = { boardId: [String(opts.boardId)] };

    console.log("[Monday Provider] Executing query:", { query, variables });

    try {
      const { data } = await axios.post<MondayResponse>(
        "https://api.monday.com/v2",
        { query, variables },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: opts.token,
          },
        },
      );

      console.log(
        "[Monday Provider] Raw API response:",
        JSON.stringify(data, null, 2),
      );

      const items =
        data?.data?.boards?.[0]?.items_page?.items ||
        data?.data?.boards?.[0]?.items ||
        [];

      console.log("[Monday Provider] Extracted items:", items);

      const tasks: StageTaskRow[] = items.map((item: MondayItem) => ({
        source_task_id: item.id,
        title: item.name || "Untitled item",
        description:
          item.column_values?.find(
            (c: MondayColumnValue) => c.id === "long_text",
          )?.text || null,
        status:
          item.column_values?.find((c: MondayColumnValue) => c.id === "status")
            ?.text || null,
        due_at:
          item.column_values?.find((c: MondayColumnValue) => c.id === "date4")
            ?.text || null,
        start_at:
          item.column_values?.find((c: MondayColumnValue) => c.id === "date")
            ?.text || null,
        raw: item,
      }));

      console.log("[Monday Provider] Mapped tasks:", tasks);

      return { tasks };
    } catch (error: any) {
      console.error("[Monday Provider] Error fetching data:", error);
      return { tasks: [], raw: { error: error?.message || "Unknown error" } };
    }
  }
}
