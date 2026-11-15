import path from "path";
import { Worker } from "worker_threads";
import { PreparedRoadmapExport } from "./roadmap-export";

const MAX_ACTIVE_EXPORTS = 2;
const EXPORT_TIMEOUT_MS = 60_000;
const activeUsers = new Set<string>();
const activeProjects = new Set<string>();
let activeCount = 0;

export class RoadmapExportBusyError extends Error {}

export interface RoadmapExportWorkerInput {
  projectName: string;
  exportedOn: string;
  export: PreparedRoadmapExport;
}

/** Bound memory and CPU per API process and keep rendering off the event loop. */
export const runRoadmapExport = async (
  userId: string,
  projectId: string,
  input: RoadmapExportWorkerInput,
  signal?: AbortSignal
): Promise<Buffer> => {
  if (signal?.aborted) throw new Error("Roadmap export cancelled");
  if (activeCount >= MAX_ACTIVE_EXPORTS || activeUsers.has(userId) || activeProjects.has(projectId)) {
    throw new RoadmapExportBusyError("Roadmap export capacity is busy");
  }
  activeCount += 1;
  activeUsers.add(userId);
  activeProjects.add(projectId);
  let worker: Worker | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    worker = new Worker(path.join(__dirname, "roadmap-export-worker.js"), {
      workerData: input,
      resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32 },
    });
    const currentWorker = worker;
    return await new Promise<Buffer>((resolve, reject) => {
      let result: Buffer | undefined;
      let failure: Error | undefined;
      currentWorker.once("message", (bytes: Uint8Array) => { result = Buffer.from(bytes); });
      currentWorker.once("error", error => { failure = error; });
      currentWorker.once("exit", code => {
        if (failure) reject(failure);
        else if (code !== 0 || !result) reject(new Error("Roadmap export worker exited without a result"));
        else resolve(result);
      });
      onAbort = () => { failure = new Error("Roadmap export cancelled"); void currentWorker.terminate(); };
      signal?.addEventListener("abort", onAbort, { once: true });
      timeout = setTimeout(() => {
        failure = new Error("Roadmap export timed out");
        void currentWorker.terminate();
      }, EXPORT_TIMEOUT_MS);
      if (signal?.aborted) onAbort();
    });
  } finally {
    if (timeout) clearTimeout(timeout);
    if (onAbort) signal?.removeEventListener("abort", onAbort);
    activeCount -= 1;
    activeUsers.delete(userId);
    activeProjects.delete(projectId);
  }
};
