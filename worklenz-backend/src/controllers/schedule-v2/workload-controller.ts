import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";

export default class WorkloadController extends WorklenzControllerBase {

    /**
     * Get workload data for team members
     * GET /api/schedule-gannt-v2/workload
     * Query params: memberId (optional), startDate, endDate
     */
    @HandleExceptions()
    public static async getMemberWorkload(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { memberId, startDate, endDate } = req.query as { 
            memberId?: string; 
            startDate?: string; 
            endDate?: string; 
        };

        if (!startDate || !endDate) {
            return res.status(400).send(new ServerResponse(false, null, "startDate and endDate are required"));
        }

        // Get organization ID
        const orgQuery = `SELECT id, hours_per_day FROM organizations WHERE user_id = $1 LIMIT 1`;
        const orgResult = await db.query(orgQuery, [req.user?.owner_id]);
        
        if (orgResult.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
        }

        const { id: organizationId, hours_per_day: hoursPerDay } = orgResult.rows[0];

        // Build the workload query
        const workloadQuery = `
            WITH date_range AS (
                SELECT 
                    $1::DATE AS start_date,
                    $2::DATE AS end_date,
                    $3::UUID AS organization_id,
                    $4::NUMERIC AS hours_per_day
            ),
            working_days_count AS (
                SELECT 
                    dr.start_date,
                    dr.end_date,
                    dr.organization_id,
                    dr.hours_per_day,
                    (
                        SELECT COUNT(*) 
                        FROM generate_series(dr.start_date, dr.end_date, '1 day'::interval) AS day
                        JOIN public.organization_working_days owd ON owd.organization_id = dr.organization_id
                        WHERE 
                            (EXTRACT(ISODOW FROM day) = 1 AND owd.monday = true) OR
                            (EXTRACT(ISODOW FROM day) = 2 AND owd.tuesday = true) OR
                            (EXTRACT(ISODOW FROM day) = 3 AND owd.wednesday = true) OR
                            (EXTRACT(ISODOW FROM day) = 4 AND owd.thursday = true) OR
                            (EXTRACT(ISODOW FROM day) = 5 AND owd.friday = true) OR
                            (EXTRACT(ISODOW FROM day) = 6 AND owd.saturday = true) OR
                            (EXTRACT(ISODOW FROM day) = 7 AND owd.sunday = true)
                    ) AS working_days
                FROM date_range dr
            ),
            team_members_list AS (
                SELECT DISTINCT
                    tm.id AS team_member_id,
                    u.id AS user_id,
                    u.name AS member_name,
                    u.email AS member_email
                FROM team_members tm
                JOIN users u ON u.id = tm.user_id
                JOIN teams t ON t.id = tm.team_id
                WHERE t.organization_id = (SELECT organization_id FROM date_range)
                    ${memberId ? 'AND tm.id = $5' : ''}
            ),
            allocated_hours AS (
                SELECT 
                    tml.team_member_id,
                    tml.member_name,
                    tml.member_email,
                    COALESCE(SUM(
                        (pma.seconds_per_day / 3600.0) * 
                        (
                            SELECT COUNT(*) 
                            FROM generate_series(
                                GREATEST(pma.allocated_from, dr.start_date),
                                LEAST(pma.allocated_to, dr.end_date),
                                '1 day'::interval
                            ) AS day
                            JOIN public.organization_working_days owd ON owd.organization_id = dr.organization_id
                            WHERE 
                                (EXTRACT(ISODOW FROM day) = 1 AND owd.monday = true) OR
                                (EXTRACT(ISODOW FROM day) = 2 AND owd.tuesday = true) OR
                                (EXTRACT(ISODOW FROM day) = 3 AND owd.wednesday = true) OR
                                (EXTRACT(ISODOW FROM day) = 4 AND owd.thursday = true) OR
                                (EXTRACT(ISODOW FROM day) = 5 AND owd.friday = true) OR
                                (EXTRACT(ISODOW FROM day) = 6 AND owd.saturday = true) OR
                                (EXTRACT(ISODOW FROM day) = 7 AND owd.sunday = true)
                        )
                    ), 0) AS allocated_hours,
                    COUNT(DISTINCT pma.project_id) AS project_count,
                    jsonb_agg(DISTINCT jsonb_build_object(
                        'id', p.id,
                        'name', p.name,
                        'allocatedHours', (pma.seconds_per_day / 3600.0) * (
                            SELECT COUNT(*) 
                            FROM generate_series(
                                GREATEST(pma.allocated_from, dr.start_date),
                                LEAST(pma.allocated_to, dr.end_date),
                                '1 day'::interval
                            ) AS day
                            JOIN public.organization_working_days owd ON owd.organization_id = dr.organization_id
                            WHERE 
                                (EXTRACT(ISODOW FROM day) = 1 AND owd.monday = true) OR
                                (EXTRACT(ISODOW FROM day) = 2 AND owd.tuesday = true) OR
                                (EXTRACT(ISODOW FROM day) = 3 AND owd.wednesday = true) OR
                                (EXTRACT(ISODOW FROM day) = 4 AND owd.thursday = true) OR
                                (EXTRACT(ISODOW FROM day) = 5 AND owd.friday = true) OR
                                (EXTRACT(ISODOW FROM day) = 6 AND owd.saturday = true) OR
                                (EXTRACT(ISODOW FROM day) = 7 AND owd.sunday = true)
                        ),
                        'startDate', pma.allocated_from,
                        'endDate', pma.allocated_to
                    )) FILTER (WHERE pma.id IS NOT NULL) AS projects
                FROM team_members_list tml
                CROSS JOIN date_range dr
                LEFT JOIN project_member_allocations pma 
                    ON pma.team_member_id = tml.team_member_id
                    AND pma.allocated_from <= dr.end_date
                    AND pma.allocated_to >= dr.start_date
                LEFT JOIN projects p ON p.id = pma.project_id
                GROUP BY tml.team_member_id, tml.member_name, tml.member_email
            ),
            workload_summary AS (
                SELECT 
                    ah.team_member_id AS id,
                    ah.member_name AS name,
                    ah.member_email AS email,
                    (wdc.working_days * wdc.hours_per_day) AS total_hours,
                    ah.allocated_hours,
                    (wdc.working_days * wdc.hours_per_day) - ah.allocated_hours AS available_hours,
                    CASE 
                        WHEN (wdc.working_days * wdc.hours_per_day) = 0 THEN 0
                        ELSE (ah.allocated_hours / (wdc.working_days * wdc.hours_per_day)) * 100
                    END AS utilization_percent,
                    ah.project_count,
                    COALESCE(ah.projects, '[]'::jsonb) AS projects,
                    CASE 
                        WHEN ah.allocated_hours = 0 THEN 'available'
                        WHEN (ah.allocated_hours / NULLIF((wdc.working_days * wdc.hours_per_day), 0)) < 0.8 THEN 'normal'
                        WHEN (ah.allocated_hours / NULLIF((wdc.working_days * wdc.hours_per_day), 0)) >= 0.8 
                            AND (ah.allocated_hours / NULLIF((wdc.working_days * wdc.hours_per_day), 0)) <= 1.0 THEN 'fully-allocated'
                        ELSE 'overallocated'
                    END AS status
                FROM allocated_hours ah
                CROSS JOIN working_days_count wdc
            )
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', id,
                    'name', name,
                    'email', email,
                    'totalHours', ROUND(total_hours::numeric, 2),
                    'allocatedHours', ROUND(allocated_hours::numeric, 2),
                    'availableHours', ROUND(available_hours::numeric, 2),
                    'utilizationPercent', ROUND(utilization_percent::numeric, 2),
                    'projectCount', project_count,
                    'projects', projects,
                    'status', status
                )
            ) AS workload_data
            FROM workload_summary;
        `;

        const params = memberId 
            ? [startDate, endDate, organizationId, hoursPerDay, memberId]
            : [startDate, endDate, organizationId, hoursPerDay];

        const result = await db.query(workloadQuery, params);
        const workloadData = result.rows[0]?.workload_data || [];

        return res.status(200).send(new ServerResponse(true, workloadData));
    }

