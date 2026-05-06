import { ImportJob } from "../imports-service";
import {
  AttachmentPlanRow,
  StageTaskRow,
  UserMappingRow,
  ValueMappingRow,
} from "../imports-service";

export interface ProviderResult {
  hierarchy?: Array<{
    source_level: string;
    target_level: string;
    position: number;
  }>;
  fields?: Array<{
    source_field: string;
    target_field: string;
    required?: boolean;
    include?: boolean;
  }>;
  values?: ValueMappingRow[];
  attachments?: AttachmentPlanRow[];
  tasks?: StageTaskRow[];
  users?: UserMappingRow[];
  raw?: unknown;
}

export interface ImportProvider {
  name: string;
  ingest(
    job: ImportJob,
    payload?: Record<string, unknown>
  ): Promise<ProviderResult>;
}
