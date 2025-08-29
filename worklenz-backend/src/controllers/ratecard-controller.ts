import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class RateCardController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async create(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `
      INSERT INTO finance_rate_cards (team_id, name)
      VALUES ($1, $2)
      RETURNING id, name, team_id, created_at, updated_at;
    `;
    const result = await db.query(q, [
      req.user?.team_id || null,
      req.body.name,
    ]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { searchQuery, sortField, sortOrder, size, offset } =
      this.toPaginationOptions(req.query, "name");

    const q = `
    SELECT ROW_TO_JSON(rec) AS rate_cards
    FROM (
      SELECT COUNT(*) AS total,
        (
          SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
          FROM (
            SELECT id, name, team_id, currency, created_at, updated_at
            FROM finance_rate_cards
            WHERE team_id = $1 ${searchQuery}
            ORDER BY ${sortField} ${sortOrder}
            LIMIT $2 OFFSET $3
          ) t
        ) AS data
      FROM finance_rate_cards
      WHERE team_id = $1 ${searchQuery}
    ) rec;
  `;
    const result = await db.query(q, [req.user?.team_id || null, size, offset]);
    const [data] = result.rows;

    return res
      .status(200)
      .send(
        new ServerResponse(
          true,
          data.rate_cards || this.paginatedDatasetDefaultStruct
        )
      );
  }

  @HandleExceptions()
  public static async getById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    // 1. Fetch the rate card
    const q = `
    SELECT id, name, team_id, currency, created_at, updated_at
    FROM finance_rate_cards
    WHERE id = $1 AND team_id = $2;
  `;
    const result = await db.query(q, [
      req.params.id,
      req.user?.team_id || null,
    ]);
    const [data] = result.rows;

    if (!data) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Rate card not found"));
    }

    // 2. Fetch job roles with job title names
    const jobRolesQ = `
    SELECT
      rcr.job_title_id,
      jt.name AS jobTitle,
      rcr.rate,
      rcr.man_day_rate,
      rcr.rate_card_id
    FROM finance_rate_card_roles rcr
    LEFT JOIN job_titles jt ON rcr.job_title_id = jt.id
    WHERE rcr.rate_card_id = $1
  `;
    const jobRolesResult = await db.query(jobRolesQ, [req.params.id]);
    const jobRolesList = jobRolesResult.rows;

    // 3. Return the rate card with jobRolesList
    return res.status(200).send(
      new ServerResponse(true, {
        ...data,
        jobRolesList,
      })
    );
  }

  @HandleExceptions()
  public static async update(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    // 1. Update the rate card
    const updateRateCardQ = `
    UPDATE finance_rate_cards
    SET name = $3, currency = $4, updated_at = NOW()
    WHERE id = $1 AND team_id = $2
    RETURNING id, name, team_id, currency, created_at, updated_at;
  `;
    const result = await db.query(updateRateCardQ, [
      req.params.id,
      req.user?.team_id || null,
      req.body.name,
      req.body.currency,
    ]);
    const [rateCardData] = result.rows;

    // 2. Update job roles (delete old, insert new)
    if (Array.isArray(req.body.jobRolesList)) {
      // Delete existing roles for this rate card
      await db.query(
        `DELETE FROM finance_rate_card_roles WHERE rate_card_id = $1;`,
        [req.params.id]
      );

      // Insert new roles
      for (const role of req.body.jobRolesList) {
        if (role.job_title_id) {
          await db.query(
            `INSERT INTO finance_rate_card_roles (rate_card_id, job_title_id, rate, man_day_rate)
           VALUES ($1, $2, $3, $4);`,
            [
              req.params.id,
              role.job_title_id,
              role.rate ?? 0,
              role.man_day_rate ?? 0,
            ]
          );
        }
      }
    }

    // 3. Get jobRolesList with job title names
    const jobRolesQ = `
    SELECT
      rcr.job_title_id,
      jt.name AS jobTitle,
      rcr.rate
    FROM finance_rate_card_roles rcr
    LEFT JOIN job_titles jt ON rcr.job_title_id = jt.id
    WHERE rcr.rate_card_id = $1
  `;
    const jobRolesResult = await db.query(jobRolesQ, [req.params.id]);
    const jobRolesList = jobRolesResult.rows;

    // 4. Return the updated rate card with jobRolesList
    return res.status(200).send(
      new ServerResponse(true, {
        ...rateCardData,
        jobRolesList,
      })
    );
  }

  @HandleExceptions()
  public static async deleteById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `
      DELETE FROM finance_rate_cards
      WHERE id = $1 AND team_id = $2
      RETURNING id;
    `;
    const result = await db.query(q, [
      req.params.id,
      req.user?.team_id || null,
    ]);
    return res
      .status(200)
      .send(new ServerResponse(true, result.rows.length > 0));
  }
}