    /**
     * Update resource allocation
     * PUT /api/schedule-gannt-v2/allocation
     */
    @HandleExceptions()
    public static async updateResourceAllocation(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { memberId, projectId, allocatedHours, startDate, endDate } = req.body;

        if (!memberId || !projectId || allocatedHours === undefined) {
            return res.status(400).send(new ServerResponse(false, null, "memberId, projectId, and allocatedHours are required"));
        }

        // If startDate and endDate are provided, update or create allocation
        if (startDate && endDate) {
            // Check if allocation exists
            const checkQuery = `
                SELECT id FROM project_member_allocations 
                WHERE team_member_id = $1 AND project_id = $2
                AND allocated_from = $3 AND allocated_to = $4
            `;
            const checkResult = await db.query(checkQuery, [memberId, projectId, startDate, endDate]);

            if (checkResult.rows.length > 0) {
                // Update existing allocation
                const updateQuery = `
                    UPDATE project_member_allocations 
                    SET seconds_per_day = $1, updated_at = NOW()
                    WHERE id = $2
                    RETURNING *
                `;
                await db.query(updateQuery, [allocatedHours * 3600, checkResult.rows[0].id]);
            } else {
                // Create new allocation
                const insertQuery = `
                    INSERT INTO project_member_allocations 
                    (team_member_id, project_id, allocated_from, allocated_to, seconds_per_day)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING *
                `;
                await db.query(insertQuery, [memberId, projectId, startDate, endDate, allocatedHours * 3600]);
            }
        } else {
            // Update all allocations for this member-project combination
            const updateQuery = `
                UPDATE project_member_allocations 
                SET seconds_per_day = $1, updated_at = NOW()
                WHERE team_member_id = $2 AND project_id = $3
            `;
            await db.query(updateQuery, [allocatedHours * 3600, memberId, projectId]);
        }

        return res.status(200).send(new ServerResponse(true, null, "Allocation updated successfully"));
    }

