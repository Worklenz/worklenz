import { ImportProvider, ProviderResult } from "./provider-types";
import { ImportJob, StageTaskRow, FieldMappingRow } from "../imports-service";
import axios from "axios";
import db from "../../config/db";

interface MondayOptions {
  token?: string;
  boardId?: number | string;
}

interface MondayColumnValue {
  id: string;
  text?: string;
  value?: any;
}

interface MondayColumn {
  id: string;
  title: string;
  type: string;
  settings_str?: string;
}

interface MondayItem {
  id: string;
  name: string;
  column_values?: MondayColumnValue[];
  created_at?: string;
  updated_at?: string;
}

interface MondayBoard {
  id: string;
  name: string;
  columns?: MondayColumn[];
  items?: MondayItem[];
  items_page?: {
    items: MondayItem[];
  };
}

interface MondayResponse {
  data?: {
    boards?: MondayBoard[];
    items?: MondayItem[];
  };
}

// Default field mappings for Monday.com built-in columns
const MONDAY_DEFAULT_FIELDS: FieldMappingRow[] = [
  {
    source_field: "Item name",
    target_field: "key",
    required: true,
    include: true,
  },
  {
    source_field: "name",
    target_field: "key",
    required: true,
    include: true,
  },
  // Map both Notes and long_text for descriptions
  {
    source_field: "Notes",
    target_field: "description",
    include: true,
  },
  {
    source_field: "Description", // Monday.com often uses Description as column title
    target_field: "description",
    include: true,
  },
  {
    source_field: "Status",
    target_field: "status",
    include: true,
  },
  {
    source_field: "Date",
    target_field: "dueDate",
    include: true,
  },
  {
    source_field: "Timeline",
    target_field: "startDate",
    include: true,
  },
  {
    source_field: "Timeline_start", // Extract start date from timeline
    target_field: "startDate",
    include: true,
  },
  {
    source_field: "Timeline_end", // Extract end date from timeline
    target_field: "dueDate",
    include: true,
  },
  // Map both Person and people fields
  {
    source_field: "Person",
    target_field: "assignees",
    include: true,
  },
  {
    source_field: "Assignee",
    target_field: "assignees",
    include: true,
  },
  {
    source_field: "Person_emails", // Map email fields for assignees
    target_field: "assignees",
    include: true,
  },
  {
    source_field: "Assignee_emails", // Map email fields for assignees
    target_field: "assignees",
    include: true,
  },
  {
    source_field: "Tags",
    target_field: "labels",
    include: true,
  },
  {
    source_field: "Priority",
    target_field: "priority",
    include: true,
  },
  {
    source_field: "Created Date",
    target_field: "createdDate",
    include: true,
  },
  {
    source_field: "Updated Date",
    target_field: "lastUpdated",
    include: true,
  },
];

// Monday.com column type to Worklenz field type mapping
const MONDAY_TYPE_MAPPING: Record<string, string> = {
  text: "text",
  long_text: "description",
  numbers: "number",
  rating: "rating",
  status: "status",
  dropdown: "select",
  people: "assignees",
  date: "date",
  timeline: "dateRange",
  checkbox: "checkbox",
  tags: "labels",
  location: "location",
  link: "url",
  email: "email",
  phone: "phone",
  world_clock: "timezone",
  creation_log: "createdDate",
  last_updated: "lastUpdated",
};

export default class MondayProvider implements ImportProvider {
  name = "monday";
  private columnsCache?: MondayColumn[];

  private mapMondayFieldType(column: MondayColumn): string {
    const baseMapping = MONDAY_TYPE_MAPPING[column.type] || column.type;

    // For custom fields, use sanitized column title as target
    if (
      !["name", "subitems", "mirror", "board_relation"].includes(column.type)
    ) {
      return column.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    }

    return baseMapping;
  }

