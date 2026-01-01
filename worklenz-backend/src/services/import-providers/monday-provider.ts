import { ImportProvider, ProviderResult } from "./provider-types";
import { ImportJob, StageTaskRow } from "../imports-service";
import axios from "axios";

interface MondayOptions {
  token?: string;
  boardId?: number | string;
}

interface MondayItem {
  id: string;
  name: string;
  column_values?: Array<{ id: string; text?: string; value?: any }>;
}

interface MondayResponse {
  data?: { items?: MondayItem[] };
}

export default class MondayProvider implements ImportProvider {
  name = "monday";

  async ingest(
    job: ImportJob,
    payload?: Record<string, unknown>
  ): Promise<ProviderResult> {
    const opts = ((payload?.sourceReference as MondayOptions) ||
      (job.source_reference as any) ||
      {}) as MondayOptions;
    if (!opts.token || !opts.boardId)
      return { tasks: [], raw: { warning: "Missing Monday token/boardId" } };

    const query = `query ($boardId: [Int]) { boards(ids: $boardId) { items (limit: 200) { id name column_values { id text value } } } }`;
    const variables = { boardId: Number(opts.boardId) };

    const { data } = await axios.post<MondayResponse>(
      "https://api.monday.com/v2",
      { query, variables },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: opts.token,
        },
      }
    );

    const items = data?.data?.items || [];
    const tasks: StageTaskRow[] = items.map((item) => ({
      source_task_id: item.id,
      title: item.name || "Untitled item",
      description:
        item.column_values?.find((c) => c.id === "long_text")?.text || null,
      status: item.column_values?.find((c) => c.id === "status")?.text || null,
      due_at: item.column_values?.find((c) => c.id === "date4")?.text || null,
      start_at: item.column_values?.find((c) => c.id === "date")?.text || null,
      raw: item,
    }));

    return { tasks };
  }
}
