import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import ImportsService, {
  AttachmentPlanRow,
  FieldMappingRow,
  StageTaskRow,
  UserMappingRow,
  ValueMappingRow,
} from "../services/imports-service";
import safeControllerFunction from "../shared/safe-controller-function";
import createHttpError from "http-errors";
import { ServerResponse } from "../models/server-response";
import ImportIngestionService from "../services/import-ingestion-service";
import axios from "axios";
import crypto from "crypto";
import { nanoid } from "nanoid";
import AsanaProvider from "../services/import-providers/asana-provider";
import JiraProvider from "../services/import-providers/jira-provider";
import TrelloProvider from "../services/import-providers/trello-provider";
import MondayProvider from "../services/import-providers/monday-provider";

const autoHierarchyTemplate = [
  { source_level: "Section", target_level: "Status", position: 1 },
  { source_level: "Task", target_level: "Task", position: 2 },
  { source_level: "Subtask", target_level: "Subtask", position: 3 },
  { source_level: "Nested subtask", target_level: "Subtask", position: 4 },
];

const autoFieldTemplate: FieldMappingRow[] = [
  {
    source_field: "Task name",
    target_field: "key",
    required: true,
    include: true,
  },
  {
    source_field: "Description",
    target_field: "description",
    required: false,
    include: true,
  },
  {
    source_field: "Assignee",
    target_field: "assignees",
    required: false,
    include: true,
  },
  {
    source_field: "Start date",
    target_field: "startDate",
    required: false,
    include: true,
  },
  {
    source_field: "Due date",
    target_field: "dueDate",
    required: false,
    include: true,
  },
  {
    source_field: "Section",
    target_field: "status",
    required: false,
    include: true,
  },
  {
    source_field: "Created by",
    target_field: "reporter",
    required: false,
    include: true,
  },
  {
    source_field: "Priority",
    target_field: "priority",
    required: false,
    include: true,
  },
  {
    source_field: "Status",
    target_field: "status",
    required: false,
    include: true,
  },
  {
    source_field: "Completed on",
    target_field: "completedDate",
    required: false,
    include: true,
  },
];

const asanaProvider = new AsanaProvider();
const jiraProvider = new JiraProvider();
const trelloProvider = new TrelloProvider();
const mondayProvider = new MondayProvider();

const REQUIRED_TARGET_MAPPINGS: Array<{
  target: string;
  fallbackSource: string;
}> = [
  { target: "key", fallbackSource: "Task name" },
  { target: "description", fallbackSource: "Description" },
  { target: "assignees", fallbackSource: "Assignee" },
  { target: "dueDate", fallbackSource: "Due date" },
  { target: "startDate", fallbackSource: "Start date" },
  { target: "status", fallbackSource: "Status" },
  { target: "reporter", fallbackSource: "Created by" },
];

const ensureRequiredTargets = (rows: FieldMappingRow[]): FieldMappingRow[] => {
  const presentTargets = new Set(
    rows
      .filter((row) => !!row.target_field)
      .map((row) => row.target_field.toLowerCase()),
  );
  REQUIRED_TARGET_MAPPINGS.forEach(({ target, fallbackSource }) => {
    if (!presentTargets.has(target.toLowerCase())) {
      rows.push({
        source_field: fallbackSource,
        target_field: target,
        include: true,
        required: target === "key",
      });
      presentTargets.add(target.toLowerCase());
    }
  });
  return rows;
};

const base64UrlEncode = (buffer: Buffer) =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const getAsanaRedirectUri = (): string => {
  if (process.env.ASANA_REDIRECT_URI) {
    return process.env.ASANA_REDIRECT_URI;
  }

  const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/+$/, "");
  if (!apiBaseUrl) {
    throw createHttpError(500, "ASANA_REDIRECT_URI or API_BASE_URL not configured");
  }

  return `${apiBaseUrl}/api/v1/imports/auth/asana/callback`;
};

