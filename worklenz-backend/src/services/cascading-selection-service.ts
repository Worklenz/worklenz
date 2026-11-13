import db from "../config/db";

/**
 * Cascading (dependent) Selection custom fields.
 *
 * A Selection column may have one parent Selection column in the same project
 * (cc_column_configurations.parent_column_id). Each child option belongs to one parent
 * option (cc_selection_options.parent_selection_id). On a task, the child value must be an
 * option grouped under the task's current parent value.
 *
 * Task values for Selection columns are normally stored as the option name, but imports
 * store the selection_id, so both are matched.
 */

interface IQueryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
}

export interface ICascadeError {
  error_code: string;
  message: string;
}

export interface IClearedDependentValue {
  column_id: string;
  column_key: string;
  column_name: string;
  previous_value: string;
}

export interface IParentColumnValidationInput {
  projectId: string;
  columnId: string | null;
  parentColumnId: string | null | undefined;
  fieldType: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks that `parentColumnId` can be the parent of `columnId`: both Selection, same project,
 * not itself, and the chain stays at most 2 levels (parent → child), which also rules out cycles.
 */
export async function validateParentColumn(
  client: IQueryable,
  { projectId, columnId, parentColumnId, fieldType }: IParentColumnValidationInput
): Promise<ICascadeError | null> {
  if (!parentColumnId) return null;

  if (!UUID_PATTERN.test(parentColumnId)) {
    return { error_code: "CASCADE_PARENT_NOT_FOUND", message: "Parent field not found" };
  }

  if (fieldType !== "selection") {
    return {
      error_code: "CASCADE_REQUIRES_SELECTION",
      message: "Only Selection fields can depend on another field",
    };
  }

  if (columnId && parentColumnId === columnId) {
    return { error_code: "CASCADE_SELF_REFERENCE", message: "A field cannot depend on itself" };
  }

  const parentResult = await client.query(
    `SELECT cc.name, cc.field_type, cc.project_id, cf.parent_column_id
       FROM cc_custom_columns cc
       LEFT JOIN cc_column_configurations cf ON cf.column_id = cc.id
      WHERE cc.id = $1
      LIMIT 1`,
    [parentColumnId]
  );
  const parent = parentResult.rows[0];

  if (!parent || parent.project_id !== projectId) {
    return { error_code: "CASCADE_PARENT_NOT_FOUND", message: "Parent field not found" };
  }

  if (parent.field_type !== "selection") {
    return {
      error_code: "CASCADE_PARENT_NOT_SELECTION",
      message: `"${parent.name}" is not a Selection field`,
    };
  }

  if (parent.parent_column_id) {
    return {
      error_code: "CASCADE_MAX_DEPTH",
      message: `"${parent.name}" already depends on another field. Only one level of dependency is supported.`,
    };
  }

  if (columnId) {
    const childrenResult = await client.query(
      `SELECT 1 FROM cc_column_configurations WHERE parent_column_id = $1 LIMIT 1`,
      [columnId]
    );
    if (childrenResult.rowCount) {
      return {
        error_code: "CASCADE_MAX_DEPTH",
        message: "Other fields depend on this field, so it cannot depend on another field.",
      };
    }
  }

  return null;
}

/** Names of fields that depend on `columnId`. */
export async function getDependentColumnNames(client: IQueryable, columnId: string): Promise<string[]> {
  const result = await client.query(
    `SELECT cc.name
       FROM cc_column_configurations cf
       JOIN cc_custom_columns cc ON cc.id = cf.column_id
      WHERE cf.parent_column_id = $1
      ORDER BY cc.name`,
    [columnId]
  );
  return result.rows.map(row => row.name);
}

async function isValidPair(
  client: IQueryable,
  childColumnId: string,
  parentColumnId: string,
  childValue: string,
  parentValue: string
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1
       FROM cc_selection_options child
       JOIN cc_selection_options par
         ON par.column_id = $2
        AND par.selection_id = child.parent_selection_id
      WHERE child.column_id = $1
        AND (child.selection_name = $3 OR child.selection_id = $3)
        AND (par.selection_name = $4 OR par.selection_id = $4)
      LIMIT 1`,
    [childColumnId, parentColumnId, childValue, parentValue]
  );
  return !!result.rowCount;
}

async function getTaskTextValue(client: IQueryable, taskId: string, columnId: string): Promise<string | null> {
  const result = await client.query(
    `SELECT text_value FROM cc_column_values WHERE task_id = $1 AND column_id = $2 LIMIT 1`,
    [taskId, columnId]
  );
  const value = result.rows[0]?.text_value;
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Rejects a write to a dependent Selection field when the task has no parent value, or when
 * the value is not grouped under the task's current parent value. Empty values are always allowed.
 */
export async function validateDependentSelectionValue(
  taskId: string,
  columnId: string,
  value: unknown,
  client: IQueryable = db
): Promise<ICascadeError | null> {
  if (value === null || value === undefined || value === "") return null;

  const configResult = await client.query(
    `SELECT cc.name AS child_name, p.id AS parent_id, p.name AS parent_name
       FROM cc_custom_columns cc
       JOIN cc_column_configurations cf ON cf.column_id = cc.id
       JOIN cc_custom_columns p ON p.id = cf.parent_column_id
      WHERE cc.id = $1 AND cc.field_type = 'selection'
      LIMIT 1`,
    [columnId]
  );
  const config = configResult.rows[0];
  if (!config) return null;

  const childValue = String(value);
  const parentValue = await getTaskTextValue(client, taskId, config.parent_id);

  if (!parentValue) {
    return {
      error_code: "CASCADE_PARENT_VALUE_REQUIRED",
      message: `Cannot set "${config.child_name}" before "${config.parent_name}" has a value.`,
    };
  }

  if (!(await isValidPair(client, columnId, config.parent_id, childValue, parentValue))) {
    return {
      error_code: "CASCADE_INVALID_PAIR",
      message: `"${childValue}" is not a valid "${config.child_name}" option when "${config.parent_name}" is "${parentValue}".`,
    };
  }

  return null;
}

/**
 * After a parent field's value changes on a task, removes any dependent-field values on that
 * task that are no longer valid under the new parent value. Values still valid (an option name
 * shared by both groups) are kept.
 */
export async function clearInvalidDependentValues(
  taskId: string,
  parentColumnId: string,
  client: IQueryable = db
): Promise<IClearedDependentValue[]> {
  const childrenResult = await client.query(
    `SELECT cc.id, cc.key, cc.name, v.text_value
       FROM cc_column_configurations cf
       JOIN cc_custom_columns cc ON cc.id = cf.column_id
       JOIN cc_column_values v ON v.column_id = cc.id AND v.task_id = $1
      WHERE cf.parent_column_id = $2`,
    [taskId, parentColumnId]
  );
  if (!childrenResult.rowCount) return [];

  const parentValue = await getTaskTextValue(client, taskId, parentColumnId);
  const cleared: IClearedDependentValue[] = [];

  for (const child of childrenResult.rows) {
    const childValue = typeof child.text_value === "string" ? child.text_value : "";
    const isStillValid =
      !!parentValue &&
      !!childValue &&
      (await isValidPair(client, child.id, parentColumnId, childValue, parentValue));

    if (isStillValid) continue;

    await client.query(`DELETE FROM cc_column_values WHERE task_id = $1 AND column_id = $2`, [
      taskId,
      child.id,
    ]);
    cleared.push({
      column_id: child.id,
      column_key: child.key,
      column_name: child.name,
      previous_value: childValue,
    });
  }

  return cleared;
}
