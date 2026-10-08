import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { checkTeamSubscriptionStatus } from "../ee/shared/paddle-utils";
import { LICENSING_SETTINGS } from "../shared/licensing_settings";
import { canUseFeature, isEnforceMode } from "../shared/entitlements/gates";

const CUSTOM_FIELD_LIMIT = LICENSING_SETTINGS.CUSTOM_FIELDS_LIMIT;

/**
 * Determines whether the user has business-level access based on subscription data.
 * Mirrors the frontend hasBusinessFeatureAccess() logic.
 */
function hasBusinessAccess(subscriptionData: any): boolean {
  if (!subscriptionData) return false;

  const isTruthy = (v: unknown) =>
    v === true || v === 1 || v === "true" || v === "t";

  if (isTruthy(subscriptionData.business_plan_override)) return true;

  const subType: string = (subscriptionData.subscription_type || "").toUpperCase();

  if (subType === "BUSINESS_TRIAL" || subType === "ENTERPRISE_TRIAL") return true;
  if (subType === "ANNUAL_BUSINESS" || subType === "SELF_HOSTED") return true;

  if (subType === "PADDLE") {
    const planName = (subscriptionData.plan_name || "").toLowerCase();
    return planName.includes("business") || planName.includes("enterprise");
  }

  return false;
}

/**
 * Returns the current number of custom columns for a project.
 */
async function getCustomColumnCount(projectId: string): Promise<number> {
  const result = await db.query(
    `SELECT COUNT(*)::INT AS count FROM cc_custom_columns WHERE project_id = $1`,
    [projectId]
  );
  return result.rows[0]?.count ?? 0;
}

