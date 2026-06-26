import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import moment from "moment";
import WorklenzControllerBase from "../worklenz-controller-base";

export default class ScheduleControllerV2 extends WorklenzControllerBase {

    @HandleExceptions()
    public static async getSettings(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        // get organization working days
        const getDataq = `SELECT organization_id, array_agg(initcap(day)) AS working_days
                        FROM (
                            SELECT organization_id, 
                                  unnest(ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) AS day,
                                  unnest(ARRAY[monday, tuesday, wednesday, thursday, friday, saturday, sunday]) AS is_working
                            FROM public.organization_working_days
                            WHERE organization_id IN (
                                SELECT id FROM organizations 
                                WHERE user_id = $1
                            )
                        ) t
                        WHERE t.is_working
                        GROUP BY organization_id LIMIT 1;`;

        const workingDaysResults = await db.query(getDataq, [req.user?.owner_id]);
        const [workingDays] = workingDaysResults.rows;

        // get organization working hours
        const getDataHoursq = `SELECT hours_per_day FROM organizations WHERE user_id = $1 GROUP BY id LIMIT 1;`;

        const workingHoursResults = await db.query(getDataHoursq, [req.user?.owner_id]);

        const [workingHours] = workingHoursResults.rows;

        return res.status(200).send(new ServerResponse(true, { workingDays: workingDays?.working_days, workingHours: workingHours?.hours_per_day }));
    }

    @HandleExceptions()
    public static async updateSettings(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        try {
            const { workingDays, workingHours } = req.body;

            // Validate input parameters
            if (!workingDays || !Array.isArray(workingDays)) {
                return res.status(400).send(new ServerResponse(false, null, "workingDays must be an array"));
            }

            if (workingHours === undefined || workingHours === null || isNaN(Number(workingHours))) {
                return res.status(400).send(new ServerResponse(false, null, "workingHours must be a valid number"));
            }

            // Validate working hours range (reasonable limits)
            const hours = Number(workingHours);
            if (hours < 1 || hours > 24) {
                return res.status(400).send(new ServerResponse(false, null, "workingHours must be between 1 and 24"));
            }

            // Days of the week
            const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

            // Validate working days
            const invalidDays = workingDays.filter(day => !days.includes(day));
            if (invalidDays.length > 0) {
                return res.status(400).send(new ServerResponse(false, null, `Invalid working days: ${invalidDays.join(', ')}`));
            }

            // Generate the SET clause dynamically for UPDATE
            const setClause = days
                .map(day => `${day.toLowerCase()} = ${workingDays.includes(day)}`)
                .join(", ");

            // Generate VALUES clause for INSERT
            const valuesClause = days
                .map(day => workingDays.includes(day))
                .join(", ");

            // Use UPSERT (INSERT ... ON CONFLICT) to handle both insert and update cases
            const upsertWorkingDaysQuery = `
                INSERT INTO public.organization_working_days (
                    organization_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, created_at, updated_at
                )
                SELECT 
                    org.id, ${valuesClause}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                FROM organizations org
                WHERE org.user_id = $1
                ON CONFLICT (organization_id) 
                DO UPDATE SET 
                    ${setClause}, 
                    updated_at = CURRENT_TIMESTAMP;`;

            await db.query(upsertWorkingDaysQuery, [req.user?.owner_id]);

            // Update working hours
            const updateWorkingHoursQuery = `UPDATE organizations SET hours_per_day = $1 WHERE user_id = $2;`;
            await db.query(updateWorkingHoursQuery, [hours, req.user?.owner_id]);

            return res.status(200).send(new ServerResponse(true, {
                workingDays,
                workingHours: hours
            }, "Settings updated successfully"));

        } catch (error: any) {
            console.error('Error updating schedule settings:', error);
            
            // Handle specific database errors
            if (error.code === '23503') { // Foreign key violation
                return res.status(400).send(new ServerResponse(false, null, "Invalid organization or user reference"));
            } else if (error.code === '23505') { // Unique violation
                return res.status(400).send(new ServerResponse(false, null, "Duplicate entry detected"));
            } else if (error.code === '42P01') { // Table doesn't exist
                return res.status(500).send(new ServerResponse(false, null, "Database configuration error"));
            }

            // Generic error response
            return res.status(500).send(new ServerResponse(false, null, "Failed to update settings. Please try again."));
        }
    }

