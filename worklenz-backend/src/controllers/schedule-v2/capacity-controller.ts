import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";

interface DailyCapacity {
    date: string;
    working_hours: number;
    allocated_hours: number;
    available_hours: number;
    utilization_percent: number;
    is_time_off: boolean;
    is_holiday: boolean;
    is_weekend: boolean;
    status: 'available' | 'normal' | 'fully-allocated' | 'overallocated' | 'unavailable';
    projects: Array<{
        project_id: string;
        project_name: string;
        allocated_hours: number;
        color_code: string;
    }>;
}

interface MemberCapacity {
    team_member_id: string;
    member_name: string;
    member_email: string;
    daily_capacity: DailyCapacity[];
    summary: {
        total_working_hours: number;
        total_allocated_hours: number;
        total_available_hours: number;
        average_utilization: number;
        days_overallocated: number;
        days_available: number;
    };
}

export default class CapacityController extends WorklenzControllerBase {
    /**
     * Get daily capacity for all team members in date range
     * GET /api/schedule-gannt-v2/capacity/daily
     */
    @HandleExceptions()
    public static async getDailyCapacity(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { startDate, endDate, teamMemberId } = req.query as {
            startDate?: string;
            endDate?: string;
            teamMemberId?: string;
        };

        if (!startDate || !endDate) {
            return res.status(400).send(new ServerResponse(false, null, "startDate and endDate are required"));
        }

        // Get organization ID and active team
        const orgQuery = `
            SELECT o.id as organization_id, u.active_team 
            FROM organizations o
            JOIN users u ON o.user_id = u.id 
            WHERE u.id = $1 
            LIMIT 1`;
        const orgResult = await db.query(orgQuery, [req.user?.id]);
        
        if (orgResult.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Organization or active team not found"));
        }

        const { organization_id: organizationId, active_team: activeTeamId } = orgResult.rows[0];

        if (!activeTeamId) {
            return res.status(400).send(new ServerResponse(false, null, "No active team selected"));
        }

        // Get team members from active team only
        let memberQuery = `
            SELECT DISTINCT ON (u.email)
                tm.id AS team_member_id,
                u.name AS member_name,
                u.email AS member_email
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = $1
            AND tm.active = true
        `;

        const params: any[] = [activeTeamId];
        let paramIndex = 2;

        if (teamMemberId) {
            memberQuery += ` AND tm.id = $${paramIndex}`;
            params.push(teamMemberId);
            paramIndex++;
        }

        memberQuery += ` ORDER BY u.email, u.name`;

        const membersResult = await db.query(memberQuery, params);

        // Calculate capacity for each member
        const capacityData: MemberCapacity[] = [];

        for (const member of membersResult.rows) {
            const capacityQuery = `
                SELECT * FROM calculate_member_capacity(
                    $1::UUID,
                    $2::DATE,
                    $3::DATE
                )
            `;

            const capacityResult = await db.query(capacityQuery, [
                member.team_member_id,
                startDate,
                endDate
            ]);

            const dailyCapacity: DailyCapacity[] = capacityResult.rows.map((row: any) => ({
                date: row.date,
                working_hours: parseFloat(row.working_hours) || 0,
                allocated_hours: parseFloat(row.allocated_hours) || 0,
                available_hours: parseFloat(row.available_hours) || 0,
                utilization_percent: parseFloat(row.utilization_percent) || 0,
                is_time_off: row.is_time_off,
                is_holiday: row.is_holiday,
                is_weekend: row.is_weekend,
                status: row.status,
                projects: row.projects || []
            }));

            // Calculate summary
            const workingDays = dailyCapacity.filter(d => d.working_hours > 0);
            const summary = {
                total_working_hours: workingDays.reduce((sum, d) => sum + d.working_hours, 0),
                total_allocated_hours: workingDays.reduce((sum, d) => sum + d.allocated_hours, 0),
                total_available_hours: workingDays.reduce((sum, d) => sum + d.available_hours, 0),
                average_utilization: workingDays.length > 0 
                    ? workingDays.reduce((sum, d) => sum + d.utilization_percent, 0) / workingDays.length 
                    : 0,
                days_overallocated: dailyCapacity.filter(d => d.status === 'overallocated').length,
                days_available: dailyCapacity.filter(d => d.status === 'available').length
            };

            capacityData.push({
                team_member_id: member.team_member_id,
                member_name: member.member_name,
                member_email: member.member_email,
                daily_capacity: dailyCapacity,
                summary
            });
        }

        return res.status(200).send(new ServerResponse(true, capacityData));
    }

