import db from "../../config/db";
import { ParsedQs } from "qs";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { TASK_PRIORITY_COLOR_ALPHA, TASK_STATUS_COLOR_ALPHA, UNMAPPED } from "../../shared/constants";
import { getColor } from "../../shared/utils";
import moment, { Moment } from "moment";
import momentTime from "moment-timezone";
import WorklenzControllerBase from "../worklenz-controller-base";

interface IDateUnions {
    date_union: {
        start_date: string | null;
        end_date: string | null;
    },
    logs_date_union: {
        start_date: string | null;
        end_date: string | null;
    },
    allocated_date_union: {
        start_date: string | null;
        end_date: string | null;
    }
}

interface IDatesPair {
    start_date: string | null,
    end_date: string | null
}

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
        const { workingDays, workingHours } = req.body;

        // Days of the week
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

        // Generate the SET clause dynamically
        const setClause = days
            .map(day => `${day.toLowerCase()} = ${workingDays.includes(day)}`)
            .join(", ");

        const updateQuery = `UPDATE public.organization_working_days
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE organization_id IN (SELECT id FROM organizations WHERE user_id = $1);`;

        await db.query(updateQuery, [req.user?.owner_id]);

        const getDataHoursq = `UPDATE organizations SET hours_per_day = $1 WHERE user_id = $2;`;

        await db.query(getDataHoursq, [workingHours, req.user?.owner_id]);

        return res.status(200).send(new ServerResponse(true, {}));
    }

    @HandleExceptions()
    public static async getDates(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

        const { date, type } = req.params;

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
                                TO_CHAR(given_date, 'Mon YYYY') AS month_year,  -- Format the month as 'Jan 2025'
                                EXTRACT(DAY FROM given_date) AS day_number,      -- Extract the day from the date
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
                                TO_CHAR(d.date, 'Mon YYYY') AS month,  -- Format the month as 'Jan 2025'
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
                        aggregated_days AS (
                            SELECT 
                                jsonb_agg(
                                    jsonb_build_object(
                                        'day', day,
                                        'month', month,  -- Include formatted month
                                        'name', day_name,
                                        'isWeekend', NOT is_weekend,
                                        'isToday', is_today
                                    ) ORDER BY date
                                ) AS days_json
                            FROM formatted_days
                        )
                        SELECT jsonb_build_object(
                            'date_data', jsonb_agg(
                                jsonb_build_object(
                                    'month', (SELECT month_year FROM week_range),  -- Formatted month-year (e.g., Jan 2025)
                                    'day', (SELECT day_number FROM week_range),    -- Dynamic day number
                                    'weeks', '[]',  -- Empty weeks array for now
                                    'days', (SELECT days_json FROM aggregated_days)  -- Aggregated days data
                                )
                            ),
                            'chart_start', (SELECT chart_start FROM week_range),  -- First week start date
                            'chart_end', (SELECT chart_end FROM week_range)  -- Second week end date
                        ) AS result_json;`;

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

        const getDataq = `SELECT DISTINCT ON (users.email) 
                            team_members.id AS team_member_id,
                            users.id AS id, 
                            users.name AS name, 
                            users.email AS email, 
                            '[]'::JSONB AS projects
                        FROM team_members 
                        INNER JOIN users ON users.id = team_members.user_id 
                        WHERE team_members.team_id IN (
                            SELECT id FROM teams 
                            WHERE organization_id IN (
                                SELECT id FROM organizations 
                                WHERE user_id = $1 
                                LIMIT 1
                            )
                        )
                        ORDER BY users.email ASC, users.name ASC;`;

        const results = await db.query(getDataq, [req.user?.owner_id]);
        return res.status(200).send(new ServerResponse(true, results.rows));

    }

    @HandleExceptions()
    public static async getOrganizationMemberProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

        const { id } = req.params;

        const getDataq = `WITH project_dates AS (
                            SELECT
                                pm.project_id,
                                MIN(pm.allocated_from) AS start_date,
                                MAX(pm.allocated_to) AS end_date,
                                MAX(pm.seconds_per_day) / 3600 AS hours_per_day, -- Convert max seconds per day to hours per day
                                (
                                    -- Calculate total working days between start and end dates
                                    SELECT COUNT(*) 
                                    FROM generate_series(MIN(pm.allocated_from), MAX(pm.allocated_to), '1 day'::interval) AS day
                                    JOIN public.organization_working_days owd ON owd.organization_id = t.organization_id
                                    WHERE 
                                        (EXTRACT(ISODOW FROM day) = 1 AND owd.monday = true) OR
                                        (EXTRACT(ISODOW FROM day) = 2 AND owd.tuesday = true) OR
                                        (EXTRACT(ISODOW FROM day) = 3 AND owd.wednesday = true) OR
                                        (EXTRACT(ISODOW FROM day) = 4 AND owd.thursday = true) OR
                                        (EXTRACT(ISODOW FROM day) = 5 AND owd.friday = true) OR
                                        (EXTRACT(ISODOW FROM day) = 6 AND owd.saturday = true) OR
                                        (EXTRACT(ISODOW FROM day) = 7 AND owd.sunday = true)
                                ) * (MAX(pm.seconds_per_day) / 3600) AS total_hours -- Multiply by hours per day
                            FROM public.project_member_allocations pm
                            JOIN public.projects p ON pm.project_id = p.id
                            JOIN public.teams t ON p.team_id = t.id
                            GROUP BY pm.project_id, t.organization_id
                        ),
                        projects_with_offsets AS (
                            SELECT
                                p.name AS project_name,
                                p.id AS project_id,
                                COALESCE(pd.hours_per_day, 0) AS hours_per_day, -- Default to 8 if not available in project_member_allocations
                                COALESCE(pd.total_hours, 0) AS total_hours,    -- Calculated total hours based on working days
                                pd.start_date,
                                pd.end_date,
                                p.team_id,
                                tm.user_id,
                                -- Calculate indicator_offset dynamically: days difference from earliest project start date * 75px
                                COALESCE(
                                    (DATE_PART('day', pd.start_date - MIN(pd.start_date) OVER ())) * 75,
                                    0
                                ) AS indicator_offset,
                                -- Calculate indicator_width as the number of days * 75 pixels per day
                                COALESCE((DATE_PART('day', pd.end_date - pd.start_date) + 1) * 75, 75) AS indicator_width, -- Fallback to 75 if no dates exist
                                75 AS min_width -- 75px minimum width for a 1-day project
                            FROM public.projects p
                            LEFT JOIN project_dates pd ON p.id = pd.project_id
                            JOIN public.team_members tm ON tm.team_id = p.team_id
                            JOIN public.teams t ON p.team_id = t.id
                            WHERE tm.user_id = $2
                            AND tm.team_id = $1
                            ORDER BY pd.start_date, pd.end_date -- Order by start and end date
                        )
                        SELECT jsonb_agg(jsonb_build_object(
                            'name', project_name,
                            'id', project_id,
                            'hours_per_day', hours_per_day,
                            'total_hours', total_hours,
                            'date_union', jsonb_build_object(
                                'start', start_date::DATE,
                                'end', end_date::DATE
                            ),
                            'indicator_offset', indicator_offset,
                            'indicator_width', indicator_width,
                            'tasks', '[]'::jsonb, -- Empty tasks array for now,
                            'default_values', jsonb_build_object(
                                'allocated_from', start_date::DATE,
                                'allocated_to', end_date::DATE,
                                'seconds_per_day', hours_per_day,
                                'total_seconds', total_hours
                            )
                        )) AS projects
                        FROM projects_with_offsets;`;

        const results = await db.query(getDataq, [req.user?.team_id, id]);
        const [data] = results.rows;
        return res.status(200).send(new ServerResponse(true, { projects: data.projects, id }));

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
}