  private async buildFieldMappings(
    columns?: MondayColumn[],
    job?: ImportJob,
  ): Promise<FieldMappingRow[]> {
    const mappings = [...MONDAY_DEFAULT_FIELDS];

    if (columns) {
      console.log(
        `[Monday Provider] Processing ${columns.length} columns for field mappings`,
      );

      columns.forEach((column) => {
        // Skip built-in system columns that are already mapped
        const skipColumns = [
          "name",
          "subitems",
          "mirror",
          "board_relation",
          "pulse_id",
        ];

        if (!skipColumns.includes(column.type) && column.title) {
          const targetField = this.mapMondayFieldType(column);
          const columnTitle = column.title.trim();

          console.log(
            `[Monday Provider] Adding column: "${columnTitle}" -> "${targetField}" (type: ${column.type})`,
          );

          // Create smart mapping based on column title and type
          let smartTargetField = targetField;
          const lowerTitle = columnTitle.toLowerCase();

          // Smart mapping based on common Monday.com column names
          if (lowerTitle.includes("status")) {
            smartTargetField = "status";
          } else if (
            lowerTitle.includes("person") ||
            lowerTitle.includes("assignee") ||
            lowerTitle.includes("owner")
          ) {
            smartTargetField = "assignees";
          } else if (
            lowerTitle.includes("due") &&
            lowerTitle.includes("date")
          ) {
            smartTargetField = "dueDate";
          } else if (
            lowerTitle.includes("start") &&
            lowerTitle.includes("date")
          ) {
            smartTargetField = "startDate";
          } else if (lowerTitle.includes("priority")) {
            smartTargetField = "priority";
          } else if (
            lowerTitle.includes("notes") ||
            lowerTitle.includes("description")
          ) {
            smartTargetField = "description";
          } else if (
            lowerTitle.includes("tag") ||
            lowerTitle.includes("label")
          ) {
            smartTargetField = "labels";
          } else if (lowerTitle.includes("timeline")) {
            smartTargetField = "startDate"; // Timeline often contains start dates
          } else if (lowerTitle.includes("date") && column.type === "date") {
            smartTargetField = "dueDate"; // Default date columns to due date
          }

          mappings.push({
            source_field: columnTitle,
            target_field: smartTargetField,
            include: true,
          });

          // Add additional mappings for special Monday.com field structures
          if (smartTargetField === "assignees") {
            // Map the email variants for assignee fields
            mappings.push({
              source_field: `${columnTitle}_emails`,
              target_field: "assignees",
              include: true,
            });
            mappings.push({
              source_field: `${columnTitle}_names`,
              target_field: "assignees",
              include: true,
            });
          } else if (
            smartTargetField === "startDate" &&
            column.type === "timeline"
          ) {
            // Map timeline start/end dates
            mappings.push({
              source_field: `${columnTitle}_start`,
              target_field: "startDate",
              include: true,
            });
            mappings.push({
              source_field: `${columnTitle}_end`,
              target_field: "dueDate",
              include: true,
            });
          } else if (smartTargetField === "labels" && column.type === "tags") {
            // Map tags field variants
            mappings.push({
              source_field: `${columnTitle}_tag_ids`,
              target_field: "labels",
              include: true,
            });
          } else if (
            smartTargetField === "labels" &&
            column.type === "status"
          ) {
            // Map status-based label columns (e.g., Label, Category columns)
            mappings.push({
              source_field: `${columnTitle}_raw`,
              target_field: "labels",
              include: true,
            });
            // Also map the column ID based fields
            mappings.push({
              source_field: `${column.id}_raw`,
              target_field: "labels",
              include: true,
            });
          } else if (
            smartTargetField === "status" &&
            column.type === "status"
          ) {
            // Map status label variants
            mappings.push({
              source_field: `${columnTitle}_label`,
              target_field: "status",
              include: true,
            });
          }

          // Also add mapping for column ID as fallback
          mappings.push({
            source_field: column.id,
            target_field: smartTargetField,
            include: true,
          });
        } else {
          console.log(
            `[Monday Provider] Skipping system column: "${column.title}" (type: ${column.type})`,
          );
        }
      });
    }

    console.log(`[Monday Provider] Total field mappings:`, mappings.length);
    mappings.forEach((mapping) => {
      console.log(
        `[Monday Provider] Mapping: "${mapping.source_field}" -> "${mapping.target_field}"`,
      );
    });

    // Create custom columns for Monday.com custom fields
    if (columns && job && job.target_project_id) {
      console.log(
        `[Monday Provider] Creating custom columns for Monday.com custom fields...`,
      );
      await this.createCustomColumnsForMondayFields(
        columns,
        job.target_project_id,
      );

      // Add field mappings for the custom columns to populate data
      await this.addCustomColumnFieldMappings(columns, mappings);
    }

    return mappings;
  }

