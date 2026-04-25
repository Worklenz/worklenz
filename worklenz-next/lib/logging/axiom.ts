import { Axiom } from "@axiomhq/js";

const axiom = new Axiom({
  token: process.env.AXIOM_TOKEN,
  orgId: process.env.AXIOM_ORG_ID
});

const dataset = process.env.AXIOM_DATASET ?? "prelim";

export async function logInfo(event: string, data: Record<string, unknown>) {
  await axiom.ingest(dataset, [{ level: "info", event, ...data }]);
  await axiom.flush();
}

export async function logError(event: string, data: Record<string, unknown>) {
  await axiom.ingest(dataset, [{ level: "error", event, ...data }]);
  await axiom.flush();
}
