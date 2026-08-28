import db from "../config/db";
import { log_error } from "./utils";

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ');
}

export function extractUrls(html: string): string[] {
  const text = stripHtml(html);
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  return [...new Set(matches.map(url => url.replace(/[.,;:!?)]+$/, '')))];
}

export async function syncTaskDescriptionLinks(
  projectId: string,
  taskId: string,
  teamId: string,
  description: string,
  userId?: string
): Promise<void> {
  try {
    const urls = extractUrls(description);
    await db.query(
      `DELETE FROM project_links WHERE source_task_id = $1 AND source_type = 'task_description'`,
      [taskId]
    );
    for (const url of urls) {
      await db.query(
        `INSERT INTO project_links (project_id, team_id, title, url, source_type, source_task_id, added_by)
         VALUES ($1, $2, $3, $4, 'task_description', $5, $6)`,
        [projectId, teamId, url, url, taskId, userId ?? null]
      );
    }
  } catch (e) {
    log_error(e);
  }
}

export async function syncCommentLinks(
  projectId: string,
  taskId: string,
  commentId: string,
  teamId: string,
  content: string,
  userId?: string
): Promise<void> {
  try {
    const urls = extractUrls(content);
    await db.query(
      `DELETE FROM project_links WHERE source_comment_id = $1 AND source_type = 'task_comment'`,
      [commentId]
    );
    for (const url of urls) {
      await db.query(
        `INSERT INTO project_links (project_id, team_id, title, url, source_type, source_task_id, source_comment_id, added_by)
         VALUES ($1, $2, $3, $4, 'task_comment', $5, $6, $7)`,
        [projectId, teamId, url, url, taskId, commentId, userId ?? null]
      );
    }
  } catch (e) {
    log_error(e);
  }
}

export async function syncProjectCommentLinks(
  projectId: string,
  commentId: string,
  teamId: string,
  content: string,
  userId: string
): Promise<void> {
  try {
    const urls = extractUrls(content);
    await db.query(
      `DELETE FROM project_links WHERE source_project_comment_id = $1 AND source_type = 'project_comment'`,
      [commentId]
    );
    for (const url of urls) {
      await db.query(
        `INSERT INTO project_links (project_id, team_id, title, url, source_type, source_project_comment_id, added_by)
         VALUES ($1, $2, $3, $4, 'project_comment', $5, $6)`,
        [projectId, teamId, url, url, commentId, userId]
      );
    }
  } catch (e) {
    log_error(e);
  }
}

export async function deleteCommentLinks(commentId: string): Promise<void> {
  try {
    await db.query(
      `DELETE FROM project_links WHERE source_comment_id = $1 OR source_project_comment_id = $1`,
      [commentId]
    );
  } catch (e) {
    log_error(e);
  }
}