    @HandleExceptions()
    public static async getDates(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

        let { date, type } = req.params;
        
        // Handle date parameter - extract YYYY-MM-DD format to avoid timezone issues
        // If date comes as ISO string (e.g., '2025-12-31T18:30:00.000Z'), extract just the date part
        if (date.includes('T')) {
            // For ISO strings, use moment to parse and format in local timezone
            date = moment(date).format('YYYY-MM-DD');
        }

        if (type === "week") {
            const getDataq = `WITH input_date AS (
                            SELECT 
                                $1::DATE AS given_date,  
                                (SELECT id FROM organizations WHERE user_id=$2 LIMIT 1) AS organization_id 
                        ),
                        week_range AS (
                            SELECT 
                                (given_date - (EXTRACT(DOW FROM given_date)::INT + 6) % 7)::DATE AS start_date,  -- Current week start date
                                (given_date - (EXTRACT(DOW FROM given_date)::INT + 6) % 7 + 6)::DATE AS end_date, -- Current week end date
                                (given_date - (EXTRACT(DOW FROM given_date)::INT + 6) % 7 + 7)::DATE AS next_week_start, -- Next week start date
                                (given_date - (EXTRACT(DOW FROM given_date)::INT + 6) % 7 + 13)::DATE AS next_week_end, -- Next week end date
                                (given_date - (EXTRACT(DOW FROM given_date)::INT + 6) % 7)::DATE AS chart_start,  -- First week start date
                                (given_date - (EXTRACT(DOW FROM given_date)::INT + 6) % 7 + 13)::DATE AS chart_end,  -- Second week end date
                                CURRENT_DATE::DATE AS today,
                                organization_id
                            FROM input_date
                        ),
                        org_working_days AS (
                            SELECT 
                                organization_id,
                                monday, tuesday, wednesday, thursday, friday, saturday, sunday
                            FROM organization_working_days
                            WHERE organization_id = (SELECT organization_id FROM week_range)
                        ),
                        days AS (
                            SELECT 
                                generate_series((SELECT start_date FROM week_range), (SELECT next_week_end FROM week_range), '1 day'::INTERVAL)::DATE AS date
                        ),
                        formatted_days AS (
                            SELECT 
                                d.date,
                                TO_CHAR(d.date, 'Dy') AS day_name,
                                EXTRACT(DAY FROM d.date) AS day,
                                TO_CHAR(d.date, 'Mon YYYY') AS month,  -- Each day has its correct month
                                CASE 
                                    WHEN EXTRACT(DOW FROM d.date) = 0 THEN (SELECT sunday FROM org_working_days)
                                    WHEN EXTRACT(DOW FROM d.date) = 1 THEN (SELECT monday FROM org_working_days)
                                    WHEN EXTRACT(DOW FROM d.date) = 2 THEN (SELECT tuesday FROM org_working_days)
                                    WHEN EXTRACT(DOW FROM d.date) = 3 THEN (SELECT wednesday FROM org_working_days)
                                    WHEN EXTRACT(DOW FROM d.date) = 4 THEN (SELECT thursday FROM org_working_days)
                                    WHEN EXTRACT(DOW FROM d.date) = 5 THEN (SELECT friday FROM org_working_days)
                                    WHEN EXTRACT(DOW FROM d.date) = 6 THEN (SELECT saturday FROM org_working_days)
                                END AS is_weekend,
                                CASE WHEN d.date = (SELECT today FROM week_range) THEN TRUE ELSE FALSE END AS is_today
                            FROM days d
                        ),
                        grouped_by_month AS (
                            SELECT 
                                month AS month_name,
                                jsonb_agg(
                                    jsonb_build_object(
                                        'day', day,
                                        'name', day_name,
                                        'isWeekend', NOT is_weekend,
                                        'isToday', is_today
                                    ) ORDER BY date
                                ) AS days
                            FROM formatted_days
                            GROUP BY month
                            ORDER BY MIN(date)  -- Order months by their first date
                        )
                        SELECT jsonb_build_object(
                            'date_data', jsonb_agg(
                                jsonb_build_object(
                                    'month', month_name,
                                    'weeks', '[]'::JSONB,
                                    'days', days
                                ) ORDER BY month_name
                            ),
                            'chart_start', (SELECT chart_start FROM week_range),
                            'chart_end', (SELECT chart_end FROM week_range)
                        ) AS result_json
                        FROM grouped_by_month;`;

            const results = await db.query(getDataq, [date, req.user?.owner_id]);
            const [data] = results.rows;
            return res.status(200).send(new ServerResponse(true, data.result_json));
        } else if (type === "month") {

            const getDataq = `WITH params AS (
                            SELECT 
                                DATE_TRUNC('month', $1::DATE)::DATE AS start_date,  -- First day of the month
                                (DATE_TRUNC('month', $1::DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE AS end_date,  -- Last day of the month
                                CURRENT_DATE::DATE AS today,
                                (SELECT id FROM organizations WHERE user_id = $2 LIMIT 1) AS org_id
                        ),
                        days AS (
                            SELECT 
                                generate_series(
                                    (SELECT start_date FROM params), 
                                    (SELECT end_date FROM params), 
                                    '1 day'::INTERVAL
                                )::DATE AS date
                        ),
                        org_working_days AS (
                            SELECT 
                                monday, tuesday, wednesday, thursday, friday, saturday, sunday
                            FROM organization_working_days
                            WHERE organization_id = (SELECT org_id FROM params)
                            LIMIT 1
                        ),
                        formatted_days AS (
                            SELECT 
                                d.date,
                                TO_CHAR(d.date, 'Dy') AS day_name,
                                EXTRACT(DAY FROM d.date) AS day,
                                -- Dynamically check if the day is a weekend based on the organization's settings
                                CASE 
                                    WHEN EXTRACT(DOW FROM d.date) = 0 THEN NOT (SELECT sunday FROM org_working_days)
                                    WHEN EXTRACT(DOW FROM d.date) = 1 THEN NOT (SELECT monday FROM org_working_days)
                                    WHEN EXTRACT(DOW FROM d.date) = 2 THEN NOT (SELECT tuesday FROM org_working_days)
                                    WHEN EXTRACT(DOW FROM d.date) = 3 THEN NOT (SELECT wednesday FROM org_working_days)
                                    WHEN EXTRACT(DOW FROM d.date) = 4 THEN NOT (SELECT thursday FROM org_working_days)
                                    WHEN EXTRACT(DOW FROM d.date) = 5 THEN NOT (SELECT friday FROM org_working_days)
                                    WHEN EXTRACT(DOW FROM d.date) = 6 THEN NOT (SELECT saturday FROM org_working_days)
                                END AS is_weekend,
                                CASE WHEN d.date = (SELECT today FROM params) THEN TRUE ELSE FALSE END AS is_today
                            FROM days d
                        ),
                        grouped_by_month AS (
                            SELECT 
                                TO_CHAR(date, 'Mon YYYY') AS month_name,
                                jsonb_agg(
                                    jsonb_build_object(
                                        'day', day,
                                        'name', day_name,
                                        'isWeekend', is_weekend,
                                        'isToday', is_today
                                    ) ORDER BY date
                                ) AS days
                            FROM formatted_days
                            GROUP BY month_name
                        )
                        SELECT jsonb_build_object(
                            'date_data', jsonb_agg(
                                jsonb_build_object(
                                    'month', month_name,
                                    'weeks', '[]'::JSONB,  -- Placeholder for weeks data
                                    'days', days
                                ) ORDER BY month_name
                            ),
                            'chart_start', (SELECT start_date FROM params),
                            'chart_end', (SELECT end_date FROM params)
                        ) AS result_json
                        FROM grouped_by_month;`;

            const results = await db.query(getDataq, [date, req.user?.owner_id]);
            const [data] = results.rows;
            return res.status(200).send(new ServerResponse(true, data.result_json));

        }

        return res.status(200).send(new ServerResponse(true, []));
    }