    /**
     * Get capacity summary for all members (aggregated view)
     * GET /api/schedule-gannt-v2/capacity/summary
     */
    @HandleExceptions()
    public static async getCapacitySummary(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { startDate, endDate } = req.query as {
            startDate?: string;
            endDate?: string;
        };

        if (!startDate || !endDate) {
            return res.status(400).send(new ServerResponse(false, null, "startDate and endDate are required"));
        }

        // Get organization ID and active team
        const orgQuery = `
            SELECT o.id as organization_id, u.active_team 
            FROM organizations o
            JOIN users u ON o.user_id = u.id 
            WHERE u.id = $1 
            LIMIT 1`;
        const orgResult = await db.query(orgQuery, [req.user?.id]);
        
        if (orgResult.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Organization or active team not found"));
        }

        const { organization_id: organizationId, active_team: activeTeamId } = orgResult.rows[0];

        if (!activeTeamId) {
            return res.status(400).send(new ServerResponse(false, null, "No active team selected"));
        }

        // Get aggregated capacity summary from active team only
        const summaryQuery = `
            WITH member_list AS (
                SELECT DISTINCT tm.id AS team_member_id
                FROM team_members tm
                WHERE tm.team_id = $1
                AND tm.active = true
            ),
            capacity_data AS (
                SELECT 
                    ml.team_member_id,
                    cap.*
                FROM member_list ml
                CROSS JOIN LATERAL calculate_member_capacity(
                    ml.team_member_id,
                    $2::DATE,
                    $3::DATE
                ) cap
            )
            SELECT 
                COUNT(DISTINCT team_member_id) AS total_members,
                SUM(working_hours) AS total_working_hours,
                SUM(allocated_hours) AS total_allocated_hours,
                SUM(available_hours) AS total_available_hours,
                ROUND(AVG(utilization_percent), 2) AS average_utilization,
                COUNT(*) FILTER (WHERE status = 'overallocated') AS days_overallocated,
                COUNT(*) FILTER (WHERE status = 'available') AS days_available,
                COUNT(*) FILTER (WHERE status = 'fully-allocated') AS days_fully_allocated,
                COUNT(*) FILTER (WHERE status = 'normal') AS days_normal
            FROM capacity_data
            WHERE working_hours > 0
        `;

        const result = await db.query(summaryQuery, [activeTeamId, startDate, endDate]);

        return res.status(200).send(new ServerResponse(true, result.rows[0]));
    }

    /**
     * Get capacity conflicts (over-allocations and scheduling issues)
     * GET /api/schedule-gannt-v2/capacity/conflicts
     */
    @HandleExceptions()
    public static async getCapacityConflicts(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { startDate, endDate } = req.query as {
            startDate?: string;
            endDate?: string;
        };

        if (!startDate || !endDate) {
            return res.status(400).send(new ServerResponse(false, null, "startDate and endDate are required"));
        }

        // Get organization ID and active team
        const orgQuery = `
            SELECT o.id as organization_id, u.active_team 
            FROM organizations o
            JOIN users u ON o.user_id = u.id 
            WHERE u.id = $1 
            LIMIT 1`;
        const orgResult = await db.query(orgQuery, [req.user?.id]);
        
        if (orgResult.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Organization or active team not found"));
        }

        const { organization_id: organizationId, active_team: activeTeamId } = orgResult.rows[0];

        if (!activeTeamId) {
            return res.status(400).send(new ServerResponse(false, null, "No active team selected"));
        }

        // Find all conflicts from active team only
        const conflictsQuery = `
            WITH member_list AS (
                SELECT DISTINCT 
                    tm.id AS team_member_id,
                    u.name AS member_name,
                    u.email AS member_email
                FROM team_members tm
                JOIN users u ON tm.user_id = u.id
                WHERE tm.team_id = $1
                AND tm.active = true
            ),
            capacity_data AS (
                SELECT 
                    ml.team_member_id,
                    ml.member_name,
                    ml.member_email,
                    cap.*
                FROM member_list ml
                CROSS JOIN LATERAL calculate_member_capacity(
                    ml.team_member_id,
                    $2::DATE,
                    $3::DATE
                ) cap
                WHERE cap.status = 'overallocated'
            )
            SELECT 
                team_member_id,
                member_name,
                member_email,
                date,
                working_hours,
                allocated_hours,
                (allocated_hours - working_hours) AS overallocation_hours,
                utilization_percent,
                projects
            FROM capacity_data
            ORDER BY date, member_name
        `;

        const result = await db.query(conflictsQuery, [activeTeamId, startDate, endDate]);

        const conflicts = result.rows.map(row => ({
            type: 'overallocation',
            severity: row.overallocation_hours > 4 ? 'high' : row.overallocation_hours > 2 ? 'medium' : 'low',
            team_member_id: row.team_member_id,
            member_name: row.member_name,
            member_email: row.member_email,
            date: row.date,
            working_hours: parseFloat(row.working_hours),
            allocated_hours: parseFloat(row.allocated_hours),
            overallocation_hours: parseFloat(row.overallocation_hours),
            utilization_percent: parseFloat(row.utilization_percent),
            projects: row.projects,
            message: `${row.member_name} is over-allocated by ${parseFloat(row.overallocation_hours).toFixed(1)} hours on ${new Date(row.date).toLocaleDateString()}`
        }));

        return res.status(200).send(new ServerResponse(true, conflicts));
    }
}
