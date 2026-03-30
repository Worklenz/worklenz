import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";

interface ITimeOffFilters {
    teamMemberId?: string;
    startDate?: string;
    endDate?: string;
}

interface ITimeOffBody {
    team_member_id: string;
    start_date: string;
    end_date: string;
    reason?: string;
}

export default class TimeOffController extends WorklenzControllerBase {
    /**
     * Get time-off entries for team members
     * Supports filtering by member and date range
     */
    @HandleExceptions()
    public static async getTimeOff(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { teamMemberId, startDate, endDate } = req.query as ITimeOffFilters;

        const params: any[] = [];
        let paramIndex = 1;

        // Get organization ID from user
        const orgQuery = `SELECT id FROM organizations WHERE user_id = $1 LIMIT 1`;
        const orgResult = await db.query(orgQuery, [req.user?.owner_id]);
        
        if (orgResult.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
        }

        const organizationId = orgResult.rows[0].id;
        params.push(organizationId);
        paramIndex++;

        let whereClause = `WHERE mto.organization_id = $1`;

        if (teamMemberId) {
            whereClause += ` AND mto.team_member_id = $${paramIndex}`;
            params.push(teamMemberId);
            paramIndex++;
        }

        if (startDate) {
            whereClause += ` AND mto.end_date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            whereClause += ` AND mto.start_date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }

        const query = `
            SELECT 
                mto.id,
                mto.team_member_id,
                mto.start_date,
                mto.end_date,
                mto.reason,
                mto.created_at,
                u.name AS member_name,
                u.email AS member_email,
                u.avatar_url AS member_avatar
            FROM member_time_off mto
            JOIN team_members tm ON mto.team_member_id = tm.id
            JOIN users u ON tm.user_id = u.id
            ${whereClause}
            ORDER BY mto.start_date DESC
        `;

        const result = await db.query(query, params);

        return res.status(200).send(new ServerResponse(true, result.rows));
    }

    /**
     * Create a new time-off entry
     */
    @HandleExceptions()
    public static async createTimeOff(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { team_member_id, start_date, end_date, reason } = req.body as ITimeOffBody;

        // Validate required fields
        if (!team_member_id || !start_date || !end_date) {
            return res.status(400).send(new ServerResponse(false, null, "team_member_id, start_date, and end_date are required"));
        }

        // Validate date range
        if (new Date(end_date) < new Date(start_date)) {
            return res.status(400).send(new ServerResponse(false, null, "End date must be after start date"));
        }

        // Get organization ID
        const orgQuery = `SELECT id FROM organizations WHERE user_id = $1 LIMIT 1`;
        const orgResult = await db.query(orgQuery, [req.user?.owner_id]);
        
        if (orgResult.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
        }

        const organizationId = orgResult.rows[0].id;

        // Check for overlapping time-off entries
        const overlapQuery = `
            SELECT id FROM member_time_off
            WHERE team_member_id = $1
            AND (
                (start_date <= $2 AND end_date >= $2)
                OR (start_date <= $3 AND end_date >= $3)
                OR (start_date >= $2 AND end_date <= $3)
            )
        `;

        const overlapResult = await db.query(overlapQuery, [team_member_id, start_date, end_date]);

        if (overlapResult.rows.length > 0) {
            return res.status(400).send(new ServerResponse(false, null, "Time-off period overlaps with existing entry"));
        }

        // Insert new time-off entry
        const insertQuery = `
            INSERT INTO member_time_off (team_member_id, organization_id, start_date, end_date, reason, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, team_member_id, start_date, end_date, reason, created_at
        `;

        const result = await db.query(insertQuery, [
            team_member_id,
            organizationId,
            start_date,
            end_date,
            reason || null,
            req.user?.id
        ]);

        return res.status(201).send(new ServerResponse(true, result.rows[0], "Time-off entry created successfully"));
    }

    /**
     * Update an existing time-off entry
     */
    @HandleExceptions()
    public static async updateTimeOff(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { id } = req.params;
        const { start_date, end_date, reason } = req.body;

        // Validate date range if both dates provided
        if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
            return res.status(400).send(new ServerResponse(false, null, "End date must be after start date"));
        }

        // Build dynamic update query
        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (start_date !== undefined) {
            updates.push(`start_date = $${paramIndex}`);
            params.push(start_date);
            paramIndex++;
        }

        if (end_date !== undefined) {
            updates.push(`end_date = $${paramIndex}`);
            params.push(end_date);
            paramIndex++;
        }

        if (reason !== undefined) {
            updates.push(`reason = $${paramIndex}`);
            params.push(reason);
            paramIndex++;
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        params.push(id);

        const updateQuery = `
            UPDATE member_time_off
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING id, team_member_id, start_date, end_date, reason, updated_at
        `;

        const result = await db.query(updateQuery, params);

        if (result.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Time-off entry not found"));
        }

        return res.status(200).send(new ServerResponse(true, result.rows[0], "Time-off entry updated successfully"));
    }

    /**
     * Delete a time-off entry
     */
    @HandleExceptions()
    public static async deleteTimeOff(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { id } = req.params;

        const deleteQuery = `
            DELETE FROM member_time_off
            WHERE id = $1
            RETURNING id
        `;

        const result = await db.query(deleteQuery, [id]);

        if (result.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Time-off entry not found"));
        }

        return res.status(200).send(new ServerResponse(true, null, "Time-off entry deleted successfully"));
    }

    /**
     * Get time-off summary for all team members in date range
     */
    @HandleExceptions()
    public static async getTimeOffSummary(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

        if (!startDate || !endDate) {
            return res.status(400).send(new ServerResponse(false, null, "startDate and endDate are required"));
        }

        // Get organization ID
        const orgQuery = `SELECT id FROM organizations WHERE user_id = $1 LIMIT 1`;
        const orgResult = await db.query(orgQuery, [req.user?.owner_id]);
        
        if (orgResult.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
        }

        const organizationId = orgResult.rows[0].id;

        const query = `
            SELECT 
                tm.id AS team_member_id,
                u.name AS member_name,
                u.email AS member_email,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', mto.id,
                            'start_date', mto.start_date,
                            'end_date', mto.end_date,
                            'reason', mto.reason
                        )
                    ) FILTER (WHERE mto.id IS NOT NULL),
                    '[]'::json
                ) AS time_off_periods,
                COALESCE(
                    SUM(
                        EXTRACT(DAY FROM (
                            LEAST(mto.end_date, $3::timestamp) - 
                            GREATEST(mto.start_date, $2::timestamp)
                        )) + 1
                    ),
                    0
                ) AS total_days_off
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            LEFT JOIN member_time_off mto ON tm.id = mto.team_member_id
                AND mto.end_date >= $2
                AND mto.start_date <= $3
            WHERE tm.team_id IN (
                SELECT id FROM teams WHERE organization_id = $1
            )
            GROUP BY tm.id, u.name, u.email
            ORDER BY u.name
        `;

        const result = await db.query(query, [organizationId, startDate, endDate]);

        return res.status(200).send(new ServerResponse(true, result.rows));
    }
}