    @HandleExceptions()
    public static async getOrganizationMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

        const getDataq = `
            WITH member_projects AS (
                -- Get all projects for each member with their allocations
                SELECT 
                    pm.team_member_id,
                    jsonb_agg(
                        jsonb_build_object(
                            'id', p.id,
                            'name', p.name,
                            'color_code', p.color_code,
                            'allocated_hours', COALESCE(
                                (
                                    SELECT SUM(pma.seconds_per_day / 3600)
                                    FROM project_member_allocations pma
                                    WHERE pma.team_member_id = pm.team_member_id
                                        AND pma.project_id = p.id
                                        AND pma.allocated_from <= CURRENT_DATE
                                        AND pma.allocated_to >= CURRENT_DATE
                                ), 0
                            )
                        )
                    ) AS projects
                FROM project_members pm
                JOIN projects p ON pm.project_id = p.id
                WHERE p.id NOT IN (SELECT project_id FROM archived_projects)
                GROUP BY pm.team_member_id
            )
            SELECT DISTINCT ON (users.email) 
                team_members.id AS team_member_id,
                users.id AS id, 
                users.name AS name, 
                users.email AS email,
                users.avatar_url AS avatar_url,
                COALESCE(mp.projects, '[]'::JSONB) AS projects
            FROM team_members 
            INNER JOIN users ON users.id = team_members.user_id 
            LEFT JOIN member_projects mp ON mp.team_member_id = team_members.id
            WHERE team_members.team_id = (
                SELECT active_team FROM users WHERE id = $1
            )
            AND team_members.active = TRUE
            ORDER BY users.email ASC, users.name ASC;
        `;

