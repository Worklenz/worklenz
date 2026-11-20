import ImportsService from "./imports-service";
import { ImportJob } from "./imports-service";
import AsanaProvider from "./import-providers/asana-provider";
import MondayProvider from "./import-providers/monday-provider";
import ClickUpProvider from "./import-providers/clickup-provider";
import TrelloProvider from "./import-providers/trello-provider";
import JiraProvider from "./import-providers/jira-provider";
import CsvProvider from "./import-providers/csv-provider";
import createHttpError from "http-errors";
import {
  ImportProvider,
  ProviderResult,
} from "./import-providers/provider-types";

const providers: Record<string, ImportProvider> = {
  asana: new AsanaProvider(),
  monday: new MondayProvider(),
  clickup: new ClickUpProvider(),
  trello: new TrelloProvider(),
  jira: new JiraProvider(),
  csv: new CsvProvider(),
};

class ImportIngestionService {
  async ingest(job: ImportJob, payload?: Record<string, unknown>) {
    const providerKey = (job.provider || "").toLowerCase();
    const provider = Object.prototype.hasOwnProperty.call(providers, providerKey)
      ? providers[providerKey]
      : job.flow_type === "csv" ? providers.csv : undefined;
    if (!provider) throw createHttpError(400, "Unsupported import provider");
    const result = await provider.ingest(job, payload);
    if (result.hierarchy?.length)
      await ImportsService.upsertHierarchy(job.id, result.hierarchy);
    if (result.fields?.length)
      await ImportsService.upsertFields(job.id, result.fields);
    if (result.values?.length)
      await ImportsService.upsertValueMappings(job.id, result.values);
    if (result.attachments?.length)
      await ImportsService.upsertAttachmentPlans(job.id, result.attachments);
    if (result.tasks?.length)
      await ImportsService.upsertStageTasks(job.id, result.tasks);
    if (result.users?.length)
      await ImportsService.upsertUserMappings(job.id, result.users);
    return result;
  }
}

export default new ImportIngestionService();
