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

  private buildFieldMappings(): FieldMappingRow[] {
    return [...DEFAULT_FIELDS];
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
      return {
        hierarchy: this.buildHierarchy([]),
        fields: this.buildFieldMappings(),
        raw: err,
      };
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

    return {
      hierarchy: this.buildHierarchy(lists || []),
      fields: this.buildFieldMappings(),
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

    console.log(
      `[TRELLO API DEBUG] Custom fields from board:`,
      customFields?.map((f) => ({ id: f.id, name: f.name, type: f.type })),
    );

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
    console.log(
      `[TRELLO API DEBUG] Processing ${(customFields || []).length} custom fields`,
    );
    (customFields || []).forEach((field) => {
      if (!field.id) return;
      if (field.name) customFieldNameById.set(field.id, field.name);
      const nameLower = (field.name || "").toLowerCase();
      console.log(
        `[TRELLO API DEBUG] Custom field: id="${field.id}", name="${field.name}", type="${field.type}"`,
      );
      // Detect location fields by name or type
      if (
        field.type === "location" ||
        nameLower.includes("location") ||
        field.name === "Location"
      ) {
        locationFieldIds.add(field.id);
        console.log(
          `[TRELLO API DEBUG] ✓ Marked field "${field.name}" (${field.id}) as location field (type: ${field.type})`,
        );
      }
    });
    console.log(
      `[TRELLO API DEBUG] Found ${locationFieldIds.size} location fields:`,
      Array.from(locationFieldIds),
    );

    const tasks: StageTaskRow[] = [];
    const attachments: AttachmentPlanRow[] = [];
    const userMappings = new Map<string, UserMappingRow>();

    (cards || []).forEach((card) => {
      console.log(`[CARD DEBUG] Processing card: "${card.name}"`);
      console.log(
        `[CARD DEBUG] Card custom field items:`,
        JSON.stringify(card.customFieldItems, null, 2),
      );
      console.log(
        `[CARD DEBUG] Number of custom field items: ${Array.isArray(card.customFieldItems) ? card.customFieldItems.length : "not array"}`,
      );
      console.log(
        `[CARD DEBUG] Location field IDs we're looking for:`,
        Array.from(locationFieldIds),
      );

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
        console.log(`[LOCATION VALUE DEBUG] Processing location value:`, loc);
        if (!loc) return null;

        // Handle string values directly (fallback)
        if (typeof loc === "string" && loc.trim()) {
          console.log(`[LOCATION VALUE DEBUG] Found direct string:`, loc);
          return loc.trim();
        }

        // Handle object values (TrelloCustomFieldItemValue)
        if (typeof loc === "object") {
          // Check text property first (most common for location fields)
          if (loc.text && typeof loc.text === "string" && loc.text.trim()) {
            console.log(`[LOCATION VALUE DEBUG] Found text:`, loc.text);
            return loc.text.trim();
          }

          // Check address property
          if (
            loc.address &&
            typeof loc.address === "string" &&
            loc.address.trim()
          ) {
            console.log(`[LOCATION VALUE DEBUG] Found address:`, loc.address);
            return loc.address.trim();
          }

          // Check coordinates
          if (
            typeof loc.latitude === "number" &&
            typeof loc.longitude === "number"
          ) {
            const coords = `${loc.latitude}, ${loc.longitude}`;
            console.log(`[LOCATION VALUE DEBUG] Found coordinates:`, coords);
            return coords;
          }

          // Other fallback properties
          if (loc.number && String(loc.number).trim()) {
            const numStr = String(loc.number).trim();
            console.log(`[LOCATION VALUE DEBUG] Found number:`, numStr);
            return numStr;
          }
          if (loc.date && String(loc.date).trim()) {
            const dateStr = String(loc.date).trim();
            console.log(`[LOCATION VALUE DEBUG] Found date:`, dateStr);
            return dateStr;
          }
          if (loc.checked && String(loc.checked).trim()) {
            const checkedStr = String(loc.checked).trim();
            console.log(`[LOCATION VALUE DEBUG] Found checked:`, checkedStr);
            return checkedStr;
          }
        }

        console.log(`[LOCATION VALUE DEBUG] No recognized value format found`);
        return null;
      };

      if (Array.isArray(card.customFieldItems)) {
        console.log(
          `[CARD DEBUG] Processing ${card.customFieldItems.length} custom field items for card "${card.name}"`,
        );
        for (const item of card.customFieldItems) {
          const fieldId = item.idCustomField;
          const fieldName = customFieldNameById.get(fieldId || "");
          console.log(`[CARD DEBUG] Custom field item:`, {
            idCustomField: fieldId,
            fieldName: fieldName,
            value: item.value,
            isLocationField: locationFieldIds.has(fieldId || ""),
            rawItem: JSON.stringify(item, null, 2),
          });
          if (!fieldId) {
            console.log(`[CARD DEBUG] ❌ Skipping item - no field ID`);
            continue;
          }
          if (!locationFieldIds.has(fieldId)) {
            console.log(
              `[CARD DEBUG] ❌ Skipping item - not a location field (field: ${fieldName})`,
            );
            continue;
          }
          console.log(
            `[CARD DEBUG] ✅ Processing location field "${fieldName}" (${fieldId})`,
          );
          const value = toLocationString(
            item.value as TrelloCustomFieldItemValue | string,
          );
          console.log(`[CARD DEBUG] Extracted location value:`, value);
          if (value) {
            console.log(`[CARD DEBUG] ✅ Adding location value: "${value}"`);
            locationValues.push(value);
          } else {
            console.log(`[CARD DEBUG] ❌ Location value is null/empty`);
          }
        }
      } else {
        console.log(
          `[CARD DEBUG] Card "${card.name}" has no custom field items or not an array`,
        );
      }
      console.log(
        `[CARD DEBUG] Final locationValues for "${card.name}":`,
        locationValues,
      );
      const locationDisplay = locationValues.join("; ");
      console.log(
        `[CARD DEBUG] locationDisplay for "${card.name}":`,
        locationDisplay,
      );
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
      console.log(
        `[CARD DEBUG] Raw data "Location" field for "${card.name}":`,
        raw.Location,
      );

      // Second loop: Add location values to raw data with field names as keys
      if (Array.isArray(card.customFieldItems)) {
        console.log(
          `[RAW DEBUG] Adding custom fields to raw data for "${card.name}"`,
        );
        for (const item of card.customFieldItems) {
          const fieldId = item.idCustomField;
          if (!fieldId || !locationFieldIds.has(fieldId)) continue;
          const fieldName = customFieldNameById.get(fieldId) || "Location";
          const value = toLocationString(
            item.value as TrelloCustomFieldItemValue | string,
          );
          console.log(`[RAW DEBUG] Setting raw["${fieldName}"] =`, value);
          if (fieldName && value) {
            (raw as Record<string, unknown>)[fieldName] = value;
          }
        }
      }
      console.log(`[RAW DEBUG] Final raw data for "${card.name}":`, {
        Location: raw.Location,
        allKeys: Object.keys(raw),
      });

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
      fields: this.buildFieldMappings(),
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
