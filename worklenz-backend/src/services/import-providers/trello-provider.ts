import { ImportProvider, ProviderResult } from "./provider-types";
import {
  AttachmentPlanRow,
  FieldMappingRow,
  ImportJob,
  StageTaskRow,
  UserMappingRow,
} from "../imports-service";
import { getWithRetries } from "./http-utils";

interface TrelloOptions {
  key?: string;
  token?: string;
  boardId?: string;
  boardName?: string | null;
}

interface TrelloList {
  id: string;
  name?: string;
  closed?: boolean;
  pos?: number;
}

interface TrelloLabel {
  id: string;
  name?: string;
  color?: string | null;
}

interface TrelloMember {
  id: string;
  fullName?: string;
  username?: string;
  email?: string | null;
}

interface TrelloAttachment {
  id: string;
  name?: string;
  url?: string;
  bytes?: number | null;
  mimeType?: string | null;
  date?: string;
}

interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  due?: string | null;
  start?: string | null;
  dueComplete?: boolean;
  idAttachmentCover?: string | null;
  idList?: string;
  idMembers?: string[];
  idLabels?: string[];
  shortUrl?: string;
  dateLastActivity?: string;
  attachments?: TrelloAttachment[];
  customFieldItems?: TrelloCustomFieldItem[];
}

interface TrelloCustomField {
  id: string;
  name?: string;
  type?: string;
}

interface TrelloCustomFieldItemValue {
  text?: string;
  number?: string;
  date?: string;
  checked?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

interface TrelloCustomFieldItem {
  idCustomField?: string;
  value?: TrelloCustomFieldItemValue | null;
}

const DEFAULT_FIELDS: FieldMappingRow[] = [
  {
    source_field: "Card name",
    target_field: "key",
    required: true,
    include: true,
  },
  { source_field: "Description", target_field: "description", include: true },
  { source_field: "List", target_field: "status", include: true },
  { source_field: "Due date", target_field: "dueDate", include: true },
  { source_field: "Start date", target_field: "startDate", include: true },
  { source_field: "Members", target_field: "assignees", include: true },
  { source_field: "Labels", target_field: "labels", include: true },
  { source_field: "Location", target_field: "location", include: true },
  {
    source_field: "Completed on",
    target_field: "completedDate",
    include: true,
  },
  { source_field: "Last updated", target_field: "lastUpdated", include: true },
];

export default class TrelloProvider implements ImportProvider {
  name = "trello";
  private customFieldsCache?: TrelloCustomField[];

  private resolveOptions(
    job: ImportJob,
    payload?: Record<string, unknown>,
  ): Required<Pick<TrelloOptions, "key" | "token" | "boardId">> &
    TrelloOptions {
    const ref = (job.source_reference as any) || {};
    const payloadRef = (payload?.sourceReference as TrelloOptions) || {};
    const providerKey = (job.provider || "trello").toLowerCase();
    const auth = (ref.auth?.[providerKey] as any) || {};
    const sourceSelection = (ref.source?.[providerKey] as any) || ref || {};

    const key = payloadRef.key || auth.key || null;
    const token = payloadRef.token || auth.token || auth.access_token || null;
    const boardId =
      payloadRef.boardId || sourceSelection.boardId || ref.boardId || null;
    const boardName =
      payloadRef.boardName ||
      sourceSelection.boardName ||
      ref.boardName ||
      null;

    if (!key || !token || !boardId) {
      throw new Error("Missing Trello key/token/board selection");
    }

    return { key, token, boardId, boardName };
  }

  private buildHierarchy(
    lists: TrelloList[],
  ): NonNullable<ProviderResult["hierarchy"]> {
    if (!lists.length) {
      return [
        { source_level: "List", target_level: "Status", position: 1 },
        { source_level: "Card", target_level: "Task", position: 2 },
      ];
    }

    return lists.map((list, index) => ({
      source_level: list.name || `List ${index + 1}`,
      target_level: "Status",
      position: index + 1,
    }));
  }