        const results = await db.query(getDataq, [req.user?.id]);
        return res.status(200).send(new ServerResponse(true, results.rows));

    }

    @HandleExceptions()
    public static async getOrganizationMemberProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

        const { id } = req.params; // This is team_member_id from frontend
        const { chartStart, chartEnd } = req.query; // Get chart_start and chart_end from query params

        // If no chartStart provided, return empty projects
        if (!chartStart) {
            return res.status(400).send(new ServerResponse(false, null, "chartStart parameter is required"));
        }

        // Updated query to show ALL projects where member is assigned
        // Timeline bars show as separate segments when there are gaps between tasks
        const getDataq = `
            WITH member_project_list AS (
                -- Get all projects where this member is a project member
                SELECT DISTINCT
                    p.id AS project_id,
                    p.name AS project_name,
                    p.color_code AS project_color,
                    p.start_date::DATE AS project_start_date,
                    p.end_date::DATE AS project_end_date,
                    t.organization_id
                FROM project_members pm
                JOIN projects p ON pm.project_id = p.id
                JOIN teams t ON p.team_id = t.id
                WHERE pm.team_member_id = $1
                    -- Exclude archived projects
                    AND p.id NOT IN (SELECT project_id FROM archived_projects)
            ),
            member_tasks_in_range AS (
                -- Get all individual tasks for this member within the visible range
                SELECT DISTINCT
                    t.project_id,
                    GREATEST(t.start_date, $2::DATE) AS start_date,
                    LEAST(t.end_date, COALESCE($3::DATE, t.end_date)) AS end_date,
                    t.id AS task_id
                FROM tasks t
                JOIN tasks_assignees ta ON t.id = ta.task_id
                JOIN project_members pm ON ta.project_member_id = pm.id
                WHERE pm.team_member_id = $1
                    AND t.start_date IS NOT NULL
                    AND t.end_date IS NOT NULL
                    AND t.archived = false
                    AND t.start_date <= COALESCE($3::DATE, t.start_date)
                    AND t.end_date >= $2::DATE
            ),
            member_allocations_in_range AS (
                -- Get allocations within the visible range
                SELECT DISTINCT
                    pm.project_id,
                    GREATEST(pm.allocated_from, $2::DATE) AS start_date,
                    LEAST(pm.allocated_to, COALESCE($3::DATE, pm.allocated_to)) AS end_date,
                    pm.seconds_per_day / 3600 AS hours_per_day
                FROM public.project_member_allocations pm
                WHERE pm.team_member_id = $1
                    AND pm.allocated_from <= COALESCE($3::DATE, pm.allocated_from)
                    AND pm.allocated_to >= $2::DATE
            ),
            all_date_ranges AS (
                -- Combine tasks and allocations
                SELECT project_id, start_date, end_date, 0 AS hours_per_day
                FROM member_tasks_in_range
                UNION ALL
                SELECT project_id, start_date, end_date, hours_per_day
                FROM member_allocations_in_range
            ),
            -- Find continuous date segments (only merge truly overlapping dates, not adjacent ones)
            ordered_ranges AS (
                SELECT 
                    project_id,
                    start_date,
                    end_date,
                    hours_per_day,
                    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY start_date, end_date) AS rn
                FROM all_date_ranges
            ),
            -- Detect gaps: a new segment starts when there's a gap from the previous end date
            segments_with_gaps AS (
                SELECT 
                    project_id,
                    start_date,
                    end_date,
                    hours_per_day,
                    CASE 
                        WHEN LAG(end_date) OVER (PARTITION BY project_id ORDER BY start_date) IS NULL THEN 1
                        WHEN start_date > LAG(end_date) OVER (PARTITION BY project_id ORDER BY start_date) + INTERVAL '1 day' THEN 1
                        ELSE 0
                    END AS is_new_segment
                FROM ordered_ranges
            ),
            -- Assign segment numbers based on gaps
            segments_numbered AS (
                SELECT 
                    project_id,
                    start_date,
                    end_date,
                    hours_per_day,
                    SUM(is_new_segment) OVER (PARTITION BY project_id ORDER BY start_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS segment_id
                FROM segments_with_gaps
            ),
            -- Merge overlapping/adjacent dates within each segment
            continuous_segments AS (
                SELECT 
                    project_id,
                    segment_id,
                    MIN(start_date) AS segment_start,
                    MAX(end_date) AS segment_end,
                    MAX(hours_per_day) AS hours_per_day
                FROM segments_numbered
                GROUP BY project_id, segment_id
            ),
            segments_with_stats AS (
                SELECT
                    cs.project_id,
                    cs.segment_start,
                    cs.segment_end,
                    cs.hours_per_day,
                    -- Count tasks in this segment
                    (
                        SELECT COUNT(DISTINCT t.id)
                        FROM tasks t
                        JOIN tasks_assignees ta ON t.id = ta.task_id
                        JOIN project_members pm ON ta.project_member_id = pm.id
                        WHERE pm.team_member_id = $1
                            AND t.project_id = cs.project_id
                            AND t.archived = false
                            AND t.start_date IS NOT NULL
                            AND t.end_date IS NOT NULL
                            AND t.start_date <= cs.segment_end
                            AND t.end_date >= cs.segment_start
                    ) AS task_count,
                    -- Calculate total hours for this segment
                    (
                        SELECT COUNT(*) 
                        FROM generate_series(cs.segment_start, cs.segment_end, '1 day'::interval) AS day
                        JOIN public.organization_working_days owd ON owd.organization_id = (
                            SELECT organization_id FROM member_project_list WHERE project_id = cs.project_id LIMIT 1
                        )
                        WHERE 
                            (EXTRACT(ISODOW FROM day) = 1 AND owd.monday = true) OR
                            (EXTRACT(ISODOW FROM day) = 2 AND owd.tuesday = true) OR
                            (EXTRACT(ISODOW FROM day) = 3 AND owd.wednesday = true) OR
                            (EXTRACT(ISODOW FROM day) = 4 AND owd.thursday = true) OR
                            (EXTRACT(ISODOW FROM day) = 5 AND owd.friday = true) OR
                            (EXTRACT(ISODOW FROM day) = 6 AND owd.saturday = true) OR
                            (EXTRACT(ISODOW FROM day) = 7 AND owd.sunday = true)
                    ) * cs.hours_per_day AS total_hours
                FROM continuous_segments cs
            ),
            all_projects_with_segments AS (
                -- Combine all member projects with their segments
                -- If no segments exist (no tasks/allocations), use project-level dates
                SELECT
                    mpl.project_id,
                    mpl.project_name,
                    mpl.project_color,
                    mpl.project_start_date,
                    mpl.project_end_date,
                    COALESCE(sws.segment_start, mpl.project_start_date) AS start_date,
                    COALESCE(sws.segment_end, mpl.project_end_date) AS end_date,
                    COALESCE(sws.hours_per_day, 0) AS hours_per_day,
                    COALESCE(sws.total_hours, 0) AS total_hours,
                    COALESCE(sws.task_count, 0) AS task_count,
                    CASE 
                        WHEN sws.segment_start IS NOT NULL THEN
                            ROW_NUMBER() OVER (PARTITION BY mpl.project_id ORDER BY sws.segment_start)
                        ELSE 1
                    END AS segment_number
                FROM member_project_list mpl
                LEFT JOIN segments_with_stats sws ON mpl.project_id = sws.project_id
            ),
            projects_with_offsets AS (
                SELECT
                    apd.project_name,
                    apd.project_id,
                    apd.project_color,
                    apd.project_start_date,
                    apd.project_end_date,
                    apd.hours_per_day,
                    apd.total_hours,
                    apd.task_count,
                    apd.start_date,
                    apd.end_date,
                    apd.segment_number,
                    -- Calculate offset from the chart_start date
                    CASE 
                        WHEN apd.start_date IS NOT NULL THEN
                            (DATE_PART('day', apd.start_date - $2::DATE)) * 75
                        ELSE NULL
                    END AS indicator_offset,
                    CASE 
                        WHEN apd.start_date IS NOT NULL AND apd.end_date IS NOT NULL THEN
                            (DATE_PART('day', apd.end_date - apd.start_date) + 1) * 75
                        ELSE NULL
                    END AS indicator_width,
                    75 AS min_width
                FROM all_projects_with_segments apd
                ORDER BY 
                    apd.project_name,
                    apd.segment_number
            )
            SELECT jsonb_agg(jsonb_build_object(
                'name', project_name,
                'id', project_id,
                'color_code', project_color,
                'hours_per_day', hours_per_day,
                'total_hours', total_hours,
                'task_count', task_count,
                'segment_number', segment_number,
                'date_union', jsonb_build_object(
                    'start', start_date::DATE,
                    'end', end_date::DATE
                ),
                'project_dates', jsonb_build_object(
                    'start', project_start_date::DATE,
                    'end', project_end_date::DATE
                ),
                'indicator_offset', indicator_offset,
                'indicator_width', indicator_width,
                'tasks', '[]'::jsonb,
                'default_values', jsonb_build_object(
                    'allocated_from', start_date::DATE,
                    'allocated_to', end_date::DATE,
                    'seconds_per_day', hours_per_day,
                    'total_seconds', total_hours
                )
            )) AS projects
            FROM projects_with_offsets;
        `;

        const results = await db.query(getDataq, [id, chartStart, chartEnd || null]);
        
        const [data] = results.rows;
        
        return res.status(200).send(new ServerResponse(true, { projects: data?.projects || [], id }));

    }

    @HandleExceptions()
    public static async createSchedule(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

        const { allocated_from, allocated_to, project_id, team_member_id, seconds_per_day } = req.body;

        const fromFormat = moment(allocated_from).format("YYYY-MM-DD");
        const toFormat = moment(allocated_to).format("YYYY-MM-DD");

        const getDataq1 = `
                            SELECT id 
                            FROM project_member_allocations 
                            WHERE project_id = $1 
                            AND team_member_id = $2 
                            AND (
                                -- Case 1: The given range starts inside an existing range
                                ($3 BETWEEN allocated_from AND allocated_to) 
                                OR 
                                -- Case 2: The given range ends inside an existing range
                                ($4 BETWEEN allocated_from AND allocated_to) 
                                OR 
                                -- Case 3: The given range fully covers an existing range
                                (allocated_from BETWEEN $3 AND $4 AND allocated_to BETWEEN $3 AND $4)
                                OR 
                                -- Case 4: The existing range fully covers the given range
                                (allocated_from <= $3 AND allocated_to >= $4)
                            );`;

        const results1 = await db.query(getDataq1, [project_id, team_member_id, fromFormat, toFormat]);

        const [data] = results1.rows;
        if (data) {
            return res.status(200).send(new ServerResponse(false, null, "Allocation already exists!"));
        }

        const getDataq = `INSERT INTO public.project_member_allocations(
                        project_id, team_member_id, allocated_from, allocated_to, seconds_per_day)
                        VALUES ($1, $2, $3, $4, $5);`;

        const results = await db.query(getDataq, [project_id, team_member_id, allocated_from, allocated_to, Number(seconds_per_day) * 60 * 60]);
        return res.status(200).send(new ServerResponse(true, null, "Allocated successfully!"));

    }

    @HandleExceptions()
    public static async getMemberScheduleSummary(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
        const { memberId } = req.params;
        const { startDate, endDate, projectId } = req.query as { startDate?: string; endDate?: string; projectId?: string };

        // Validate required parameters
        if (!memberId || !startDate || !endDate) {
            return res.status(400).send(new ServerResponse(false, null, "memberId, startDate, and endDate are required"));
        }

        // Get organization ID
        const orgQuery = `SELECT id FROM organizations WHERE user_id = $1 LIMIT 1`;
        const orgResult = await db.query(orgQuery, [req.user?.owner_id]);
        
        if (orgResult.rows.length === 0) {
            return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
        }

        const organizationId = orgResult.rows[0].id;

        // Build query parameters
        const queryParams: any[] = [startDate, endDate, memberId, organizationId];
        let projectFilter = '';
        
        if (projectId) {
            queryParams.push(projectId);
            projectFilter = 'AND t.project_id = $5';
        }

        // Main query to get allocated and logged hours
        const summaryQuery = `
            WITH date_range AS (
                SELECT 
                    $1::DATE AS start_date,
                    $2::DATE AS end_date,
                    $3::UUID AS team_member_id,
                    $4::UUID AS organization_id
            ),
            -- Get allocated hours from task estimations (total_minutes)
            allocated_hours AS (
                SELECT 
                    COALESCE(SUM(t.total_minutes / 60.0), 0) AS total_allocated
                FROM date_range dr
                LEFT JOIN tasks t ON t.archived = FALSE
                    AND t.start_date IS NOT NULL
                    AND t.end_date IS NOT NULL
                    AND t.start_date <= dr.end_date
                    AND t.end_date >= dr.start_date
                    ${projectFilter}
                LEFT JOIN tasks_assignees ta ON ta.task_id = t.id
                WHERE ta.team_member_id = dr.team_member_id
            ),
            -- Get logged hours from work logs for tasks scheduled within date range
            logged_hours AS (
                SELECT 
                    COALESCE(SUM(twl.time_spent), 0) AS total_logged_seconds,
                    COALESCE(SUM(CASE WHEN t.billable = true THEN twl.time_spent ELSE 0 END), 0) AS logged_billable_seconds,
                    COALESCE(SUM(CASE WHEN t.billable = false OR t.billable IS NULL THEN twl.time_spent ELSE 0 END), 0) AS logged_non_billable_seconds
                FROM date_range dr
                JOIN team_members tm ON tm.id = dr.team_member_id
                LEFT JOIN tasks t ON t.archived = FALSE
                    AND t.start_date IS NOT NULL
                    AND t.end_date IS NOT NULL
                    AND t.start_date <= dr.end_date
                    AND t.end_date >= dr.start_date
                    ${projectFilter}
                LEFT JOIN tasks_assignees ta ON ta.task_id = t.id
                    AND ta.team_member_id = dr.team_member_id
                LEFT JOIN task_work_log twl ON twl.task_id = t.id
                    AND twl.user_id = tm.user_id
                LEFT JOIN projects p ON p.id = t.project_id
                LEFT JOIN teams te ON te.id = p.team_id
                WHERE te.organization_id = dr.organization_id OR t.id IS NULL
            )
            SELECT 
                ah.total_allocated AS allocated_hours,
                lh.total_logged_seconds,
                lh.logged_billable_seconds,
                lh.logged_non_billable_seconds
            FROM allocated_hours ah, logged_hours lh;
        `;

        const result = await db.query(summaryQuery, queryParams);
        
        const summary = result.rows[0] || {
            allocated_hours: 0,
            total_logged_seconds: 0,
            logged_billable_seconds: 0,
            logged_non_billable_seconds: 0
        };

        // Helper function to convert seconds to hours with 2 decimal places
        const convertSecondsToHours = (seconds: number): number => {
            return parseFloat((seconds / 3600).toFixed(2));
        };

        // Helper function to safely convert to number with 2 decimal places
        const safeToFixed = (value: any): number => {
            const num = parseFloat(value) || 0;
            return parseFloat(num.toFixed(2));
        };

        // Return formatted response
        return res.status(200).send(new ServerResponse(true, {
            startDate,
            endDate,
            allocatedHours: safeToFixed(summary.allocated_hours),
            totalLogged: convertSecondsToHours(summary.total_logged_seconds),
            loggedBillable: convertSecondsToHours(summary.logged_billable_seconds),
            loggedNonBillable: convertSecondsToHours(summary.logged_non_billable_seconds)
        }));
    }
}
