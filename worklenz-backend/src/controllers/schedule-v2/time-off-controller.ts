import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import { getManagedMembers } from "../../shared/team-permissions";

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
    is_full_day?: boolean;
    hours_off?: number | null;
    timezone?: string | null;
    type?: "vacation" | "sick" | "personal" | "other" | null;
}

export default class TimeOffController extends WorklenzControllerBase {
    private static async getOrganizationId(userId?: string, ownerId?: string): Promise<string | null> {
        const orgResult = await db.query(
            `SELECT id FROM organizations WHERE user_id = $1 LIMIT 1`,
            [ownerId || userId]
        );

        return orgResult.rows[0]?.id || null;
    }

    private static async getActorContext(userId?: string): Promise<{
        active_team: string;
        actor_team_member_id: string;
        role_name: string;
        is_admin: boolean;
    } | null> {
        if (!userId) return null;

        const result = await db.query(
            `
            SELECT
                u.active_team,
                tm.id AS actor_team_member_id,
                COALESCE(r.name, 'Member') AS role_name,
                COALESCE(r.admin_role, FALSE) AS is_admin
            FROM users u
            LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = u.active_team AND tm.active = TRUE
            LEFT JOIN roles r ON r.id = tm.role_id
            WHERE u.id = $1
            LIMIT 1
            `,
            [userId]
        );

        return result.rows[0] || null;
    }

    private static validateTimeOffPayload(payload: {
        is_full_day?: boolean;
        hours_off?: number | null;
        type?: string | null;
    }): string | null {
        const allowedTypes = new Set(["vacation", "sick", "personal", "other"]);
        const isFullDay = payload.is_full_day !== false;
        const hoursOff = payload.hours_off;

        if (payload.type && !allowedTypes.has(payload.type)) {
            return "Invalid time-off type";
        }

        if (!isFullDay) {
            if (hoursOff == null || Number.isNaN(Number(hoursOff)) || Number(hoursOff) <= 0) {
                return "hours_off is required and must be greater than 0 for partial-day time-off";
            }
        }

        if (hoursOff != null && (Number(hoursOff) <= 0 || Number(hoursOff) > 24)) {
            return "hours_off must be between 0 and 24";
        }

        return null;
    }

    private static async canManageTargetMember(
        user: IWorkLenzRequest["user"],
        targetTeamMemberId: string
    ): Promise<boolean> {
        if (!user?.id || !targetTeamMemberId) return false;

        const actor = await TimeOffController.getActorContext(user.id);
        if (!actor?.actor_team_member_id) return false;

        if (user.owner) {
            return true;
        }

        if (actor.role_name === "Team Lead") {
            if (actor.actor_team_member_id === targetTeamMemberId) return true;
            const managedMembers = await getManagedMembers(actor.actor_team_member_id);
            return managedMembers.includes(targetTeamMemberId);
        }

        if (user.is_admin || actor.is_admin) return true;

        return actor.actor_team_member_id === targetTeamMemberId;
    }