  private extractCustomFieldValue(value: any): string | null {
    if (!value) return null;

    // Handle string values directly
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    // Handle object values
    if (typeof value === "object") {
      // Text fields
      if (value.text && typeof value.text === "string") {
        return value.text.trim() || null;
      }

      // Number fields
      if (typeof value.number === "number") {
        return String(value.number);
      }

      // Date fields
      if (value.date && typeof value.date === "string") {
        return value.date;
      }

      // Checkbox fields
      if (typeof value.checked === "boolean") {
        return value.checked ? "true" : "false";
      }

      // List/dropdown fields
      if (value.idValue && typeof value.idValue === "string") {
        return value.idValue;
      }
    }

    return null;
  }

  private buildFieldMappings(
    customFields?: TrelloCustomField[],
  ): FieldMappingRow[] {
    const mappings = [...DEFAULT_FIELDS];

    // Add dynamic custom fields from Trello
    if (customFields) {
      customFields.forEach((field) => {
        if (field.name && field.id) {
          // Skip location field as it's already in DEFAULT_FIELDS
          const isLocationField =
            field.type === "location" ||
            field.name.toLowerCase().includes("location") ||
            field.name === "Location";
          if (!isLocationField) {
            const targetField = field.name.toLowerCase().replace(/\s+/g, "_");
            mappings.push({
              source_field: field.name,
              target_field: targetField,
              include: true,
            });
          }
        }
      });
    }

    return mappings;
  }

  private buildRawCard(
    card: TrelloCard,
    listName: string,
    memberNames: string[],
    labelNames: string[],
    locationDisplay?: string,
  ): Record<string, unknown> {
    return {
      "Card name": card.name || "",
      Description: card.desc || "",
      List: listName,
      Status: listName,
      "Due date": card.due || "",
      "Start date": card.start || "",
      Members: memberNames.join(", "),
      Labels: labelNames.join(", "),
      Location: locationDisplay || "",
      "Completed on": card.dueComplete && card.due ? card.due : "",
      "Last updated": card.dateLastActivity || "",
      URL: card.shortUrl || "",
    };
  }

  async getAutoMappings(
    job: ImportJob,
    payload?: Record<string, unknown>,
  ): Promise<ProviderResult> {
    let options: ReturnType<TrelloProvider["resolveOptions"]>;
    try {
      options = this.resolveOptions(job, payload);
    } catch (err) {
      // Even in error case, try to get custom fields if possible
      try {
        const tempOptions = this.resolveOptions(job, payload);
        const customFields = await getWithRetries<TrelloCustomField[]>({
          method: "GET",
          url: `https://api.trello.com/1/boards/${tempOptions.boardId}/customFields`,
          params: {
            key: tempOptions.key,
            token: tempOptions.token,
          },
        });
        return {
          hierarchy: this.buildHierarchy([]),
          fields: this.buildFieldMappings(customFields),
          raw: err,
        };
      } catch (innerErr) {
        return {
          hierarchy: this.buildHierarchy([]),
          fields: this.buildFieldMappings(),
          raw: err,
        };
      }
    }

    const lists = await getWithRetries<TrelloList[]>({
      method: "GET",
      url: `https://api.trello.com/1/boards/${options.boardId}/lists`,
      params: {
        key: options.key,
        token: options.token,
        fields: "name,closed",
        filter: "open",
      },
    });

    // Get custom fields for dynamic field mapping
    const customFields = await getWithRetries<TrelloCustomField[]>({
      method: "GET",
      url: `https://api.trello.com/1/boards/${options.boardId}/customFields`,
      params: {
        key: options.key,
        token: options.token,
      },
    });

    // Cache custom fields for use in ingest method
    this.customFieldsCache = customFields;

    const fieldMappings = this.buildFieldMappings(customFields);

    return {
      hierarchy: this.buildHierarchy(lists || []),
      fields: fieldMappings,
      raw: { boardId: options.boardId, boardName: options.boardName },
    };
  }

