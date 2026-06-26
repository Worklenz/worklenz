import { Schema } from "jsonschema";
import schemaValidator from "../schema-validator";

const providerEnum = ["asana", "monday", "clickup", "trello", "jira", "csv"];

const createSchema: Schema = {
  type: "object",
  properties: {
    provider: {
      type: "string",
      enum: providerEnum,
    },
    flowType: {
      type: "string",
      enum: ["direct", "csv"],
    },
    targetProjectId: { type: "string" },
    targetSpaceType: { type: "string" },
    targetTemplate: { type: "string" },
    sourceReference: { type: "object" },
  },
  required: ["provider", "flowType"],
  additionalProperties: true,
};

const sourceSchema: Schema = {
  type: "object",
  properties: {
    workspaceId: { type: ["string", "null"] },
    projectId: { type: ["string", "null"] },
    projectKey: { type: ["string", "null"] },
    projectName: { type: ["string", "null"] },
    token: { type: ["string", "null"] },
    key: { type: ["string", "null"] },
    boardId: { type: ["string", "null"] },
    boardName: { type: ["string", "null"] },
    importMembers: { type: "boolean" },
    importAttachments: { type: "boolean" },
  },
  required: [],
  additionalProperties: false,
};

const fieldsSchema: Schema = {
  type: "object",
  properties: {
    fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source_field: { type: "string" },
          target_field: { type: "string" },
          required: { type: "boolean" },
          include: { type: "boolean" },
        },
        required: ["source_field", "target_field"],
        additionalProperties: true,
      },
    },
  },
  required: ["fields"],
  additionalProperties: false,
};

const hierarchySchema: Schema = {
  type: "object",
  properties: {
    hierarchy: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source_level: { type: "string" },
          target_level: { type: "string" },
          position: { type: "integer" },
        },
        required: ["source_level", "target_level"],
        additionalProperties: true,
      },
    },
  },
  required: ["hierarchy"],
  additionalProperties: false,
};

const valuesSchema: Schema = {
  type: "object",
  properties: {
    values: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source_value: { type: "string" },
          target_worktype: { type: "string" },
          include: { type: "boolean" },
        },
        required: ["source_value", "target_worktype"],
        additionalProperties: true,
      },
    },
  },
  required: ["values"],
  additionalProperties: false,
};

const usersSchema: Schema = {
  type: "object",
  properties: {
    users: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source_user_id: { type: ["string", "null"] },
          source_email: { type: ["string", "null"] },
          target_user_id: { type: ["string", "null"] },
          resolution: { type: "string" },
          include: { type: "boolean" },
        },
        additionalProperties: true,
      },
    },
  },
  required: ["users"],
  additionalProperties: false,
};

const attachmentsSchema: Schema = {
  type: "object",
  properties: {
    attachments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source_url: { type: "string" },
          filename: { type: ["string", "null"] },
          content_type: { type: ["string", "null"] },
          size_bytes: { type: ["integer", "null"], maximum: 10485760 },
          status: { type: "string" },
        },
        required: ["source_url"],
        additionalProperties: true,
      },
    },
  },
  required: ["attachments"],
  additionalProperties: false,
};

const tasksSchema: Schema = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source_task_id: { type: ["string", "null"] },
          parent_source_task_id: { type: ["string", "null"] },
          title: { type: "string" },
          description: { type: ["string", "null"] },
          status: { type: ["string", "null"] },
          due_at: { type: ["string", "null"] },
          start_at: { type: ["string", "null"] },
          worktype: { type: ["string", "null"] },
          assignee_source_id: { type: ["string", "null"] },
          attachments_planned: { type: "boolean" },
        },
        required: ["title"],
        additionalProperties: true,
      },
    },
  },
  required: ["tasks"],
  additionalProperties: false,
};

const ingestSchema: Schema = {
  type: "object",
  properties: {
    csvText: { type: "string", maxLength: 10000000, message: "CSV file is too large. Please keep the file under 10 MB or split it into smaller batches." } as any,
    sourceReference: { type: "object" },
  },
  additionalProperties: true,
};

const targetSchema: Schema = {
  type: "object",
  properties: {
    targetProjectId: { type: "string" },
    targetSpaceType: { type: ["string", "null"] },
    targetTemplate: { type: ["string", "null"] },
  },
  required: ["targetProjectId"],
  additionalProperties: false,
};

export const validateCreate = schemaValidator(createSchema);
export const validateFields = schemaValidator(fieldsSchema);
export const validateHierarchy = schemaValidator(hierarchySchema);
export const validateValues = schemaValidator(valuesSchema);
export const validateUsers = schemaValidator(usersSchema);
export const validateAttachments = schemaValidator(attachmentsSchema);
export const validateTasks = schemaValidator(tasksSchema);
export const validateIngest = schemaValidator(ingestSchema);
export const validateTarget = schemaValidator(targetSchema);
export const validateSource = schemaValidator(sourceSchema);
export { providerEnum };
