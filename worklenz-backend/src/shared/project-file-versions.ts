import db from "../config/db";

/**
 * Replacement versions of a project file (Client Portal v2 Files & Documents).
 *
 * Version 1 is the project_files row itself, whose storage object is derived from the file id. A
 * replacement (version >= 2) lives in project_file_versions with its own explicit storage key.
 *
 * These helpers are used by the main Files tab (download, delete) so it keeps serving the current
 * version. They are written to degrade gracefully: if the version tables are not there yet (code
 * deployed ahead of the migration) they report "no replacement versions" instead of failing the
 * existing Files tab.
 */

const UNDEFINED_TABLE = "42P01";
const UNDEFINED_COLUMN = "42703";

const isMissingSchema = (error: unknown): boolean => {
  const code = (error as { code?: string } | undefined)?.code;
  return code === UNDEFINED_TABLE || code === UNDEFINED_COLUMN;
};

/**
 * The storage key of the file's current version when that is a replacement, or null when the
 * current version is version 1 (derive the key from the file id as before).
 */
export async function getReplacementObjectKey(fileId: string): Promise<string | null> {
  try {
    const result = await db.query(
      `SELECT v.storage_key
         FROM project_files pf
         JOIN project_file_versions v
           ON v.file_id = pf.id AND v.version_no = pf.current_version AND v.status = 'active'
        WHERE pf.id = $1`,
      [fileId]
    );
    return result.rows[0]?.storage_key ?? null;
  } catch (error) {
    if (isMissingSchema(error)) return null;
    throw error;
  }
}

/** Storage keys of every replacement version of a file, so deleting the file can remove them too. */
export async function getAllReplacementObjectKeys(fileId: string): Promise<string[]> {
  try {
    const result = await db.query(`SELECT storage_key FROM project_file_versions WHERE file_id = $1`, [fileId]);
    return result.rows.map(row => row.storage_key as string);
  } catch (error) {
    if (isMissingSchema(error)) return [];
    throw error;
  }
}