    /**
     * Get time-off entries for team members
     * Supports filtering by member and date range
     */
    @HandleExceptions()
    public static async getTimeOff(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { teamMemberId, startDate, endDate } = req.query as ITimeOffFilters;

        const params: any[] = [];
        let paramIndex = 1;

        const organizationId = await TimeOffController.getOrganizationId(req.user?.id, req.user?.owner_id);
        if (!organizationId) {
            return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
        }

        params.push(organizationId);
        paramIndex++;

        let whereClause = `WHERE mto.organization_id = $1`;

        const actor = await TimeOffController.getActorContext(req.user?.id);
        if (!actor?.actor_team_member_id) {
            return res.status(400).send(new ServerResponse(false, null, "Missing team member context"));
        }

        if (teamMemberId) {
            const canManage = await TimeOffController.canManageTargetMember(req.user, teamMemberId);
            if (!canManage) {
                return res.status(403).send(new ServerResponse(false, null, "You do not have permission to view this member's time-off"));
            }
            whereClause += ` AND mto.team_member_id = $${paramIndex}`;
            params.push(teamMemberId);
            paramIndex++;
        } else if (actor.role_name === "Team Lead") {
            const managedMembers = await getManagedMembers(actor.actor_team_member_id);
            const memberScope = [actor.actor_team_member_id, ...managedMembers];
            whereClause += ` AND mto.team_member_id = ANY($${paramIndex}::UUID[])`;
            params.push(memberScope);
            paramIndex++;
        } else if (!req.user?.owner && !req.user?.is_admin && !actor.is_admin) {
            whereClause += ` AND mto.team_member_id = $${paramIndex}`;
            params.push(actor.actor_team_member_id);
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
                mto.is_full_day,
                mto.hours_off,
                mto.timezone,
                mto.type,
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
        const isFullDay = req.body.is_full_day !== false;
        const hoursOff = req.body.hours_off ?? null;
        const timezone = req.body.timezone ?? null;
        const type = req.body.type ?? null;

        // Validate required fields
        if (!team_member_id || !start_date || !end_date) {
            return res.status(400).send(new ServerResponse(false, null, "team_member_id, start_date, and end_date are required"));
        }

        // Validate date range
        if (new Date(end_date) < new Date(start_date)) {
            return res.status(400).send(new ServerResponse(false, null, "End date must be after start date"));
        }

        const payloadError = TimeOffController.validateTimeOffPayload({
            is_full_day: isFullDay,
            hours_off: hoursOff,
            type,
        });
        if (payloadError) {
            return res.status(400).send(new ServerResponse(false, null, payloadError));
        }

        const canManage = await TimeOffController.canManageTargetMember(req.user, team_member_id);
        if (!canManage) {
            return res.status(403).send(new ServerResponse(false, null, "You do not have permission to create time-off for this member"));
        }

        const organizationId = await TimeOffController.getOrganizationId(req.user?.id, req.user?.owner_id);
        if (!organizationId) {
            return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
        }

        // Check for overlapping time-off entries
        const overlapQuery = `
            SELECT id FROM member_time_off
            WHERE team_member_id = $1
            AND (
                (start_date::DATE <= $2::DATE AND end_date::DATE >= $2::DATE)
                OR (start_date::DATE <= $3::DATE AND end_date::DATE >= $3::DATE)
                OR (start_date::DATE >= $2::DATE AND end_date::DATE <= $3::DATE)
            )
        `;

        const overlapResult = await db.query(overlapQuery, [team_member_id, start_date, end_date]);

        if (overlapResult.rows.length > 0) {
            return res.status(400).send(new ServerResponse(false, null, "Time-off period overlaps with existing entry"));
        }

        // Insert new time-off entry
        const insertQuery = `
            INSERT INTO member_time_off (
                team_member_id, organization_id, start_date, end_date, reason, created_by,
                is_full_day, hours_off, timezone, type
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, team_member_id, start_date, end_date, reason, is_full_day, hours_off, timezone, type, created_at
        `;

        const result = await db.query(insertQuery, [
            team_member_id,
            organizationId,
            start_date,
            end_date,
            reason || null,
            req.user?.id,
            isFullDay,
            isFullDay ? null : Number(hoursOff),
            timezone,
            type,
        ]);

        return res.status(201).send(new ServerResponse(true, result.rows[0], "Time-off entry created successfully"));
    }

    /**
     * Update an existing time-off entry
     */
    @HandleExceptions()
    public static async updateTimeOff(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { id } = req.params;
        const { start_date, end_date, reason, is_full_day, hours_off, timezone, type } = req.body;

        const existingResult = await db.query(
            `SELECT id, team_member_id FROM member_time_off WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (existingResult.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Time-off entry not found"));
        }

        const targetTeamMemberId = existingResult.rows[0].team_member_id;
        const canManage = await TimeOffController.canManageTargetMember(req.user, targetTeamMemberId);
        if (!canManage) {
            return res.status(403).send(new ServerResponse(false, null, "You do not have permission to update this time-off entry"));
        }

        // Validate date range if both dates provided
        if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
            return res.status(400).send(new ServerResponse(false, null, "End date must be after start date"));
        }

        const payloadError = TimeOffController.validateTimeOffPayload({
            is_full_day,
            hours_off,
            type,
        });
        if (payloadError) {
            return res.status(400).send(new ServerResponse(false, null, payloadError));
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

        if (is_full_day !== undefined) {
            updates.push(`is_full_day = $${paramIndex}`);
            params.push(!!is_full_day);
            paramIndex++;
        }

        if (hours_off !== undefined) {
            updates.push(`hours_off = $${paramIndex}`);
            params.push(hours_off == null ? null : Number(hours_off));
            paramIndex++;
        }

        if (timezone !== undefined) {
            updates.push(`timezone = $${paramIndex}`);
            params.push(timezone);
            paramIndex++;
        }

        if (type !== undefined) {
            updates.push(`type = $${paramIndex}`);
            params.push(type);
            paramIndex++;
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        params.push(id);

        const updateQuery = `
            UPDATE member_time_off
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING id, team_member_id, start_date, end_date, reason, is_full_day, hours_off, timezone, type, updated_at
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

        const existingResult = await db.query(
            `SELECT id, team_member_id FROM member_time_off WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (existingResult.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Time-off entry not found"));
        }

        const targetTeamMemberId = existingResult.rows[0].team_member_id;
        const canManage = await TimeOffController.canManageTargetMember(req.user, targetTeamMemberId);
        if (!canManage) {
            return res.status(403).send(new ServerResponse(false, null, "You do not have permission to delete this time-off entry"));
        }

        const deleteQuery = `DELETE FROM member_time_off WHERE id = $1 RETURNING id`;

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

        const organizationId = await TimeOffController.getOrganizationId(req.user?.id, req.user?.owner_id);
        if (!organizationId) {
            return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
        }

        const actor = await TimeOffController.getActorContext(req.user?.id);
        if (!actor?.actor_team_member_id) {
            return res.status(400).send(new ServerResponse(false, null, "Missing team member context"));
        }

        const scopeParams: any[] = [organizationId, startDate, endDate];
        let scopeFilter = "";
        if (actor.role_name === "Team Lead") {
            const managedMembers = await getManagedMembers(actor.actor_team_member_id);
            const memberScope = [actor.actor_team_member_id, ...managedMembers];
            scopeParams.push(memberScope);
            scopeFilter = ` AND tm.id = ANY($4::UUID[])`;
        } else if (!req.user?.owner && !req.user?.is_admin && !actor.is_admin) {
            scopeParams.push(actor.actor_team_member_id);
            scopeFilter = ` AND tm.id = $4::UUID`;
        }

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
                            'reason', mto.reason,
                            'is_full_day', mto.is_full_day,
                            'hours_off', mto.hours_off,
                            'timezone', mto.timezone,
                            'type', mto.type
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
            ${scopeFilter}
            GROUP BY tm.id, u.name, u.email
            ORDER BY u.name
        `;

        const result = await db.query(query, scopeParams);

        return res.status(200).send(new ServerResponse(true, result.rows));
    }
}