const buildAsanaCallbackHtml = (
  title: string,
  message: string,
  status: "success" | "in_progress" | "already_connected" | "failed",
) => {
  const shouldAutoClose = status !== "failed";
  const autoCloseScript = shouldAutoClose
    ? `<script>
         (function () {
           try {
             if (window.opener && !window.opener.closed) {
               window.opener.postMessage({ type: "worklenz:asana-auth", status: "${status}" }, "*");
             }
           } catch (_error) {}
           setTimeout(function () {
             try { window.close(); } catch (_error) {}
           }, 300);
         })();
       </script>`
    : "";

  const closeHint = shouldAutoClose
    ? `<p style="margin-top: 16px; color: #666;">This window should close automatically. If it stays open, you can close it manually.</p>`
    : "";

  return `<html>
    <body style="font-family: Arial, sans-serif; padding: 24px;">
      <h2>${title}</h2>
      <p>${message}</p>
      ${closeHint}
      ${autoCloseScript}
    </body>
  </html>`;
};

export default class ImportsController {
  private static getUserId(req: IWorkLenzRequest): string {
    const id =
      req.user?.id || (req.user as any)?.user_id || (req.user as any)?.uid;
    if (!id) throw createHttpError(401, "Authentication required");
    return id;
  }

  private static async assertJob(jobId: string, _userId?: string) {
    const job = await ImportsService.getJob(jobId);
    if (job) return job;
    throw createHttpError(404, "Import job not found");
  }

