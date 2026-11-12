import { parentPort, workerData } from "worker_threads";
import { buildRoadmapExcel, buildRoadmapPdf, PreparedRoadmapExport } from "./roadmap-export";

interface WorkerInput {
  projectName: string;
  exportedOn: string;
  export: PreparedRoadmapExport;
}

const input = workerData as WorkerInput;
const generate = async (): Promise<void> => {
  if (!parentPort) throw new Error("Roadmap export worker requires a parent port");
  const common = {
    projectName: input.projectName,
    exportedOn: input.exportedOn,
    groupingLabel: input.export.groupingLabel,
    rows: input.export.rows,
  };
  const buffer = input.export.format === "pdf"
    ? await buildRoadmapPdf({ ...common, timelineStart: input.export.timelineStart, timelineEnd: input.export.timelineEnd })
    : await buildRoadmapExcel({ ...common, groupBy: input.export.groupBy });
  parentPort.postMessage(buffer);
};

void generate().catch(error => {
  // Throwing causes the worker's error event to reach the requesting process.
  setImmediate(() => { throw error; });
});
