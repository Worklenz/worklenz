import db from "../config/db";
import { log_error } from "../shared/utils";

interface IProjectActivityParams {
    teamId: string;
    projectId: string;
    userId: string;
    i18nKey: string;
    projectName?: string;
}

export class ActivityLoggingService {

    /**
     * Log that a project was created
     */
    public static async logProjectCreated(
        teamId: string,
        projectId: string,
        userId: string,
        projectName: string
    ): Promise<void> {
        try {
            const q = `INSERT INTO project_logs (team_id, project_id, user_id, description, log_type)
                 VALUES ($1, $2, $3, $4, 'project_created')
                 ON CONFLICT DO NOTHING`;
            await db.query(q, [teamId, projectId, userId, `Project "${projectName}" created`]);
        } catch (e) {
            log_error(e);
        }
    }

    /**
     * Log that a project was updated
     */
    public static async logProjectUpdated(
        teamId: string,
        projectId: string,
        userId: string,
        projectName: string
    ): Promise<void> {
        try {
            const q = `INSERT INTO project_logs (team_id, project_id, user_id, description, log_type)
                 VALUES ($1, $2, $3, $4, 'project_updated')
                 ON CONFLICT DO NOTHING`;
            await db.query(q, [teamId, projectId, userId, `Project "${projectName}" updated`]);
        } catch (e) {
            log_error(e);
        }
    }

    /**
     * Log that a project was deleted
     */
    public static async logProjectDeleted(
        teamId: string,
        projectId: string,
        userId: string,
        projectName: string
    ): Promise<void> {
        try {
            const q = `INSERT INTO project_logs (team_id, project_id, user_id, description, log_type)
                 VALUES ($1, $2, $3, $4, 'project_deleted')
                 ON CONFLICT DO NOTHING`;
            await db.query(q, [teamId, projectId, userId, `Project "${projectName}" deleted`]);
        } catch (e) {
            log_error(e);
        }
    }

    /**
     * Log that a project was archived
     */
    public static async logProjectArchived(
        teamId: string,
        projectId: string,
        userId: string,
        projectName: string
    ): Promise<void> {
        try {
            const q = `INSERT INTO project_logs (team_id, project_id, user_id, description, log_type)
                 VALUES ($1, $2, $3, $4, 'project_archived')
                 ON CONFLICT DO NOTHING`;
            await db.query(q, [teamId, projectId, userId, `Project "${projectName}" archived`]);
        } catch (e) {
            log_error(e);
        }
    }

    /**
     * Log a generic project activity using an i18n key
     */
    public static async logProjectActivity(params: IProjectActivityParams): Promise<void> {
        try {
            const q = `INSERT INTO project_logs (team_id, project_id, user_id, description, log_type)
                 VALUES ($1, $2, $3, $4, 'project_activity')
                 ON CONFLICT DO NOTHING`;
            const description = params.projectName
                ? `${params.i18nKey}: ${params.projectName}`
                : params.i18nKey;
            await db.query(q, [params.teamId, params.projectId, params.userId, description]);
        } catch (e) {
            log_error(e);
        }
    }
}