  // Add field mappings for custom columns to populate data
  private async addCustomColumnFieldMappings(
    columns: MondayColumn[],
    mappings: FieldMappingRow[],
  ): Promise<void> {
    const customFieldTypes = [
      "numbers",
      "numeric",
      "dropdown",
      "text",
      "timeline",
      "checkbox",
    ];
    const systemFields = ["name", "people", "status", "date"];

    for (const column of columns) {
      // Skip system columns and already handled columns
      if (systemFields.includes(column.type)) {
        continue;
      }

      // Only create mappings for supported custom field types
      if (customFieldTypes.includes(column.type)) {
        const columnKey = `monday_${column.id}_${column.type}`;

        // Add mapping for the main field (display value)
        mappings.push({
          source_field: column.title,
          target_field: columnKey,
          include: true,
        });

        // Add mapping for the column ID field (alternative field name)
        mappings.push({
          source_field: column.id,
          target_field: columnKey,
          include: true,
        });

        console.log(
          `[Monday Provider] Added field mapping for custom column: "${column.title}" -> ${columnKey}`,
        );
      }
    }
  }

  // Create custom columns for Monday.com custom fields
  private async createCustomColumnsForMondayFields(
    columns: MondayColumn[],
    projectId: string,
  ): Promise<void> {
    const customFieldTypes = [
      "numbers",
      "numeric",
      "dropdown",
      "text",
      "timeline",
      "checkbox",
    ];
    const systemFields = ["name", "people", "status", "date"];

    for (const column of columns) {
      try {
        // Skip system columns and already handled columns
        if (systemFields.includes(column.type)) {
          continue;
        }

        // Only create custom columns for supported custom field types
        if (customFieldTypes.includes(column.type)) {
          console.log(
            `[Monday Provider] Processing custom field: "${column.title}" (type: ${column.type})`,
          );
          await this.createCustomColumnFromMondayField(projectId, column);
        } else {
          console.log(
            `[Monday Provider] Skipping unsupported custom field type: "${column.title}" (type: ${column.type})`,
          );
        }
      } catch (error) {
        console.error(
          `[Monday Provider] Failed to create custom column for "${column.title}":`,
          error,
        );
      }
    }
  }

