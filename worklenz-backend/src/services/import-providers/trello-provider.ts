import { ImportProvider, ProviderResult } from "./provider-types";
import { ImportJob, StageTaskRow } from "../imports-service";
import { getWithRetries } from "./http-utils";

interface TrelloOptions {
  key?: string;
  token?: string;
  boardId?: string;
}

interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  due?: string | null;
  idAttachmentCover?: string | null;
  idList?: string;
}

export default class TrelloProvider implements ImportProvider {
  name = "trello";

  async ingest(
    job: ImportJob,
    payload?: Record<string, unknown>
  ): Promise<ProviderResult> {
    const opts = ((payload?.sourceReference as TrelloOptions) ||
      (job.source_reference as any) ||
      {}) as TrelloOptions;
    if (!opts.key || !opts.token || !opts.boardId)
      return {
        tasks: [],
        raw: { warning: "Missing Trello key/token/boardId" },
      };

    const cards = await getWithRetries<TrelloCard[]>({
      method: "GET",
      url: `https://api.trello.com/1/boards/${opts.boardId}/cards`,
      params: { key: opts.key, token: opts.token, attachments: true },
    });

    const tasks: StageTaskRow[] = cards.map((c) => ({
      source_task_id: c.id,
      title: c.name || "Untitled card",
      description: c.desc || null,
      due_at: c.due || null,
      status: c.idList || null,
      raw: c,
    }));

    return { tasks };
  }
}
