import { ImportProvider, ProviderResult } from "./provider-types";
import { ImportJob, StageTaskRow } from "../imports-service";
import { getWithRetries } from "./http-utils";

interface ClickUpOptions {
  token?: string;
  listId?: string;
}

interface ClickUpTask {
  id: string;
  name: string;
  text_content?: string;
  description?: string;
  due_date?: string;
  start_date?: string;
  status?: { status?: string };
  assignees?: Array<{ id?: string }>;
}

interface ClickUpResponse {
  tasks: ClickUpTask[];
}

export default class ClickUpProvider implements ImportProvider {
  name = "clickup";

  async ingest(
    job: ImportJob,
    payload?: Record<string, unknown>
  ): Promise<ProviderResult> {
    const opts = ((payload?.sourceReference as ClickUpOptions) ||
      (job.source_reference as any) ||
      {}) as ClickUpOptions;
    if (!opts.token || !opts.listId)
      return { tasks: [], raw: { warning: "Missing ClickUp token/listId" } };

    const { tasks: rawTasks = [] } = await getWithRetries<ClickUpResponse>({
      method: "GET",
      url: `https://api.clickup.com/api/v2/list/${opts.listId}/task`,
      params: { page: 0, subtasks: true },
      headers: { Authorization: opts.token },
    });

    const tasks: StageTaskRow[] = rawTasks.map((t) => ({
      source_task_id: t.id,
      title: t.name || "Untitled task",
      description: t.description || t.text_content || null,
      status: t.status?.status || null,
      due_at: t.due_date || null,
      start_at: t.start_date || null,
      assignee_source_id: t.assignees?.[0]?.id?.toString() || null,
      raw: t,
    }));

    return { tasks };
  }
}