  async ingest(
    job: ImportJob,
    payload?: Record<string, unknown>,
  ): Promise<ProviderResult> {
    let options: ReturnType<TrelloProvider["resolveOptions"]>;
    try {
      options = this.resolveOptions(job, payload);
    } catch (err) {
      return { tasks: [], raw: { warning: (err as Error)?.message } };
    }

    const [lists, labels, members, customFields, cards] = await Promise.all([
      getWithRetries<TrelloList[]>({
        method: "GET",
        url: `https://api.trello.com/1/boards/${options.boardId}/lists`,
        params: {
          key: options.key,
          token: options.token,
          fields: "name,closed,pos",
          filter: "open",
        },
      }),
      getWithRetries<TrelloLabel[]>({
        method: "GET",
        url: `https://api.trello.com/1/boards/${options.boardId}/labels`,
        params: {
          key: options.key,
          token: options.token,
          fields: "name,color",
          limit: 1000,
        },
      }),
      getWithRetries<TrelloMember[]>({
        method: "GET",
        url: `https://api.trello.com/1/boards/${options.boardId}/members`,
        params: {
          key: options.key,
          token: options.token,
          fields: "fullName,username,memberType,confirmed,email",
        },
      }),
      getWithRetries<TrelloCustomField[]>({
        method: "GET",
        url: `https://api.trello.com/1/boards/${options.boardId}/customFields`,
        params: {
          key: options.key,
          token: options.token,
        },
      }),
      getWithRetries<TrelloCard[]>({
        method: "GET",
        url: `https://api.trello.com/1/boards/${options.boardId}/cards`,
        params: {
          key: options.key,
          token: options.token,
          customFieldItems: true,
          attachments: true,
          attachment_fields: "id,name,url,bytes,date,mimeType,isUpload",
          fields:
            "name,desc,due,start,dueComplete,idList,idMembers,idLabels,shortUrl,dateLastActivity,closed",
        },
      }),
    ]);


    const listNameMap = new Map<string, string>();
    (lists || []).forEach((list) => {
      if (list.id) listNameMap.set(list.id, list.name || list.id);
    });

    const labelNameMap = new Map<string, string>();
    (labels || []).forEach((label) => {
      if (label.id)
        labelNameMap.set(label.id, label.name || label.color || label.id);
    });

    const memberDirectory = new Map<string, TrelloMember>();
    (members || []).forEach((member) => {
      if (member.id) memberDirectory.set(member.id, member);
    });

    const customFieldNameById = new Map<string, string>();
    const locationFieldIds = new Set<string>();
    (customFields || []).forEach((field) => {
      if (!field.id) return;
      if (field.name) customFieldNameById.set(field.id, field.name);
      const nameLower = (field.name || "").toLowerCase();
      // Detect location fields by name or type
      if (
        field.type === "location" ||
        nameLower.includes("location") ||
        field.name === "Location"
      ) {
        locationFieldIds.add(field.id);
      }
    });

    // CRITICAL FIX: Update the custom fields cache for field mappings
    this.customFieldsCache = customFields || [];

    const tasks: StageTaskRow[] = [];
    const attachments: AttachmentPlanRow[] = [];
    const userMappings = new Map<string, UserMappingRow>();

    (cards || []).forEach((card) => {

      const listName = listNameMap.get(card.idList || "") || "";
      const memberNames = (card.idMembers || []).map((id) => {
        const member = memberDirectory.get(id);
        return member?.fullName || member?.username || id;
      });
      const memberEmails = (card.idMembers || [])
        .map((id) => memberDirectory.get(id)?.email || null)
        .filter((email): email is string => !!email);
      const labelNames = (card.idLabels || []).map(
        (id) => labelNameMap.get(id) || id,
      );
      const locationValues: string[] = [];
      const toLocationString = (
        loc?: TrelloCustomFieldItemValue | string | null,
      ): string | null => {
        if (!loc) return null;

        // Handle string values directly (fallback)
        if (typeof loc === "string" && loc.trim()) {
          return loc.trim();
        }

        // Handle object values (TrelloCustomFieldItemValue)
        if (typeof loc === "object") {
          // Check text property first (most common for location fields)
          if (loc.text && typeof loc.text === "string" && loc.text.trim()) {
            return loc.text.trim();
          }

          // Check address property
          if (
            loc.address &&
            typeof loc.address === "string" &&
            loc.address.trim()
          ) {
            return loc.address.trim();
          }

          // Check coordinates
          if (
            typeof loc.latitude === "number" &&
            typeof loc.longitude === "number"
          ) {
            const coords = `${loc.latitude}, ${loc.longitude}`;
            return coords;
          }

          // Other fallback properties
          if (loc.number && String(loc.number).trim()) {
            const numStr = String(loc.number).trim();
            return numStr;
          }
          if (loc.date && String(loc.date).trim()) {
            const dateStr = String(loc.date).trim();
            return dateStr;
          }
          if (loc.checked && String(loc.checked).trim()) {
            const checkedStr = String(loc.checked).trim();
            return checkedStr;
          }
        }

        return null;
      };

      if (Array.isArray(card.customFieldItems)) {
        for (const item of card.customFieldItems) {
          const fieldId = item.idCustomField;
          const fieldName = customFieldNameById.get(fieldId || "");
          if (!fieldId) {
            continue;
          }
          if (!locationFieldIds.has(fieldId)) {
            continue;
          }
          const value = toLocationString(
            item.value as TrelloCustomFieldItemValue | string,
          );
          if (value) {
            locationValues.push(value);
          }
        }
      }
      const locationDisplay = locationValues.join("; ");
      const raw: Record<string, unknown> = {
        ...this.buildRawCard(
          card,
          listName,
          memberNames,
          labelNames,
          locationDisplay,
        ),
        __labelIds: card.idLabels || [],
        __labels: labelNames,
        __memberIds: card.idMembers || [],
        __memberNames: memberNames,
        __memberEmails: memberEmails,
      };

      // Second loop: Add ALL custom field values to raw data
      if (Array.isArray(card.customFieldItems)) {
        for (const item of card.customFieldItems) {
          const fieldId = item.idCustomField;
          if (!fieldId) continue;

          const fieldName = customFieldNameById.get(fieldId);
          if (!fieldName) continue;

          // Handle location fields specially
          if (locationFieldIds.has(fieldId)) {
            const value = toLocationString(
              item.value as TrelloCustomFieldItemValue | string,
            );
            if (value) {
              (raw as Record<string, unknown>)[fieldName] = value;
            }
          } else {
            // Handle other custom fields
            let value = this.extractCustomFieldValue(item.value);
            if (value !== null && value !== undefined) {
              (raw as Record<string, unknown>)[fieldName] = value;
            }
          }
        }
      }

      const assigneeSource =
        memberEmails[0] || (card.idMembers?.[0] ?? null) || memberNames[0];

      tasks.push({
        source_task_id: card.id,
        title: card.name || "Untitled card",
        description: card.desc || null,
        due_at: card.due || null,
        start_at: card.start || null,
        status: listName || null,
        assignee_source_id: assigneeSource || null,
        attachments_planned: !!(card.attachments && card.attachments.length),
        raw,
      });

      (card.attachments || []).forEach((att) => {
        if (!att.url) return;
        attachments.push({
          source_url: att.url,
          filename: att.name || null,
          content_type: att.mimeType || null,
          size_bytes: att.bytes ?? null,
          status: "planned",
        });
      });

      (card.idMembers || []).forEach((id) => {
        if (userMappings.has(id)) return;
        const member = memberDirectory.get(id);
        userMappings.set(id, {
          source_user_id: id,
          source_email: member?.email || null,
          target_user_id: null,
          resolution: "unresolved",
          include: true,
        });
      });
    });

    return {
      tasks,
      hierarchy: this.buildHierarchy(lists || []),
      fields: this.buildFieldMappings(this.customFieldsCache),
      attachments,
      users: Array.from(userMappings.values()),
      raw: {
        boardId: options.boardId,
        boardName: options.boardName,
        cardCount: cards?.length || 0,
        listCount: lists?.length || 0,
      },
    };
  }
}