export default class CustomcolumnsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async create(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const {
      project_id,
      name,
      key,
      field_type,
      width = 150,
      is_visible = true,
      configuration,
    } = req.body;

    // --- Subscription limit check ---
    const teamId = req.user?.team_id;
    if (teamId) {
      const subscriptionData = await checkTeamSubscriptionStatus(teamId);
      if (subscriptionData && isEnforceMode()) {
        // Matrix: custom fields are Pro and above (unlimited).
        if (!canUseFeature(subscriptionData, "custom_fields")) {
          return res.status(200).send(
            new ServerResponse(
              false,
              { error_code: "CUSTOM_FIELD_LIMIT_EXCEEDED" },
              "Custom fields require a Pro plan or above. Upgrade to add custom fields."
            )
          );
        }
      } else if (subscriptionData && !hasBusinessAccess(subscriptionData)) {
        // Legacy: per-project cap for non-Business plans.
        const currentCount = await getCustomColumnCount(project_id);
        if (currentCount >= CUSTOM_FIELD_LIMIT) {
          return res.status(200).send(
            new ServerResponse(
              false,
              { error_code: "CUSTOM_FIELD_LIMIT_EXCEEDED" },
              `You have reached the limit of ${CUSTOM_FIELD_LIMIT} custom fields. Upgrade to Business to add unlimited custom fields.`
            )
          );
        }
      }
    }
    // --- End limit check ---

    // Start a transaction since we're inserting into multiple tables
    const client = await db.pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Insert the main custom column
      const columnQuery = `
        INSERT INTO cc_custom_columns (
          project_id, name, key, field_type, width, is_visible, is_custom_column
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id;
      `;
      const columnResult = await client.query(columnQuery, [
        project_id,
        name,
        key,
        field_type,
        width,
        is_visible,
      ]);
      const columnId = columnResult.rows[0].id;

      // 2. Insert the column configuration
      const configQuery = `
        INSERT INTO cc_column_configurations (
          column_id, field_title, field_type, number_type, 
          decimals, label, label_position, preview_value,
          expression, first_numeric_column_key, second_numeric_column_key
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id;
      `;
      await client.query(configQuery, [
        columnId,
        configuration.field_title,
        configuration.field_type,
        configuration.number_type || null,
        configuration.decimals || null,
        configuration.label || null,
        configuration.label_position || null,
        configuration.preview_value || null,
        configuration.expression || null,
        configuration.first_numeric_column_key || null,
        configuration.second_numeric_column_key || null,
      ]);

      // 3. Insert selection options if present
      if (
        configuration.selections_list &&
        configuration.selections_list.length > 0
      ) {
        const selectionQuery = `
          INSERT INTO cc_selection_options (
            column_id, selection_id, selection_name, selection_color, selection_order
          ) VALUES ($1, $2, $3, $4, $5);
        `;
        for (const [
          index,
          selection,
        ] of configuration.selections_list.entries()) {
          await client.query(selectionQuery, [
            columnId,
            selection.selection_id,
            selection.selection_name,
            selection.selection_color,
            index,
          ]);
        }
      }

      // 4. Insert label options if present
      if (configuration.labels_list && configuration.labels_list.length > 0) {
        const labelQuery = `
          INSERT INTO cc_label_options (
            column_id, label_id, label_name, label_color, label_order
          ) VALUES ($1, $2, $3, $4, $5);
        `;
        for (const [index, label] of configuration.labels_list.entries()) {
          await client.query(labelQuery, [
            columnId,
            label.label_id,
            label.label_name,
            label.label_color,
            index,
          ]);
        }
      }

      await client.query("COMMIT");

      // Fetch the complete column data
      const getColumnQuery = `
        SELECT 
          cc.*,
          cf.field_title,
          cf.number_type,
          cf.decimals,
          cf.label,
          cf.label_position,
          cf.preview_value,
          cf.expression,
          cf.first_numeric_column_key,
          cf.second_numeric_column_key,
          (
            SELECT json_agg(
              json_build_object(
                'selection_id', so.selection_id,
                'selection_name', so.selection_name,
                'selection_color', so.selection_color
              )
            )
            FROM cc_selection_options so
            WHERE so.column_id = cc.id
          ) as selections_list,
          (
            SELECT json_agg(
              json_build_object(
                'label_id', lo.label_id,
                'label_name', lo.label_name,
                'label_color', lo.label_color
              )
            )
            FROM cc_label_options lo
            WHERE lo.column_id = cc.id
          ) as labels_list
        FROM cc_custom_columns cc
        LEFT JOIN cc_column_configurations cf ON cf.column_id = cc.id
        WHERE cc.id = $1;
      `;
      const result = await client.query(getColumnQuery, [columnId]);
      const [data] = result.rows;

      return res.status(200).send(new ServerResponse(true, data));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  @HandleExceptions()
  public static async get(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { project_id } = req.query;

    const q = `
      SELECT 
        cc.*,
        cf.field_title,
        cf.number_type,
        cf.decimals,
        cf.label,
        cf.label_position,
        cf.preview_value,
        cf.expression,
        cf.first_numeric_column_key,
        cf.second_numeric_column_key,
        (
          SELECT json_agg(
            json_build_object(
              'selection_id', so.selection_id,
              'selection_name', so.selection_name,
              'selection_color', so.selection_color
            )
          )
          FROM cc_selection_options so
          WHERE so.column_id = cc.id
        ) as selections_list,
        (
          SELECT json_agg(
            json_build_object(
              'label_id', lo.label_id,
              'label_name', lo.label_name,
              'label_color', lo.label_color
            )
          )
          FROM cc_label_options lo
          WHERE lo.column_id = cc.id
        ) as labels_list
      FROM cc_custom_columns cc
      LEFT JOIN cc_column_configurations cf ON cf.column_id = cc.id
      WHERE cc.project_id = $1
      ORDER BY cc.created_at DESC;
    `;
    const result = await db.query(q, [project_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;

    const q = `
      SELECT 
        cc.*,
        cf.field_title,
        cf.number_type,
        cf.decimals,
        cf.label,
        cf.label_position,
        cf.preview_value,
        cf.expression,
        cf.first_numeric_column_key,
        cf.second_numeric_column_key,
        (
          SELECT json_agg(
            json_build_object(
              'selection_id', so.selection_id,
              'selection_name', so.selection_name,
              'selection_color', so.selection_color
            )
          )
          FROM cc_selection_options so
          WHERE so.column_id = cc.id
        ) as selections_list,
        (
          SELECT json_agg(
            json_build_object(
              'label_id', lo.label_id,
              'label_name', lo.label_name,
              'label_color', lo.label_color
            )
          )
          FROM cc_label_options lo
          WHERE lo.column_id = cc.id
        ) as labels_list
      FROM cc_custom_columns cc
      LEFT JOIN cc_column_configurations cf ON cf.column_id = cc.id
      WHERE cc.id = $1;
    `;
    const result = await db.query(q, [id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async update(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { name, field_type, width, is_visible, configuration, lock_field_type } = req.body;
    const parsedWidth = Number.parseInt(String(width), 10);
    const columnWidth = Number.isFinite(parsedWidth) ? parsedWidth : 120;

    // Try to resolve the column ID - it might be a UUID or a key (nanoid)
    let columnId = id;
    try {
      // If it's not a valid UUID, try to find the column by key
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // Not a UUID, try to find by key
        const keyResult = await db.query(
          `SELECT id FROM cc_custom_columns WHERE key = $1 LIMIT 1`,
          [id]
        );
        if (keyResult.rows.length > 0) {
          columnId = keyResult.rows[0].id;
        } else {
          return res.status(400).send(
            new ServerResponse(false, { error_code: "CUSTOM_COLUMN_NOT_FOUND" }, "Custom column not found")
          );
        }
      }
    } catch (error) {
      // If UUID parsing fails, just use the id as-is and let the middleware handle it
      columnId = id;
    }

    const client = await db.pool.connect();

    try {
      await client.query("BEGIN");

      const existingColumnResult = await client.query(
        `SELECT field_type, type_locked FROM cc_custom_columns WHERE id = $1 LIMIT 1`,
        [columnId]
      );

      if (existingColumnResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).send(
          new ServerResponse(false, { error_code: "CUSTOM_COLUMN_NOT_FOUND" }, "Custom column not found")
        );
      }

      const existingFieldType = existingColumnResult.rows[0].field_type;
      const isTypeLocked = existingColumnResult.rows[0].type_locked === true;

      if (field_type && field_type !== existingFieldType && isTypeLocked) {
        await client.query("ROLLBACK");
        return res.status(400).send(
          new ServerResponse(
            false,
            { error_code: "CUSTOM_COLUMN_TYPE_IMMUTABLE" },
            "Custom column type cannot be changed after creation"
          )
        );
      }

      // A locked type would have been rejected above, so any surviving change is allowed.
      const resolvedFieldType =
        field_type && field_type !== existingFieldType ? field_type : existingFieldType;

      // 1. Update the main custom column
      const columnQuery = `
        UPDATE cc_custom_columns 
        SET name = $1, field_type = $2, width = $3, is_visible = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING id;
      `;
      await client.query(columnQuery, [
        name,
        resolvedFieldType,
        columnWidth,
        is_visible,
        columnId,
      ]);

      if (lock_field_type === true) {
        await client.query(
          `UPDATE cc_custom_columns SET type_locked = TRUE WHERE id = $1`,
          [columnId]
        );
      }

      if (resolvedFieldType !== existingFieldType) {
        await client.query(`DELETE FROM cc_column_values WHERE column_id = $1`, [columnId]);
      }

      // 2. Update the configuration when it exists. column_id is not unique
      // in the current schema, so it cannot be used with ON CONFLICT.
      const configValues = [
        columnId,
        configuration.field_title,
        resolvedFieldType,
        configuration.number_type || null,
        configuration.decimals || null,
        configuration.label || null,
        configuration.label_position || null,
        configuration.preview_value || null,
        configuration.expression || null,
        configuration.first_numeric_column_key || null,
        configuration.second_numeric_column_key || null,
      ];
      const configUpdateResult = await client.query(
        `
          UPDATE cc_column_configurations
          SET field_title = $2,
              field_type = $3,
              number_type = $4,
              decimals = $5,
              label = $6,
              label_position = $7,
              preview_value = $8,
              expression = $9,
              first_numeric_column_key = $10,
              second_numeric_column_key = $11,
              updated_at = CURRENT_TIMESTAMP
          WHERE column_id = $1;
        `,
        configValues
      );

      if (configUpdateResult.rowCount === 0) {
        await client.query(
          `
            INSERT INTO cc_column_configurations (
              column_id, field_title, field_type, number_type,
              decimals, label, label_position, preview_value,
              expression, first_numeric_column_key, second_numeric_column_key
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
          `,
          configValues
        );
      }

      // 3. Update selections if present
      if (configuration.selections_list) {
        // Delete existing selections
        await client.query(
          "DELETE FROM cc_selection_options WHERE column_id = $1",
          [columnId]
        );

        // Insert new selections
        if (configuration.selections_list.length > 0) {
          const selectionQuery = `
            INSERT INTO cc_selection_options (
              column_id, selection_id, selection_name, selection_color, selection_order
            ) VALUES ($1, $2, $3, $4, $5);
          `;
          for (const [
            index,
            selection,
          ] of configuration.selections_list.entries()) {
            await client.query(selectionQuery, [
              columnId,
              selection.selection_id,
              selection.selection_name,
              selection.selection_color,
              index,
            ]);
          }
        }
      }

      // 4. Update labels if present
      if (configuration.labels_list) {
        // Delete existing labels
        await client.query("DELETE FROM cc_label_options WHERE column_id = $1", [
          columnId,
        ]);

        // Insert new labels
        if (configuration.labels_list.length > 0) {
          const labelQuery = `
            INSERT INTO cc_label_options (
              column_id, label_id, label_name, label_color, label_order
            ) VALUES ($1, $2, $3, $4, $5);
          `;
          for (const [index, label] of configuration.labels_list.entries()) {
            await client.query(labelQuery, [
              columnId,
              label.label_id,
              label.label_name,
              label.label_color,
              index,
            ]);
          }
        }
      }

      await client.query("COMMIT");

      // Fetch the updated column data
      const getColumnQuery = `
        SELECT 
          cc.*,
          cf.field_title,
          cf.number_type,
          cf.decimals,
          cf.label,
          cf.label_position,
          cf.preview_value,
          cf.expression,
          cf.first_numeric_column_key,
          cf.second_numeric_column_key,
          (
            SELECT json_agg(
              json_build_object(
                'selection_id', so.selection_id,
                'selection_name', so.selection_name,
                'selection_color', so.selection_color
              )
            )
            FROM cc_selection_options so
            WHERE so.column_id = cc.id
          ) as selections_list,
          (
            SELECT json_agg(
              json_build_object(
                'label_id', lo.label_id,
                'label_name', lo.label_name,
                'label_color', lo.label_color
              )
            )
            FROM cc_label_options lo
            WHERE lo.column_id = cc.id
          ) as labels_list
        FROM cc_custom_columns cc
        LEFT JOIN cc_column_configurations cf ON cf.column_id = cc.id
        WHERE cc.id = $1;
      `;
      const result = await client.query(getColumnQuery, [columnId]);
      const [data] = result.rows;

      return res.status(200).send(new ServerResponse(true, data));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  @HandleExceptions()
  public static async deleteById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;

    const q = `
      DELETE FROM cc_custom_columns
      WHERE id = $1
      RETURNING id;
    `;
    const result = await db.query(q, [id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getProjectColumns(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id } = req.params;

    const q = `
      WITH column_data AS (
        SELECT 
          cc.id,
          cc.key,
          cc.name,
          cc.field_type,
          cc.width,
          cc.is_visible,
          cf.field_title,
          cf.number_type,
          cf.decimals,
          cf.label,
          cf.label_position,
          cf.preview_value,
          cf.expression,
          cf.first_numeric_column_key,
          cf.second_numeric_column_key,
          (
            SELECT json_agg(
              json_build_object(
                'selection_id', so.selection_id,
                'selection_name', so.selection_name,
                'selection_color', so.selection_color
              )
            )
            FROM cc_selection_options so
            WHERE so.column_id = cc.id
          ) as selections_list,
          (
            SELECT json_agg(
              json_build_object(
                'label_id', lo.label_id,
                'label_name', lo.label_name,
                'label_color', lo.label_color
              )
            )
            FROM cc_label_options lo
            WHERE lo.column_id = cc.id
          ) as labels_list
        FROM cc_custom_columns cc
        LEFT JOIN cc_column_configurations cf ON cf.column_id = cc.id
        WHERE cc.project_id = $1
      )
      SELECT 
        json_agg(
          json_build_object(
            'key', cd.key,
            'id', cd.id,
            'name', cd.name,
            'width', cd.width,
            'pinned', cd.is_visible,
            'custom_column', true,
            'custom_column_obj', json_build_object(
              'fieldType', cd.field_type,
              'fieldTitle', cd.field_title,
              'numberType', cd.number_type,
              'decimals', cd.decimals,
              'label', cd.label,
              'labelPosition', cd.label_position,
              'previewValue', cd.preview_value,
              'expression', cd.expression,
              'firstNumericColumnKey', cd.first_numeric_column_key,
              'secondNumericColumnKey', cd.second_numeric_column_key,
              'selectionsList', COALESCE(cd.selections_list, '[]'::json),
              'labelsList', COALESCE(cd.labels_list, '[]'::json)
            )
          )
        ) as columns
      FROM column_data cd;
    `;

    const result = await db.query(q, [project_id]);
    const columns = result.rows[0]?.columns || [];

    return res.status(200).send(new ServerResponse(true, columns));
  }
}