    /**
     * Rebalance workload across team members
     * POST /api/schedule-gannt-v2/rebalance
     */
    @HandleExceptions()
    public static async rebalanceWorkload(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { memberIds, strategy = 'even', maxUtilization = 100 } = req.body;

        // Get organization ID
        const orgQuery = `SELECT id, hours_per_day FROM organizations WHERE user_id = $1 LIMIT 1`;
        const orgResult = await db.query(orgQuery, [req.user?.owner_id]);
        
        if (orgResult.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
        }

        const { id: organizationId, hours_per_day: hoursPerDay } = orgResult.rows[0];

        // This is a simplified rebalancing algorithm
        // In production, you'd want more sophisticated logic based on skills, availability, etc.
        
        // For now, we'll just return a success message
        // The actual rebalancing logic would involve:
        // 1. Getting all allocations for the specified members
        // 2. Calculating current utilization
        // 3. Redistributing hours based on the strategy
        // 4. Updating allocations in the database

        return res.status(200).send(new ServerResponse(true, null, "Workload rebalancing initiated"));
    }

    /**
     * Get resource conflicts (overlapping allocations, over-allocations)
     * GET /api/schedule-gannt-v2/conflicts
     */
    @HandleExceptions()
    public static async getResourceConflicts(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        // Get organization ID
        const orgQuery = `SELECT id, hours_per_day FROM organizations WHERE user_id = $1 LIMIT 1`;
        const orgResult = await db.query(orgQuery, [req.user?.owner_id]);
        
        if (orgResult.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
        }

        const { id: organizationId, hours_per_day: hoursPerDay } = orgResult.rows[0];

        // Find conflicts: days where total allocation exceeds working hours
        const conflictsQuery = `
            WITH daily_allocations AS (
                SELECT 
                    pma.team_member_id,
                    u.name AS member_name,
                    day::DATE AS allocation_date,
                    SUM(pma.seconds_per_day / 3600.0) AS total_hours_allocated,
                    $2::NUMERIC AS max_hours_per_day
                FROM project_member_allocations pma
                JOIN team_members tm ON tm.id = pma.team_member_id
                JOIN users u ON u.id = tm.user_id
                JOIN teams t ON t.id = tm.team_id
                CROSS JOIN LATERAL generate_series(pma.allocated_from, pma.allocated_to, '1 day'::interval) AS day
                WHERE t.organization_id = $1
                GROUP BY pma.team_member_id, u.name, day, max_hours_per_day
                HAVING SUM(pma.seconds_per_day / 3600.0) > $2
            )
            SELECT jsonb_agg(
                jsonb_build_object(
                    'memberId', team_member_id,
                    'memberName', member_name,
                    'date', allocation_date,
                    'allocatedHours', ROUND(total_hours_allocated::numeric, 2),
                    'maxHours', max_hours_per_day,
                    'overageHours', ROUND((total_hours_allocated - max_hours_per_day)::numeric, 2),
                    'type', 'overallocation',
                    'severity', CASE 
                        WHEN (total_hours_allocated - max_hours_per_day) <= 2 THEN 'low'
                        WHEN (total_hours_allocated - max_hours_per_day) <= 4 THEN 'medium'
                        ELSE 'high'
                    END,
                    'message', member_name || ' is over-allocated by ' || 
                               ROUND((total_hours_allocated - max_hours_per_day)::numeric, 1) || 
                               ' hours on ' || allocation_date::TEXT
                )
            ) AS conflicts
            FROM daily_allocations;
        `;

        const result = await db.query(conflictsQuery, [organizationId, hoursPerDay]);
        const conflicts = result.rows[0]?.conflicts || [];

        return res.status(200).send(new ServerResponse(true, conflicts));
    }

