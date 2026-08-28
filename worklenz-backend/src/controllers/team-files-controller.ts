import db from "../config/db";

import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";

const MAX_PAGE_SIZE = 100;

function getPagination(req: IWorkLenzRequest) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.size as string) || 20));
  const offset = (page - 1) * size;
  return { page, size, offset };
}

export default class TeamFilesController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getProjectFiles(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id;
    const teamId = req.user?.team_id;
    const { size, offset } = getPagination(req);

    let paramOffset = 2;
    const params: any[] = [teamId];

    let membershipFilter = "";
    if (!req.user?.owner && !req.user?.is_admin) {
      params.push(userId, teamId);
      membershipFilter = ` AND is_member_of_project(p.id, $${paramOffset}, $${paramOffset + 1}) `;
      paramOffset += 2;
    }

    let projectFilter = "";
    if (req.query.project_id) {
      params.push(req.query.project_id);
      projectFilter = ` AND pf.project_id = $${paramOffset} `;
      paramOffset++;
    }

    let typeFilter = "";
    if (req.query.file_type) {
      params.push(req.query.file_type);
      typeFilter = ` AND pf.type = $${paramOffset} `;
      paramOffset++;
    }

    let uploadedByFilter = "";
    if (req.query.uploaded_by) {
      params.push(req.query.uploaded_by);
      uploadedByFilter = ` AND pf.uploaded_by = $${paramOffset} `;
      paramOffset++;
    }

    let searchFilter = "";
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      searchFilter = ` AND pf.name ILIKE $${paramOffset} `;
      paramOffset++;
    }

    const limitParam = paramOffset;
    const offsetParam = paramOffset + 1;
    params.push(size, offset);

    const q = `
      SELECT pf.id,
             pf.name,
             pf.size,
             pf.type,
             pf.created_at,
             pf.project_id,
             p.name AS project_name,
             p.color_code AS project_color,
             COALESCE(u.name, '') AS uploaded_by,
             pf.uploaded_by AS uploaded_by_id,
             COUNT(*) OVER () AS total
      FROM project_files pf
             JOIN projects p ON pf.project_id = p.id
             LEFT JOIN users u ON u.id = pf.uploaded_by
      WHERE pf.team_id = $1
        AND pf.status = 'active'
        ${membershipFilter} ${projectFilter} ${typeFilter} ${uploadedByFilter} ${searchFilter}
      ORDER BY pf.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam};
    `;

    const result = await db.query(q, params);
    const total = result.rows[0]?.total ? parseInt(result.rows[0].total) : 0;
    const data = result.rows.map(({ total: _t, ...row }) => ({ ...row, size: Number(row.size) || 0 }));

    return res.status(200).send(new ServerResponse(true, { total, data }));
  }

  @HandleExceptions()
  public static async getTaskAttachments(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id;
    const teamId = req.user?.team_id;
    const { size, offset } = getPagination(req);

    let paramOffset = 2;
    const params: any[] = [teamId];

    let membershipFilter = "";
    if (!req.user?.owner && !req.user?.is_admin) {
      params.push(userId, teamId);
      membershipFilter = ` AND is_member_of_project(p.id, $${paramOffset}, $${paramOffset + 1}) `;
      paramOffset += 2;
    }

    let projectFilter = "";
    if (req.query.project_id) {
      params.push(req.query.project_id);
      projectFilter = ` AND ta.project_id = $${paramOffset} `;
      paramOffset++;
    }

    let typeFilter = "";
    if (req.query.file_type) {
      params.push(req.query.file_type);
      typeFilter = ` AND ta.type = $${paramOffset} `;
      paramOffset++;
    }

    let uploadedByFilter = "";
    if (req.query.uploaded_by) {
      params.push(req.query.uploaded_by);
      uploadedByFilter = ` AND ta.uploaded_by = $${paramOffset} `;
      paramOffset++;
    }

    let searchFilter = "";
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      searchFilter = ` AND ta.name ILIKE $${paramOffset} `;
      paramOffset++;
    }

    const limitParam = paramOffset;
    const offsetParam = paramOffset + 1;
    params.push(size, offset);

    const q = `
      SELECT ta.id,
             ta.name,
             ta.size,
             ta.type,
             ta.created_at,
             ta.project_id,
             p.name AS project_name,
             p.color_code AS project_color,
             ta.task_id,
             t.name AS task_name,
             CONCAT(p.key, '-', t.task_no) AS task_key,
             COALESCE(u.name, '') AS uploaded_by,
             ta.uploaded_by AS uploaded_by_id,
             COUNT(*) OVER () AS total
      FROM task_attachments ta
             JOIN projects p ON ta.project_id = p.id
             LEFT JOIN tasks t ON ta.task_id = t.id
             LEFT JOIN users u ON u.id = ta.uploaded_by
      WHERE ta.team_id = $1
        ${membershipFilter} ${projectFilter} ${typeFilter} ${uploadedByFilter} ${searchFilter}
      ORDER BY ta.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam};
    `;

    const result = await db.query(q, params);
    const total = result.rows[0]?.total ? parseInt(result.rows[0].total) : 0;
    const data = result.rows.map(({ total: _t, ...row }) => ({ ...row, size: Number(row.size) || 0 }));

    return res.status(200).send(new ServerResponse(true, { total, data }));
  }

  @HandleExceptions()
  public static async getLinks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id;
    const teamId = req.user?.team_id;
    const { size, offset } = getPagination(req);

    let paramOffset = 2;
    const params: any[] = [teamId];

    let membershipFilter = "";
    if (!req.user?.owner && !req.user?.is_admin) {
      params.push(userId, teamId);
      membershipFilter = ` AND is_member_of_project(p.id, $${paramOffset}, $${paramOffset + 1}) `;
      paramOffset += 2;
    }

    let projectFilter = "";
    if (req.query.project_id) {
      params.push(req.query.project_id);
      projectFilter = ` AND pl.project_id = $${paramOffset} `;
      paramOffset++;
    }

    let addedByFilter = "";
    if (req.query.uploaded_by) {
      params.push(req.query.uploaded_by);
      addedByFilter = ` AND pl.added_by = $${paramOffset} `;
      paramOffset++;
    }

    let searchFilter = "";
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      searchFilter = ` AND (pl.title ILIKE $${paramOffset} OR pl.url ILIKE $${paramOffset}) `;
      paramOffset++;
    }

    const limitParam = paramOffset;
    const offsetParam = paramOffset + 1;
    params.push(size, offset);

    const q = `
      SELECT pl.id,
             pl.title,
             pl.url,
             pl.description,
             pl.source_type,
             pl.source_task_id,
             pl.project_id,
             p.name AS project_name,
             p.color_code AS project_color,
             t.name AS source_task_name,
             CONCAT(p.key, '-', t.task_no) AS source_task_key,
             COALESCE(u.name, '') AS added_by_name,
             pl.added_by AS added_by_id,
             pl.created_at,
             pl.updated_at,
             COUNT(*) OVER () AS total
      FROM project_links pl
             JOIN projects p ON pl.project_id = p.id
             LEFT JOIN tasks t ON t.id = pl.source_task_id
             LEFT JOIN users u ON u.id = pl.added_by
      WHERE pl.team_id = $1
        ${membershipFilter} ${projectFilter} ${addedByFilter} ${searchFilter}
      ORDER BY pl.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam};
    `;

    const result = await db.query(q, params);
    const total = result.rows[0]?.total ? parseInt(result.rows[0].total) : 0;
    const data = result.rows.map(({ total: _t, ...row }) => row);

    return res.status(200).send(new ServerResponse(true, { total, data }));
  }
}
