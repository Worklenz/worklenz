import { CronJob } from "cron";
import { calculateNextEndDate, log_error } from "../shared/utils";
import db from "../config/db";
import { IRecurringSchedule, ITaskTemplate } from "../interfaces/recurring-tasks";
import moment from "moment";
import TasksController from "../controllers/tasks-controller";

// At 11:00+00 (4.30pm+530) on every day-of-month if it's on every day-of-week from Monday through Friday.
// const TIME = "0 11 */1 * 1-5";
const TIME = "*/2 * * * *";
const TIME_FORMAT = "YYYY-MM-DD";
// const TIME = "0 0 * * *"; // Runs at midnight every day

const log = (value: any) => console.log("recurring-task-cron-job:", value);

async function onRecurringTaskJobTick() {
    try {
        log("(cron) Recurring tasks job started.");

        const templatesQuery = `
            SELECT t.*, s.*, (SELECT MAX(end_date) FROM tasks WHERE schedule_id = s.id) as last_task_end_date
            FROM task_recurring_templates t
            JOIN task_recurring_schedules s ON t.schedule_id = s.id;
        `;
        const templatesResult = await db.query(templatesQuery);
        const templates = templatesResult.rows as (ITaskTemplate & IRecurringSchedule)[];

        const now = moment();
        let createdTaskCount = 0;

        for (const template of templates) {
            const lastTaskEndDate = template.last_task_end_date 
                ? moment(template.last_task_end_date)
                : moment(template.created_at);
            
            const futureLimit = moment(template.last_checked_at || template.created_at).add(1, "week");

            let nextEndDate = calculateNextEndDate(template, lastTaskEndDate);

            // Find the next future occurrence
            while (nextEndDate.isSameOrBefore(now)) {
                nextEndDate = calculateNextEndDate(template, nextEndDate);
            }

            // Only create a task if it's within the future limit
            if (nextEndDate.isSameOrBefore(futureLimit)) {
                const existingTaskQuery = `
                    SELECT id FROM tasks 
                    WHERE schedule_id = $1 AND end_date::DATE = $2::DATE;
                `;
                const existingTaskResult = await db.query(existingTaskQuery, [template.schedule_id, nextEndDate.format(TIME_FORMAT)]);

                if (existingTaskResult.rows.length === 0) {
                    const createTaskQuery = `SELECT create_quick_task($1::json) as task;`;
                    const taskData = {
                        name: template.name,
                        priority_id: template.priority_id,
                        project_id: template.project_id,
                        reporter_id: template.reporter_id,
                        status_id: template.status_id || null,
                        end_date: nextEndDate.format(TIME_FORMAT),
                        schedule_id: template.schedule_id
                    };
                    const createTaskResult = await db.query(createTaskQuery, [JSON.stringify(taskData)]);
                    const createdTask = createTaskResult.rows[0].task;

                    if (createdTask) {
                        createdTaskCount++;

                        for (const assignee of template.assignees) {
                            await TasksController.createTaskBulkAssignees(assignee.team_member_id, template.project_id, createdTask.id, assignee.assigned_by); 
                        }
    
                        for (const label of template.labels) {
                            const q = `SELECT add_or_remove_task_label($1, $2) AS labels;`;
                            await db.query(q, [createdTask.id, label.label_id]);
                        }
                        
                        console.log(`Created task for template ${template.name} with end date ${nextEndDate.format(TIME_FORMAT)}`);
                    }
                } else {
                    console.log(`Skipped creating task for template ${template.name} with end date ${nextEndDate.format(TIME_FORMAT)} - task already exists`);
                }
            } else {
                console.log(`No task created for template ${template.name} - next occurrence is beyond the future limit`);
            }

            // Update the last_checked_at in the schedule
            const updateScheduleQuery = `
                UPDATE task_recurring_schedules 
                SET last_checked_at = $1::DATE, last_created_task_end_date = $2 
                WHERE id = $3;
            `;
            await db.query(updateScheduleQuery, [moment(template.last_checked_at || template.created_at).add(1, "day").format(TIME_FORMAT), nextEndDate.format(TIME_FORMAT), template.schedule_id]);
        }
        
        log(`(cron) Recurring tasks job ended with ${createdTaskCount} new tasks created.`);
    } catch (error) {
        log_error(error);
        log("(cron) Recurring task job ended with errors.");
    }
}

export function startRecurringTasksJob() {
    log("(cron) Recurring task job ready.");
    const job = new CronJob(
        TIME,
        () => void onRecurringTaskJobTick(),
        () => log("(cron) Recurring task job successfully executed."),
        true
    );
    job.start();
}