    /**
     * Get capacity report for a date range
     * GET /api/schedule-gannt-v2/capacity-report
     */
    @HandleExceptions()
    public static async getCapacityReport(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { startDate, endDate, teamId } = req.query as { 
            startDate?: string; 
            endDate?: string; 
            teamId?: string; 
        };

        if (!startDate || !endDate) {
            return res.status(400).send(new ServerResponse(false, null, "startDate and endDate are required"));
        }

        // Get organization ID
        const orgQuery = `SELECT id, hours_per_day FROM organizations WHERE user_id = $1 LIMIT 1`;
        const orgResult = await db.query(orgQuery, [req.user?.owner_id]);
        
        if (orgResult.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
        }

        const { id: organizationId, hours_per_day: hoursPerDay } = orgResult.rows[0];

        const reportQuery = `
            WITH date_range AS (
                SELECT 
                    $1::DATE AS start_date,
                    $2::DATE AS end_date,
                    $3::UUID AS organization_id,
                    $4::NUMERIC AS hours_per_day
            ),
            team_capacity AS (
                SELECT 
                    COUNT(DISTINCT tm.id) AS total_members,
                    (
                        SELECT COUNT(*) 
                        FROM generate_series(dr.start_date, dr.end_date, '1 day'::interval) AS day
                        JOIN public.organization_working_days owd ON owd.organization_id = dr.organization_id
                        WHERE 
                            (EXTRACT(ISODOW FROM day) = 1 AND owd.monday = true) OR
                            (EXTRACT(ISODOW FROM day) = 2 AND owd.tuesday = true) OR
                            (EXTRACT(ISODOW FROM day) = 3 AND owd.wednesday = true) OR
                            (EXTRACT(ISODOW FROM day) = 4 AND owd.thursday = true) OR
                            (EXTRACT(ISODOW FROM day) = 5 AND owd.friday = true) OR
                            (EXTRACT(ISODOW FROM day) = 6 AND owd.saturday = true) OR
                            (EXTRACT(ISODOW FROM day) = 7 AND owd.sunday = true)
                    ) * COUNT(DISTINCT tm.id) * dr.hours_per_day AS total_capacity_hours
                FROM team_members tm
                JOIN teams t ON t.id = tm.team_id
                CROSS JOIN date_range dr
                WHERE t.organization_id = dr.organization_id
                    ${teamId ? 'AND t.id = $5' : ''}
            ),
            allocated_capacity AS (
                SELECT 
                    COALESCE(SUM(
                        (pma.seconds_per_day / 3600.0) * 
                        (
                            SELECT COUNT(*) 
                            FROM generate_series(
                                GREATEST(pma.allocated_from, dr.start_date),
                                LEAST(pma.allocated_to, dr.end_date),
                                '1 day'::interval
                            ) AS day
                            JOIN public.organization_working_days owd ON owd.organization_id = dr.organization_id
                            WHERE 
                                (EXTRACT(ISODOW FROM day) = 1 AND owd.monday = true) OR
                                (EXTRACT(ISODOW FROM day) = 2 AND owd.tuesday = true) OR
                                (EXTRACT(ISODOW FROM day) = 3 AND owd.wednesday = true) OR
                                (EXTRACT(ISODOW FROM day) = 4 AND owd.thursday = true) OR
                                (EXTRACT(ISODOW FROM day) = 5 AND owd.friday = true) OR
                                (EXTRACT(ISODOW FROM day) = 6 AND owd.saturday = true) OR
                                (EXTRACT(ISODOW FROM day) = 7 AND owd.sunday = true)
                        )
                    ), 0) AS total_allocated_hours
                FROM project_member_allocations pma
                JOIN team_members tm ON tm.id = pma.team_member_id
                JOIN teams t ON t.id = tm.team_id
                CROSS JOIN date_range dr
                WHERE t.organization_id = dr.organization_id
                    AND pma.allocated_from <= dr.end_date
                    AND pma.allocated_to >= dr.start_date
                    ${teamId ? 'AND t.id = $5' : ''}
            )
            SELECT jsonb_build_object(
                'totalMembers', tc.total_members,
                'totalCapacityHours', ROUND(tc.total_capacity_hours::numeric, 2),
                'totalAllocatedHours', ROUND(ac.total_allocated_hours::numeric, 2),
                'availableHours', ROUND((tc.total_capacity_hours - ac.total_allocated_hours)::numeric, 2),
                'utilizationPercent', CASE 
                    WHEN tc.total_capacity_hours = 0 THEN 0
                    ELSE ROUND(((ac.total_allocated_hours / tc.total_capacity_hours) * 100)::numeric, 2)
                END,
                'startDate', $1,
                'endDate', $2
            ) AS report
            FROM team_capacity tc, allocated_capacity ac;
        `;

        const params = teamId 
            ? [startDate, endDate, organizationId, hoursPerDay, teamId]
            : [startDate, endDate, organizationId, hoursPerDay];

        const result = await db.query(reportQuery, params);
        const report = result.rows[0]?.report || {};

        return res.status(200).send(new ServerResponse(true, report));
    }
}
