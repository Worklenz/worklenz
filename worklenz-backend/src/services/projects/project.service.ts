import database from "../../config/db";

export class ProjectService {

    public static async getProjectsByTeam(team_id: string|undefined, user_id: string|undefined) {
        const query = `
          SELECT id, name, color_code
          FROM projects
          WHERE team_id = $1
            AND is_member_of_project(projects.id, $2, $1)
        `;
        return await database.query(query, [team_id, user_id]);
    }

    public static async getProjects(team_id: string|undefined, user_id: string|undefined, current_view: string, filter: string) {

        const isFavorites = current_view === "1" ? ` AND EXISTS(SELECT user_id FROM favorite_projects WHERE user_id = $2 AND project_id = projects.id)` : "";

        const isArchived = filter === "2"
            ? ` AND EXISTS(SELECT user_id FROM archived_projects WHERE user_id = $2 AND project_id = projects.id)`
            : ` AND NOT EXISTS(SELECT user_id FROM archived_projects WHERE user_id = $2 AND project_id = projects.id)`;

        const query = `SELECT id,
                          name,
                          EXISTS(SELECT user_id
                                 FROM favorite_projects
                                 WHERE user_id = $2
                                   AND project_id = projects.id) AS favorite,
                          EXISTS(SELECT user_id
                                 FROM archived_projects
                                 WHERE user_id = $2
                                   AND project_id = projects.id) AS archived,
                          color_code,
                          (SELECT COUNT(*)
                           FROM tasks
                           WHERE archived IS FALSE
                             AND project_id = projects.id) AS all_tasks_count,
                          (SELECT COUNT(*)
                           FROM tasks
                           WHERE archived IS FALSE
                             AND project_id = projects.id
                             AND status_id IN (SELECT id
                                               FROM task_statuses
                                               WHERE project_id = projects.id
                                                 AND category_id IN
                                                     (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE))) AS completed_tasks_count,
                          (SELECT COUNT(*)
                           FROM project_members
                           WHERE project_id = projects.id) AS members_count,
                          (SELECT get_project_members(projects.id)) AS names,
                          (SELECT CASE
                                    WHEN ((SELECT MAX(updated_at)
                                           FROM tasks
                                           WHERE archived IS FALSE
                                             AND project_id = projects.id) >
                                          updated_at)
                                      THEN (SELECT MAX(updated_at)
                                            FROM tasks
                                            WHERE archived IS FALSE
                                              AND project_id = projects.id)
                                    ELSE updated_at END) AS updated_at
                   FROM projects
                   WHERE team_id = $1 ${isArchived} ${isFavorites} AND is_member_of_project(projects.id , $2
                       , $1)
                   ORDER BY updated_at DESC`;

        return await database.query(query, [team_id, user_id]);
    }
}