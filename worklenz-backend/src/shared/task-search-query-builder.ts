interface TaskSearchScopeFilter {
  clause: string;
  params: unknown[];
}

/** Keep every search alternative inside the project and assignee access restrictions. */
export const buildTaskSearchQuery = (
  searchString: string,
  projectId: string,
  taskId: string,
  scopeFilter: TaskSearchScopeFilter
) => ({
  query: `SELECT t.id AS value,
       t.name AS label,
       CONCAT(p.key, '-', t.task_no) AS task_key
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE (t.name ILIKE $1
        OR CONCAT(p.key, '-', t.task_no) ILIKE $1
        OR t.task_no::text ILIKE $1
        OR t.id::text ILIKE $1)
        AND t.project_id = $2 AND t.id != $3
        ${scopeFilter.clause ? `AND ${scopeFilter.clause}` : ""}
      LIMIT 15;`,
  params: [`%${(searchString || "").trim()}%`, projectId, taskId, ...scopeFilter.params],
});
