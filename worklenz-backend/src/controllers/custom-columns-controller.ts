import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

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
    const { name, field_type, width, is_visible, configuration } = req.body;

    const client = await db.pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Update the main custom column
      const columnQuery = `
        UPDATE cc_custom_columns 
        SET name = $1, field_type = $2, width = $3, is_visible = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING id;
      `;
      await client.query(columnQuery, [
        name,
        field_type,
        width,
        is_visible,
        id,
      ]);

      // 2. Update the configuration
      const configQuery = `
        UPDATE cc_column_configurations 
        SET 
          field_title = $1,
          field_type = $2,
          number_type = $3,
          decimals = $4,
          label = $5,
          label_position = $6,
          preview_value = $7,
          expression = $8,
          first_numeric_column_key = $9,
          second_numeric_column_key = $10,
          updated_at = CURRENT_TIMESTAMP
        WHERE column_id = $11;
      `;
      await client.query(configQuery, [
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
        id,
      ]);

      // 3. Update selections if present
      if (configuration.selections_list) {
        // Delete existing selections
        await client.query(
          "DELETE FROM cc_selection_options WHERE column_id = $1",
          [id]
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
              id,
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
          id,
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
              id,
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
      const result = await client.query(getColumnQuery, [id]);
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
