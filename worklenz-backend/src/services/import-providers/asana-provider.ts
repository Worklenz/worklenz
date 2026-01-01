import { ImportProvider, ProviderResult } from "./provider-types";
import { ImportJob, StageTaskRow } from "../imports-service";
import { getWithRetries } from "./http-utils";

interface AsanaTask {
  gid: string;
  name: string;
  notes?: string;
  due_on?: string;
  start_on?: string;
  assignee?: { gid: string | null; name?: string | null };
}

interface AsanaTaskResponse {
  data: AsanaTask[];
  next_page?: { offset?: string | null };
}

interface AsanaOptions {
  token?: string;
  projectId?: string;
}

export default class AsanaProvider implements ImportProvider {
  name = "asana";

  async ingest(
    job: ImportJob,
    payload?: Record<string, unknown>
  ): Promise<ProviderResult> {
    const opts = ((payload?.sourceReference as AsanaOptions) ||
      (job.source_reference as any) ||
      {}) as AsanaOptions;
    if (!opts.token || !opts.projectId) {
      return { tasks: [], raw: { warning: "Missing Asana token/projectId" } };
    }

    const tasks: StageTaskRow[] = [];
    let offset: string | undefined;
    do {
      const page = await getWithRetries<AsanaTaskResponse>({
        method: "GET",
        url: `https://app.asana.com/api/1.0/projects/${opts.projectId}/tasks`,
        params: { limit: 50, offset },
        headers: { Authorization: `Bearer ${opts.token}` },
      });
      for (const t of page.data || []) {
        tasks.push({
          source_task_id: t.gid,
          title: t.name || "Untitled task",
          description: t.notes || null,
          due_at: t.due_on || null,
          start_at: t.start_on || null,
          assignee_source_id: t.assignee?.gid || null,
          raw: t,
        });
      }
      offset = page.next_page?.offset || undefined;
    } while (offset);

    return { tasks };
  }
}