  static create = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const {
        provider,
        flowType,
        targetProjectId,
        targetSpaceType,
        targetTemplate,
        sourceReference,
      } = req.body;
      const createdBy = this.getUserId(req);
      if (!provider || !flowType)
        throw createHttpError(400, "provider and flowType are required");
      const job = await ImportsService.createJob({
        provider,
        flowType,
        createdBy,
        targetProjectId,
        targetSpaceType,
        targetTemplate,
        sourceReference,
      });
      return res.status(200).send(new ServerResponse(true, job));
    },
  );

  static setSource = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);
      const {
        workspaceId,
        projectId,
        projectKey,
        projectName,
        token,
        key,
        boardId,
        boardName,
        importMembers,
        importAttachments,
      } = req.body || {};

      const providerKey = (job.provider || "asana").toLowerCase();
      const ref = (job.source_reference as any) || {};
      const optionsPatch =
        typeof importMembers === "boolean" ||
        typeof importAttachments === "boolean"
          ? {
              options: {
                ...(ref.options || {}),
                ...(typeof importMembers === "boolean" ? { importMembers } : {}),
                ...(typeof importAttachments === "boolean"
                  ? { importAttachments }
                  : {}),
              },
            }
          : {};

      const optionsOnlyUpdate =
        Object.keys(optionsPatch).length > 0 &&
        !workspaceId &&
        !projectId &&
        !projectKey &&
        !projectName &&
        !token &&
        !key &&
        !boardId &&
        !boardName;
      if (optionsOnlyUpdate) {
        await ImportsService.mergeSourceReference(job.id, optionsPatch);
        const updated = await ImportsService.getJob(job.id);
        return res.status(200).send(new ServerResponse(true, updated));
      }

      if (providerKey === "trello") {
        if (!boardId)
          throw createHttpError(
            400,
            "boardId is required for source selection",
          );

        const sourcePatch = {
          source: {
            ...(ref.source || {}),
            [providerKey]: {
              ...(ref.source?.[providerKey] || {}),
              boardId,
              boardName: boardName || null,
            },
          },
        } as Record<string, unknown>;

        const authPatch =
          key || token
            ? {
                auth: {
                  ...(ref.auth || {}),
                  [providerKey]: {
                    ...(ref.auth?.[providerKey] || {}),
                    key: key || ref.auth?.[providerKey]?.key || null,
                    access_token:
                      token || ref.auth?.[providerKey]?.access_token || null,
                  },
                },
              }
            : {};

        await ImportsService.mergeSourceReference(job.id, {
          ...sourcePatch,
          ...authPatch,
          ...optionsPatch,
        });
        const updated = await ImportsService.getJob(job.id);
        return res.status(200).send(new ServerResponse(true, updated));
      }

      if (!projectId && !projectKey)
        throw createHttpError(
          400,
          "projectId is required for source selection",
        );

      const resolvedProjectId = projectId || projectKey;
      const resolvedProjectKey = projectKey || projectId;

      const sourcePatch = {
        source: {
          ...(ref.source || {}),
          [providerKey]: {
            ...(ref.source?.[providerKey] || {}),
            workspaceId: workspaceId || null,
            projectId: resolvedProjectId,
            projectKey: resolvedProjectKey,
            projectName: projectName || null,
          },
        },
      } as Record<string, unknown>;

      const authPatch = token
        ? {
            auth: {
              ...(ref.auth || {}),
              [providerKey]: {
                ...(ref.auth?.[providerKey] || {}),
                access_token: token,
              },
            },
          }
        : {};

      await ImportsService.mergeSourceReference(job.id, {
        ...sourcePatch,
        ...authPatch,
        ...optionsPatch,
      });
      const updated = await ImportsService.getJob(job.id);
      return res.status(200).send(new ServerResponse(true, updated));
    },
  );

  static setTarget = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      this.getUserId(req); // ensure authenticated
      const job = await this.assertJob(req.params.jobId);
      const { targetProjectId, targetSpaceType, targetTemplate } =
        req.body || {};
      if (!targetProjectId)
        throw createHttpError(400, "targetProjectId is required");

      await ImportsService.updateJobTargets(
        job.id,
        targetProjectId,
        targetSpaceType,
        targetTemplate,
      );
      const updated = await ImportsService.getJob(job.id);
      return res.status(200).send(new ServerResponse(true, updated));
    },
  );

  static get = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const job = await ImportsService.getJob(req.params.jobId);
      if (!job) throw createHttpError(404, "Import job not found");
      return res.status(200).send(new ServerResponse(true, job));
    },
  );

  static autoHierarchy = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const jobId = req.params.jobId;
      const job = await ImportsService.getJob(jobId);
      if (!job) throw createHttpError(404, "Import job not found");
      let rows = autoHierarchyTemplate;
      const providerKey = (job.provider || "").toLowerCase();

      if (providerKey === "asana") {
        try {
          const auto = await asanaProvider.getAutoMappings(job, req.body);
          if (auto.hierarchy?.length) rows = auto.hierarchy;
        } catch (err) {
          await ImportsService.appendLog(
            job.id,
            "warn",
            "Asana auto hierarchy failed",
            {
              error: (err as any)?.message,
            },
          );
        }
      } else if (providerKey === "trello") {
        try {
          const auto = await trelloProvider.getAutoMappings(job, req.body);
          if (auto.hierarchy?.length) rows = auto.hierarchy;
        } catch (err) {
          await ImportsService.appendLog(
            job.id,
            "warn",
            "Trello auto hierarchy failed",
            {
              error: (err as any)?.message,
            },
          );
        }
      } else if (providerKey === "jira") {
        try {
          const auto = await jiraProvider.getAutoMappings(job, req.body);
          if (auto.hierarchy?.length) rows = auto.hierarchy;
        } catch (err) {
          await ImportsService.appendLog(
            job.id,
            "warn",
            "JIRA auto hierarchy failed",
            {
              error: (err as any)?.message,
            },
          );
        }
      }

      await ImportsService.upsertHierarchy(jobId, rows);
      return res.status(200).send(new ServerResponse(true, rows));
    },
  );

  static autoFields = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const jobId = req.params.jobId;
      const job = await ImportsService.getJob(jobId);
      if (!job) throw createHttpError(404, "Import job not found");
      let rows = autoFieldTemplate;
      const providerKey = (job.provider || "").toLowerCase();

      if (providerKey === "asana") {
        try {
          const auto = await asanaProvider.getAutoMappings(job, req.body);
          if (auto.fields?.length) rows = auto.fields as any;
        } catch (err) {
          await ImportsService.appendLog(
            job.id,
            "warn",
            "Asana auto fields failed",
            {
              error: (err as any)?.message,
            },
          );
        }
      } else if (providerKey === "trello") {
        try {
          const auto = await trelloProvider.getAutoMappings(job, req.body);
          if (auto.fields?.length) rows = auto.fields as any;
        } catch (err) {
          await ImportsService.appendLog(
            job.id,
            "warn",
            "Trello auto fields failed",
            {
              error: (err as any)?.message,
            },
          );
        }
      } else if (providerKey === "jira") {
        try {
          const auto = await jiraProvider.getAutoMappings(job, req.body);
          if (auto.fields?.length) rows = auto.fields as any;
        } catch (err) {
          await ImportsService.appendLog(
            job.id,
            "warn",
            "JIRA auto fields failed",
            {
              error: (err as any)?.message,
            },
          );
        }
      } else if (providerKey === "monday") {
        try {
          const auto = await mondayProvider.getAutoMappings(job, req.body);
          if (auto.fields?.length) rows = auto.fields as any;
        } catch (err) {
          await ImportsService.appendLog(
            job.id,
            "warn",
            "Monday auto fields failed",
            {
              error: (err as any)?.message,
            },
          );
        }
      }

      rows = ensureRequiredTargets(rows);
      await ImportsService.upsertFields(jobId, rows);
      return res.status(200).send(new ServerResponse(true, rows));
    },
  );

  static saveFields = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const jobId = req.params.jobId;
      const rows = req.body?.fields || [];
      if (!Array.isArray(rows))
        throw createHttpError(400, "fields must be array");
      const job = await ImportsService.getJob(jobId);
      if (!job) throw createHttpError(404, "Import job not found");
      await ImportsService.upsertFields(jobId, rows);
      return res.status(200).send(new ServerResponse(true, rows));
    },
  );

  static saveHierarchy = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);
      const rows = req.body?.hierarchy || [];
      if (!Array.isArray(rows))
        throw createHttpError(400, "hierarchy must be array");
      await ImportsService.upsertHierarchy(job.id, rows);
      return res.status(200).send(new ServerResponse(true, rows));
    },
  );

  static saveValueMappings = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);
      const rows = (req.body?.values as ValueMappingRow[]) || [];
      if (!Array.isArray(rows))
        throw createHttpError(400, "values must be array");
      await ImportsService.upsertValueMappings(job.id, rows);
      return res.status(200).send(new ServerResponse(true, rows));
    },
  );

  static saveUserMappings = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);
      const rows = (req.body?.users as UserMappingRow[]) || [];
      if (!Array.isArray(rows))
        throw createHttpError(400, "users must be array");
      await ImportsService.upsertUserMappings(job.id, rows);
      return res.status(200).send(new ServerResponse(true, rows));
    },
  );

  static saveAttachments = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);
      const rows = (req.body?.attachments as AttachmentPlanRow[]) || [];
      if (!Array.isArray(rows))
        throw createHttpError(400, "attachments must be array");
      await ImportsService.upsertAttachmentPlans(job.id, rows);
      return res.status(200).send(new ServerResponse(true, rows));
    },
  );

  static saveStageTasks = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);
      const rows = (req.body?.tasks as StageTaskRow[]) || [];
      if (!Array.isArray(rows))
        throw createHttpError(400, "tasks must be array");
      await ImportsService.upsertStageTasks(job.id, rows);
      return res.status(200).send(new ServerResponse(true, rows));
    },
  );

  static listStageTasks = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);
      const tasks = await ImportsService.listStageTasks(job.id);
      return res.status(200).send(new ServerResponse(true, tasks));
    },
  );

  static progress = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);
      const data = await ImportsService.progress(job.id);
      return res.status(200).send(new ServerResponse(true, data));
    },
  );

  static ingest = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);
      const body = req.body || {};

      // CSV flow: persist the raw CSV text and any pre-configured mappings in
      // source_reference, then hand off to the background worker. This avoids
      // parsing tens-of-thousands of rows inside an HTTP request handler.
      if (job.flow_type === "csv" && body.csvText) {
        const patch: Record<string, unknown> = { csvText: body.csvText };
        if (body.fields) patch.fields = body.fields;
        if (body.values) patch.values = body.values;
        if (body.users) patch.users = body.users;
        await ImportsService.mergeSourceReference(job.id, patch);
        await ImportsService.updateJobStatus(job.id, "ready");
        const data = await ImportsService.progress(job.id);
        return res.status(202).send(new ServerResponse(true, data));
      }

      // Direct integrations (Asana, Jira, Trello, Monday, ClickUp): run
      // ingestion synchronously so staged data is available immediately.
      try {
        const result = await ImportIngestionService.ingest(job, body);
        await ImportsService.updateJobStatus(job.id, "ready");
        const data = await ImportsService.progress(job.id);
        return res
          .status(200)
          .send(new ServerResponse(true, { ...data, ingest: result }));
      } catch (err: any) {
        await ImportsService.updateJobStatus(job.id, "failed", err?.message || "Ingest failed");
        if (job.target_project_id) {
          try {
            await ImportsService.deleteTargetProject(job.target_project_id);
          } catch {
            // Ignore cleanup errors — don't mask the original error
          }
        }
        const message = err?.status ? err.message : "Failed to process the import file. Please check your file and try again.";
        throw createHttpError(err?.status || 422, message);
      }
    },
  );

  static logs = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);
      const logs = await ImportsService.listLogs(job.id);
      return res.status(200).send(new ServerResponse(true, logs));
    },
  );

  static commit = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);

      // Run the commit pipeline asynchronously to avoid request timeouts for large imports.
      // Progress can be tracked via GET /api/v1/imports/:jobId/progress.
      if (job.status !== "running") {
        // Optimistically mark as running so the UI can reflect "in progress" immediately.
        await ImportsService.updateJobStatus(job.id, "running");
        void ImportsService.commit(job.id).catch(() => {
          // Errors are persisted by the service (status + logs); avoid unhandled rejections.
        });
      }

      const data = await ImportsService.progress(job.id);
      return res.status(202).send(new ServerResponse(true, data));
    },
  );

  static cancel = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);
      await ImportsService.cancel(job.id, req.body?.message);
      const data = await ImportsService.progress(job.id);
      return res.status(200).send(new ServerResponse(true, data));
    },
  );

  // --- Auth flows ---
  static startAsanaAuth = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);

      const clientId = process.env.ASANA_CLIENT_ID;
      const redirectUri = getAsanaRedirectUri();
      if (!clientId)
        throw createHttpError(500, "ASANA_CLIENT_ID not configured");

      const state = nanoid(24);
      const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
      const pkceEnabled =
        !process.env.ASANA_PKCE_ENABLED ||
        process.env.ASANA_PKCE_ENABLED !== "false";
      const codeChallenge = pkceEnabled
        ? base64UrlEncode(
            crypto.createHash("sha256").update(codeVerifier).digest(),
          )
        : undefined;

      await ImportsService.mergeSourceReference(job.id, {
        auth: {
          ...(job.source_reference as any)?.auth,
          asana: { state, code_verifier: codeVerifier },
        },
      });

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        state: `${job.id}:${state}`,
      });
      if (pkceEnabled && codeChallenge) {
        params.append("code_challenge", codeChallenge);
        params.append("code_challenge_method", "S256");
      }

      const authUrl = `https://app.asana.com/-/oauth_authorize?${params.toString()}`;
      return res.status(200).send(new ServerResponse(true, { authUrl, state }));
    },
  );

  static asanaCallback = safeControllerFunction(async (req, res) => {
    const preferredResponseType = req.accepts(["html", "json"]);
    const wantsJsonResponse =
      (req.query as any)?.format === "json" || preferredResponseType === "json";

    const code = req.query?.code as string | undefined;
    const stateParam = req.query?.state as string | undefined;
    if (!code || !stateParam)
      throw createHttpError(400, "Missing code or state");

    const [jobId, incomingState] = stateParam.split(":");
    const job = await ImportsService.getJob(jobId);
    if (!job) throw createHttpError(404, "Import job not found");
    const ref = (job.source_reference as any) || {};
    const savedState = ref?.auth?.asana?.state;
    const codeVerifier = ref?.auth?.asana?.code_verifier;
    if (!savedState || savedState !== incomingState)
      throw createHttpError(400, "State mismatch");

    const redirectUri = getAsanaRedirectUri();
    const clientId = process.env.ASANA_CLIENT_ID;
    const clientSecret = process.env.ASANA_CLIENT_SECRET;
    if (!clientId || !clientSecret)
      throw createHttpError(500, "Asana client credentials not configured");

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });
    if (codeVerifier) body.append("code_verifier", codeVerifier);

    // If we already have an access_token for this job, treat callback as idempotent
    const existingAccess = ref?.auth?.asana?.access_token;
    if (existingAccess) {
      const payload = {
        authorized: true,
        workspaces: (ref?.auth?.asana?.workspaces as any) || [],
        projects: (ref?.auth?.asana?.projects as any) || [],
      };
      if (wantsJsonResponse) {
        return res.status(200).send(new ServerResponse(true, payload));
      }
      return res.status(200).send(
        buildAsanaCallbackHtml(
          "Asana already connected",
          "This import job already has Asana credentials. You can close this window and return to Worklenz.",
          "already_connected",
        ),
      );
    }

    // Avoid concurrent exchanges: if another process is handling this job, return a friendly page
    if (ref?.auth?.asana?.in_progress) {
      if (wantsJsonResponse) {
        return res
          .status(202)
          .send(
            new ServerResponse(true, { message: "authorization_in_progress" }),
          );
      }
      return res.status(200).send(
        buildAsanaCallbackHtml(
          "Authorization in progress",
          "The authorization is currently being processed. Please close this window and return to Worklenz. It will update automatically shortly.",
          "in_progress",
        ),
      );
    }

    // Mark in-progress to help avoid duplicate exchanges
    await ImportsService.mergeSourceReference(job.id, {
      auth: {
        ...(ref?.auth || {}),
        asana: {
          ...(ref?.auth?.asana || {}),
          in_progress: true,
        },
      },
    });

    let tokenResp: any;
    try {
      tokenResp = await axios.post(
        "https://app.asana.com/-/oauth_token",
        body.toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      // Common cause: authorization `code` was already used or expired
      if (status === 400 && data?.error === "invalid_grant") {
        if (wantsJsonResponse) {
          return res.status(400).send(
            new ServerResponse(false, {
              message: "authorization_code_invalid_or_used",
            }),
          );
        }
        return res.status(200).send(
          buildAsanaCallbackHtml(
            "Authorization failed",
            'The authorization code appears to be invalid or already used. Please close this window and retry the "Connect" flow from Worklenz (create a fresh import job and click Connect).',
            "failed",
          ),
        );
      }
      throw err;
    }

    const { access_token, refresh_token, expires_in } = tokenResp.data || {};
    if (!access_token)
      throw createHttpError(400, "Failed to exchange Asana token");

    // If we already have an access_token for this job, treat callback as idempotent
    const existingAccessAfterExchange = ref?.auth?.asana?.access_token;
    if (existingAccessAfterExchange) {
      // Already authorized for this job — return success without re-exchanging
      const payload = {
        authorized: true,
        workspaces: (ref?.auth?.asana?.workspaces as any) || [],
        projects: (ref?.auth?.asana?.projects as any) || [],
      };
      if (wantsJsonResponse) {
        return res.status(200).send(new ServerResponse(true, payload));
      }
      return res.status(200).send(
        buildAsanaCallbackHtml(
          "Asana already connected",
          "This import job already has Asana credentials. You can close this window and return to Worklenz.",
          "already_connected",
        ),
      );
    }

    const authHeader = { Authorization: `Bearer ${access_token}` };
    const workspacesResp = await axios.get(
      "https://app.asana.com/api/1.0/workspaces",
      {
        headers: authHeader,
        params: { limit: 100 },
      },
    );
    const workspaces = (workspacesResp.data?.data || []).map((w: any) => ({
      id: w.gid,
      name: w.name,
    }));

    const projects: Array<{ id: string; name: string; workspaceId: string }> =
      [];
    for (const ws of workspaces.slice(0, 3)) {
      try {
        const pResp = await axios.get(
          `https://app.asana.com/api/1.0/workspaces/${ws.id}/projects`,
          { headers: authHeader, params: { limit: 50 } },
        );
        (pResp.data?.data || []).forEach((p: any) => {
          projects.push({ id: p.gid, name: p.name, workspaceId: ws.id });
        });
      } catch (err) {
        await ImportsService.appendLog(
          job.id,
          "warn",
          "Asana projects fetch failed",
          {
            workspaceId: ws.id,
            error: (err as any)?.message,
          },
        );
      }
    }

    await ImportsService.mergeSourceReference(job.id, {
      auth: {
        ...(ref?.auth || {}),
        asana: {
          // Preserve previous auth metadata (state/code_verifier) to allow idempotent callbacks
          ...(ref?.auth?.asana || {}),
          access_token,
          refresh_token: refresh_token || null,
          expires_at: expires_in
            ? new Date(Date.now() + expires_in * 1000).toISOString()
            : null,
          workspaces,
          projects,
          in_progress: false,
        },
      },
    });

    const payload = { authorized: true, workspaces, projects };
    if (wantsJsonResponse) {
      return res.status(200).send(new ServerResponse(true, payload));
    }

    return res.status(200).send(
      buildAsanaCallbackHtml(
        "Asana connected",
        "You can close this window and return to Worklenz.",
        "success",
      ),
    );
  });

  static mondayValidate = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);
      const token = (req.body?.token as string | undefined)?.trim();
      if (!token) throw createHttpError(400, "token is required");

      const query = "query { boards(limit: 25) { id name } }";
      const { data } = await axios.post(
        "https://api.monday.com/v2",
        { query },
        {
          headers: { "Content-Type": "application/json", Authorization: token },
        },
      );

      const boards = (data?.data?.boards || []).map((b: any) => ({
        id: b.id,
        name: b.name,
      }));

      await ImportsService.mergeSourceReference(job.id, {
        auth: {
          ...(job.source_reference as any)?.auth,
          monday: { token, boards },
        },
      });

      return res
        .status(200)
        .send(new ServerResponse(true, { authorized: true, boards }));
    },
  );

  static clickupWorkspaces = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);
      const token = (req.body?.token as string | undefined)?.trim();
      if (!token) throw createHttpError(400, "token is required");

      const authHeader = { Authorization: token };
      const teamsResp = await axios.get("https://api.clickup.com/api/v2/team", {
        headers: authHeader,
      });

      const teamsRaw = teamsResp.data?.teams || [];
      const teams: Array<{
        id: string;
        name: string;
        spaces: Array<{
          id: string;
          name: string;
          lists: Array<{ id: string; name: string }>;
        }>;
      }> = [];

      for (const t of teamsRaw) {
        const teamItem = {
          id: t.id?.toString?.() || "",
          name: t.name,
          spaces: [] as any[],
        };
        try {
          const spacesResp = await axios.get(
            `https://api.clickup.com/api/v2/team/${teamItem.id}/space`,
            { headers: authHeader, params: { archived: false } },
          );
          const spacesRaw = spacesResp.data?.spaces || [];
          for (const s of spacesRaw.slice(0, 5)) {
            const space = {
              id: s.id?.toString?.() || "",
              name: s.name,
              lists: [] as any[],
            };
            try {
              const listsResp = await axios.get(
                `https://api.clickup.com/api/v2/space/${space.id}/list`,
                { headers: authHeader, params: { archived: false } },
              );
              const listsRaw = listsResp.data?.lists || [];
              space.lists = listsRaw
                .slice(0, 50)
                .map((l: any) => ({ id: l.id, name: l.name }));
            } catch (err) {
              await ImportsService.appendLog(
                job.id,
                "warn",
                "ClickUp lists fetch failed",
                {
                  spaceId: space.id,
                  error: (err as any)?.message,
                },
              );
            }
            teamItem.spaces.push(space);
          }
        } catch (err) {
          await ImportsService.appendLog(
            job.id,
            "warn",
            "ClickUp spaces fetch failed",
            {
              teamId: teamItem.id,
              error: (err as any)?.message,
            },
          );
        }
        teams.push(teamItem);
      }

      await ImportsService.mergeSourceReference(job.id, {
        auth: {
          ...(job.source_reference as any)?.auth,
          clickup: { token, teams },
        },
      });

      return res
        .status(200)
        .send(new ServerResponse(true, { authorized: true, teams }));
    },
  );

  static trelloValidate = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);

      const key = (req.body?.key as string | undefined)?.trim() || "";
      const token = (req.body?.token as string | undefined)?.trim() || "";
      if (!key) throw createHttpError(400, "key is required");
      if (!token) throw createHttpError(400, "token is required");

      let boards: Array<{ id: string; name: string; url?: string }> = [];
      try {
        const boardsResp = await axios.get(
          "https://api.trello.com/1/members/me/boards",
          {
            params: { key, token, fields: "name,url,shortUrl,closed" },
          },
        );

        boards = (boardsResp.data || [])
          .filter((b: any) => b && b.id && b.name && b.closed !== true)
          .map((b: any) => ({
            id: b.id?.toString?.() || "",
            name: b.name,
            url: b.url || b.shortUrl || "",
          }));
      } catch (err) {
        await ImportsService.appendLog(
          job.id,
          "warn",
          "Trello boards fetch failed",
          {
            error: (err as any)?.message,
          },
        );
        throw createHttpError(
          401,
          "Invalid Trello credentials. Please check your key and token.",
        );
      }

      await ImportsService.mergeSourceReference(job.id, {
        auth: {
          ...(job.source_reference as any)?.auth,
          trello: { key, token, boards },
        },
      });

      return res
        .status(200)
        .send(new ServerResponse(true, { authorized: true, boards }));
    },
  );

  static jiraValidate = safeControllerFunction(
    async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
      const userId = this.getUserId(req);
      const job = await this.assertJob(req.params.jobId, userId);

      // Extract and clean the token - remove any comment lines or extra whitespace
      let token = (req.body?.token as string | undefined)?.trim() || "";
      // Remove comment lines (lines starting with # or //)
      token = token
        .split("\n")
        .filter(
          (line) =>
            !line.trim().startsWith("#") && !line.trim().startsWith("//"),
        )
        .join("")
        .trim();

      const email = (req.body?.email as string | undefined)?.trim();
      const domain = (req.body?.domain as string | undefined)?.trim();

      if (!token) throw createHttpError(400, "token is required");
      if (!email) throw createHttpError(400, "email is required");
      if (!domain) throw createHttpError(400, "domain is required");

      // Remove protocol and trailing slashes from domain
      const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const baseUrl = `https://${cleanDomain}`;

      // Create Basic Auth header
      const authString = Buffer.from(`${email}:${token}`).toString("base64");
      const authHeader = { Authorization: `Basic ${authString}` };

      // Validate credentials by fetching current user
      try {
        const response = await axios.get(`${baseUrl}/rest/api/3/myself`, {
          headers: authHeader,
        });
        void response;
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          // Use 422 instead of 401 to avoid the frontend's global session-expiry redirect
          throw createHttpError(
            422,
            "Invalid JIRA credentials. Please check your email, API token, and domain.",
          );
        }
        throw createHttpError(
          500,
          `Failed to connect to JIRA: ${err?.message || "Unknown error"}`,
        );
      }

      // Fetch projects
      let projects: Array<{ key: string; name: string }> = [];
      try {
        const projectsResp = await axios.get(
          `${baseUrl}/rest/api/3/project/search`,
          {
            headers: authHeader,
            params: { maxResults: 100 },
          },
        );
        projects = (projectsResp.data?.values || []).map((p: any) => ({
          key: p.key,
          name: p.name,
        }));
      } catch (err) {
        await ImportsService.appendLog(
          job.id,
          "warn",
          "JIRA projects fetch failed",
          {
            error: (err as any)?.message,
          },
        );
      }

      // Store credentials in job
      await ImportsService.mergeSourceReference(job.id, {
        auth: {
          ...(job.source_reference as any)?.auth,
          jira: {
            api_token: token,
            email,
            domain: cleanDomain,
            projects,
          },
        },
      });

      return res
        .status(200)
        .send(new ServerResponse(true, { authorized: true, projects }));
    },
  );
}