  // Create a single custom column from Monday.com field
  private async createCustomColumnFromMondayField(
    projectId: string,
    column: MondayColumn,
  ): Promise<string | null> {
    try {
      // Map Monday.com column types to Worklenz custom field types
      const typeMapping: Record<
        string,
        { fieldType: string; numberType?: string }
      > = {
        numbers: { fieldType: "number", numberType: "formatted" },
        numeric: { fieldType: "number", numberType: "formatted" },
        dropdown: { fieldType: "selection" },
        text: { fieldType: "people" }, // Use people type for text fields as it supports text
        timeline: { fieldType: "date" },
        date: { fieldType: "date" },
        checkbox: { fieldType: "checkbox" },
      };

      const mapping = typeMapping[column.type];
      if (!mapping) {
        console.log(
          `[Monday Custom Column] Skipping unsupported column type: ${column.type}`,
        );
        return null;
      }

      const columnKey = `monday_${column.id}_${column.type}`;
      const columnName = column.title || `Monday ${column.type}`;

      console.log(
        `[Monday Custom Column] Creating custom column: ${columnName} (${column.type} -> ${mapping.fieldType})`,
      );

      const client = await db.pool.connect();
      try {
        await client.query("BEGIN");

        // Check if column already exists
        const existingCheck = await client.query(
          "SELECT id FROM cc_custom_columns WHERE project_id = $1 AND key = $2",
          [projectId, columnKey],
        );

        if (existingCheck.rows.length > 0) {
          console.log(
            `[Monday Custom Column] Column already exists: ${columnName}`,
          );
          await client.query("ROLLBACK");
          return columnKey;
        }

        // 1. Insert the main custom column
        const columnQuery = `
          INSERT INTO cc_custom_columns (
            project_id, name, key, field_type, width, is_visible, is_custom_column
          ) VALUES ($1, $2, $3, $4, $5, $6, true)
          RETURNING id;
        `;
        const columnResult = await client.query(columnQuery, [
          projectId,
          columnName,
          columnKey,
          mapping.fieldType,
          150, // Default width
          true, // Visible by default
        ]);
        const columnId = columnResult.rows[0].id;

        // 2. Insert the column configuration
        const configQuery = `
          INSERT INTO cc_column_configurations (
            column_id, field_title, field_type, number_type, 
            decimals, label, label_position, preview_value
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id;
        `;
        await client.query(configQuery, [
          columnId,
          columnName,
          mapping.fieldType,
          mapping.numberType || null,
          mapping.fieldType === "number" ? 2 : null, // Default 2 decimals for numbers
          mapping.fieldType === "number" ? "" : null, // No label for now
          mapping.fieldType === "number" ? "left" : null,
          mapping.fieldType === "number" ? 0 : null,
        ]);

        // 3. For dropdown fields, create selection options
        if (mapping.fieldType === "selection" && column.settings_str) {
          try {
            const settings = JSON.parse(column.settings_str);
            if (settings.labels && Array.isArray(settings.labels)) {
              const selectionQuery = `
                INSERT INTO cc_selection_options (
                  column_id, selection_id, selection_name, selection_color, selection_order
                ) VALUES ($1, $2, $3, $4, $5);
              `;
              for (const [index, label] of settings.labels.entries()) {
                const labelId = typeof label === "object" ? label.id : index;
                const labelName =
                  typeof label === "object" ? label.name : String(label);
                const labelColor =
                  typeof label === "object" ? label.color : "#3498db";

                await client.query(selectionQuery, [
                  columnId,
                  String(labelId),
                  labelName,
                  labelColor,
                  index,
                ]);
              }
            }
          } catch (parseError) {
            console.log(
              `[Monday Custom Column] Failed to parse settings for dropdown:`,
              parseError,
            );
          }
        }

        await client.query("COMMIT");
        console.log(
          `[Monday Custom Column] Created custom column with ID: ${columnId}`,
        );
        return columnKey;
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(`[Monday Custom Column] Failed to create column:`, error);
        return null;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(
        `[Monday Custom Column] Error creating custom column:`,
        error,
      );
      return null;
    }
  }

  async getAutoMappings(
    job: ImportJob,
    payload?: Record<string, unknown>,
  ): Promise<ProviderResult> {
    const opts = ((payload?.sourceReference as MondayOptions) ||
      (job.source_reference as any) ||
      {}) as MondayOptions;

    console.log("[Monday Provider] Getting auto mappings with options:", opts);

    if (!opts.token || !opts.boardId) {
      console.log(
        "[Monday Provider] Missing token or boardId for auto mappings",
      );
      return {
        fields: await this.buildFieldMappings(),
        raw: { warning: "Missing Monday token/boardId for auto mappings" },
      };
    }

    try {
      // Fetch board structure including columns
      const query = `query ($boardId: [ID!]) {
        boards(ids: $boardId) {
          id
          name
          columns {
            id
            title
            type
            settings_str
          }
        }
      }`;
      const variables = { boardId: [String(opts.boardId)] };

      console.log("[Monday Provider] Fetching board structure:", {
        query,
        variables,
      });

      const { data } = await axios.post<MondayResponse>(
        "https://api.monday.com/v2",
        { query, variables },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: opts.token,
          },
        },
      );

      console.log(
        "[Monday Provider] Board structure response:",
        JSON.stringify(data, null, 2),
      );

      const columns = data?.data?.boards?.[0]?.columns || [];
      this.columnsCache = columns;

      const fieldMappings = await this.buildFieldMappings(columns, job);

      return {
        fields: fieldMappings,
        raw: {
          boardId: opts.boardId,
          boardName: data?.data?.boards?.[0]?.name,
          columnsCount: columns.length,
        },
      };
    } catch (error: any) {
      console.error("[Monday Provider] Error getting auto mappings:", error);
      return {
        fields: await this.buildFieldMappings(),
        raw: { error: error?.message || "Unknown error in auto mappings" },
      };
    }
  }

  async ingest(
    job: ImportJob,
    payload?: Record<string, unknown>,
  ): Promise<ProviderResult> {
    const opts = ((payload?.sourceReference as MondayOptions) ||
      (job.source_reference as any) ||
      {}) as MondayOptions;

    console.log("[Monday Provider] Options received:", opts);

    if (!opts.token || !opts.boardId) {
      console.log("[Monday Provider] Missing token or boardId:", {
        hasToken: !!opts.token,
        boardId: opts.boardId,
      });
      return { tasks: [], raw: { warning: "Missing Monday token/boardId" } };
    }

    // Enhanced query that includes column information
    const query = `query ($boardId: [ID!]) { 
      boards(ids: $boardId) { 
        columns {
          id
          title
          type
          settings_str
        }
        items_page (limit: 200) { 
          items { 
            id 
            name 
            column_values { 
              id 
              text 
              value 
            }
          }
        }
      } 
    }`;
    const variables = { boardId: [String(opts.boardId)] };

    console.log("[Monday Provider] Executing query:", { query, variables });

    try {
      const { data } = await axios.post<MondayResponse>(
        "https://api.monday.com/v2",
        { query, variables },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: opts.token,
          },
        },
      );

      console.log(
        "[Monday Provider] Raw API response:",
        JSON.stringify(data, null, 2),
      );

      const items =
        data?.data?.boards?.[0]?.items_page?.items ||
        data?.data?.boards?.[0]?.items ||
        [];

      // Get columns from the current response
      const columns =
        data?.data?.boards?.[0]?.columns || this.columnsCache || [];

      console.log("[Monday Provider] Extracted items:", items);
      console.log("[Monday Provider] Available columns:", columns.length);
      console.log(
        "[Monday Provider] Column details:",
        columns.map((c) => ({ id: c.id, title: c.title, type: c.type })),
      );

      const tasks: StageTaskRow[] = items.map((item: MondayItem) => {
        const rawItem = this.buildRawItem(item, columns);

        console.log(`[Monday Provider] Processing item: ${item.name}`);
        console.log(`[Monday Provider] Raw item keys:`, Object.keys(rawItem));

        // Helper function to find column value by type or title
        const findColumnValue = (types: string[], titles: string[]) => {
          // First try to find by column type
          for (const type of types) {
            const column = columns.find((c) => c.type === type);
            if (column) {
              const value = item.column_values?.find((c) => c.id === column.id);
              if (value?.text) return value.text;
            }
          }

          // Then try to find by column title
          for (const title of titles) {
            const value = rawItem[title];
            if (value && typeof value === "string" && value.trim()) {
              return value.trim();
            }
          }

          return null;
        };

        // Extract values using smart lookup
        const description = findColumnValue(
          ["long_text", "text"],
          ["Notes", "Description", "Long Text"],
        );

        const status = findColumnValue(
          ["status", "dropdown"],
          ["Status", "State", "Phase"],
        );

        // Helper function to extract timeline date ranges
        const extractTimelineData = () => {
          const timelineColumn = columns.find((c) => c.type === "timeline");
          if (timelineColumn) {
            const columnValue = item.column_values?.find(
              (c) => c.id === timelineColumn.id,
            );
            if (columnValue?.value) {
              try {
                const data = JSON.parse(columnValue.value);
                console.log(
                  `[Monday Provider] Timeline data for ${timelineColumn.title}:`,
                  data,
                );
                return {
                  start: data.from || null,
                  end: data.to || null,
                  text: columnValue.text || null,
                };
              } catch (e) {
                console.log(
                  `[Monday Provider] Could not parse timeline JSON:`,
                  e,
                );
              }
            }
            if (columnValue?.text) {
              return {
                start: columnValue.text,
                end: null,
                text: columnValue.text,
              };
            }
          }
          return { start: null, end: null, text: null };
        };

        const timelineData = extractTimelineData();

        const dueDate =
          timelineData.end ||
          findColumnValue(
            ["date"],
            ["Due Date", "Date", "End Date", "Deadline"],
          );

        const startDate =
          timelineData.start ||
          findColumnValue(["date"], ["Start Date", "Begin Date"]);

        const priority = findColumnValue(
          ["priority", "status"],
          ["Priority", "Importance", "Urgency"],
        );

        // Helper function to extract emails from Monday.com people fields
        const extractEmailsFromPeopleField = (
          types: string[],
          titles: string[],
        ) => {
          // First try to find by column type and extract emails from JSON
          for (const type of types) {
            const column = columns.find((c) => c.type === type);
            if (column) {
              const columnValue = item.column_values?.find(
                (c) => c.id === column.id,
              );
              if (columnValue?.value) {
                try {
                  const data = JSON.parse(columnValue.value);
                  if (
                    data.personsAndTeams &&
                    Array.isArray(data.personsAndTeams)
                  ) {
                    const emails = data.personsAndTeams
                      .filter((person: any) => person.email)
                      .map((person: any) => person.email);
                    if (emails.length > 0) {
                      console.log(
                        `[Monday Provider] Extracted emails from ${column.title}:`,
                        emails,
                      );
                      return emails.join(", "); // Return comma-separated emails
                    }
                  }
                } catch (e) {
                  console.log(
                    `[Monday Provider] Could not parse people JSON for ${column.title}:`,
                    e,
                  );
                }
              }
              // Fallback to text value if JSON parsing fails
              if (columnValue?.text) {
                console.log(
                  `[Monday Provider] Using display text for ${column.title}:`,
                  columnValue.text,
                );
                return columnValue.text;
              }
            }
          }

          // Fallback to title-based lookup
          for (const title of titles) {
            const value = rawItem[title];
            if (value && typeof value === "string" && value.trim()) {
              return value.trim();
            }
          }

          return null;
        };

        const assignee = extractEmailsFromPeopleField(
          ["people", "person"],
          ["Person", "Assignee", "Owner", "Team Member"],
        );

        console.log(`[Monday Provider] Extracted fields:`, {
          title: item.name,
          description,
          status,
          dueDate,
          startDate,
          priority,
          assignee,
          timelineRange: timelineData.text,
          rawItemKeys: Object.keys(rawItem).length,
        });

        // Enhanced logging for debugging field mappings
        console.log(
          `[Monday Provider] Available column types:`,
          columns.map((c) => `${c.title}(${c.type})`),
        );

        // Extract additional metadata for enhanced raw item
        const enhancedRawData = { ...rawItem };

        // Add extracted email information
        if (assignee && assignee.includes("@")) {
          enhancedRawData["extracted_emails"] = assignee;
        }

        // Add timeline range information
        if (timelineData.start || timelineData.end) {
          enhancedRawData["timeline_range"] = {
            start: timelineData.start,
            end: timelineData.end,
            display: timelineData.text,
          };
        }

        return {
          source_task_id: item.id,
          title: item.name || "Untitled item",
          description: description || null,
          status: status || null,
          due_at: dueDate || null,
          start_at: startDate || null,
          worktype: priority || null,
          assignee_source_id: assignee || null,
          raw: enhancedRawData, // Enhanced raw data with extracted metadata
        };
      });

      console.log("[Monday Provider] Mapped tasks:", tasks);

      return { tasks };
    } catch (error: any) {
      console.error("[Monday Provider] Error fetching data:", error);
      return { tasks: [], raw: { error: error?.message || "Unknown error" } };
    }
  }

  private buildRawItem(
    item: MondayItem,
    columns?: MondayColumn[],
  ): Record<string, unknown> {
    console.log(`[Monday Provider] Building raw item for: ${item.name}`);

    const rawItem: Record<string, unknown> = {
      "Item name": item.name || "",
      name: item.name || "", // Add duplicate for easier matching
    };

    // Add standard Monday.com system fields
    if (item.id) {
      rawItem["id"] = item.id;
      rawItem["Item ID"] = item.id;
    }

    if (item.created_at) {
      rawItem["Created Date"] = item.created_at;
      rawItem["created_at"] = item.created_at;
    }

    if (item.updated_at) {
      rawItem["Updated Date"] = item.updated_at;
      rawItem["updated_at"] = item.updated_at;
    }

    // Process all column values
    if (item.column_values && columns) {
      console.log(
        `[Monday Provider] Processing ${item.column_values.length} column values`,
      );

      columns.forEach((column) => {
        const columnValue = item.column_values?.find(
          (cv) => cv.id === column.id,
        );

        if (columnValue) {
          const displayValue = columnValue.text || columnValue.value || "";

          // Use human-readable column title as the primary key
          rawItem[column.title] = displayValue;

          // Also store with column ID for exact matching
          rawItem[column.id] = displayValue;

          // Enhanced processing for specific column types
          if (columnValue.value) {
            try {
              const parsedValue = JSON.parse(columnValue.value);

              // Store raw value
              rawItem[`${column.title}_raw`] = parsedValue;
              rawItem[`${column.id}_raw`] = parsedValue;

              // Enhanced processing based on column type
              switch (column.type) {
                case "people":
                case "person":
                  if (
                    parsedValue.personsAndTeams &&
                    Array.isArray(parsedValue.personsAndTeams)
                  ) {
                    const emails = parsedValue.personsAndTeams
                      .filter((person: any) => person.email)
                      .map((person: any) => person.email);
                    const names = parsedValue.personsAndTeams
                      .map((person: any) => person.name)
                      .filter(Boolean);

                    if (emails.length > 0) {
                      rawItem[`${column.title}_emails`] = emails.join(", ");
                      rawItem[`${column.id}_emails`] = emails.join(", ");
                    }
                    if (names.length > 0) {
                      rawItem[`${column.title}_names`] = names.join(", ");
                      rawItem[`${column.id}_names`] = names.join(", ");
                    }

                    console.log(
                      `[Monday Provider] People field "${column.title}" - Emails: ${emails.join(", ")}, Names: ${names.join(", ")}`,
                    );
                  }
                  break;

                case "timeline":
                  if (parsedValue.from || parsedValue.to) {
                    rawItem[`${column.title}_start`] = parsedValue.from || "";
                    rawItem[`${column.title}_end`] = parsedValue.to || "";
                    rawItem[`${column.id}_start`] = parsedValue.from || "";
                    rawItem[`${column.id}_end`] = parsedValue.to || "";

                    console.log(
                      `[Monday Provider] Timeline field "${column.title}" - Start: ${parsedValue.from}, End: ${parsedValue.to}`,
                    );
                  }
                  break;

                case "location":
                  if (parsedValue.lat && parsedValue.lng) {
                    rawItem[`${column.title}_coordinates`] =
                      `${parsedValue.lat},${parsedValue.lng}`;
                    rawItem[`${column.id}_coordinates`] =
                      `${parsedValue.lat},${parsedValue.lng}`;

                    console.log(
                      `[Monday Provider] Location field "${column.title}" - Coordinates: ${parsedValue.lat},${parsedValue.lng}`,
                    );
                  }
                  if (parsedValue.address) {
                    rawItem[`${column.title}_address`] = parsedValue.address;
                    rawItem[`${column.id}_address`] = parsedValue.address;
                  }
                  break;

                case "status":
                  if (parsedValue.label) {
                    rawItem[`${column.title}_label`] = parsedValue.label;
                    rawItem[`${column.id}_label`] = parsedValue.label;
                  }
                  if (parsedValue.color) {
                    rawItem[`${column.title}_color`] = parsedValue.color;
                    rawItem[`${column.id}_color`] = parsedValue.color;
                  }
                  break;

                case "tags":
                  if (
                    parsedValue.tag_ids &&
                    Array.isArray(parsedValue.tag_ids)
                  ) {
                    rawItem[`${column.title}_tag_ids`] =
                      parsedValue.tag_ids.join(", ");
                    rawItem[`${column.id}_tag_ids`] =
                      parsedValue.tag_ids.join(", ");
                  }
                  break;
              }
            } catch (e) {
              rawItem[`${column.title}_raw`] = columnValue.value;
              rawItem[`${column.id}_raw`] = columnValue.value;
            }
          }

          console.log(
            `[Monday Provider] Mapped column "${column.title}" (${column.type}): ${displayValue}`,
          );
        }
      });
    }

    console.log("[Monday Provider] Final raw item keys:", Object.keys(rawItem));
    console.log("[Monday Provider] Final raw item:", rawItem);

    return rawItem;
  }
}
