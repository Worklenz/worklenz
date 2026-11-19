import fs from "fs";
import path from "path";
import db from "../../config/db";
import { loadLogo } from "../../shared/pdf/load-logo";

const DEFAULT_LOGO_CANDIDATES = [
  path.join(__dirname, "../../public/assets/images/wl-logo.png"),
  path.join(__dirname, "../../../src/public/assets/images/wl-logo.png"),
  path.join(process.cwd(), "src/public/assets/images/wl-logo.png"),
  path.join(process.cwd(), "public/assets/images/wl-logo.png"),
];

function readDefaultWorklenzLogo(): Buffer | null {
  for (const candidate of DEFAULT_LOGO_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate);
      }
    } catch {
      // try next path
    }
  }
  return null;
}

/** Load organization logo for a team; fall back to the Worklenz default asset. */
export async function resolveSchedulePdfLogo(teamId: string): Promise<Buffer | null> {
  if (!teamId) return readDefaultWorklenzLogo();

  try {
    const result = await db.query(
      `SELECT o.logo_url
       FROM organizations o
       INNER JOIN teams t ON (t.user_id = o.user_id OR t.organization_id = o.id)
       WHERE t.id = $1::UUID
       LIMIT 1`,
      [teamId]
    );
    const logoUrl: string | null = result.rows[0]?.logo_url ?? null;
    const remote = await loadLogo(logoUrl);
    if (remote?.length) return remote;
  } catch (error) {
    console.warn(
      "Schedule PDF logo lookup failed, using Worklenz default:",
      (error as Error).message
    );
  }

  return readDefaultWorklenzLogo();
}

/** Synchronous Worklenz default logo for sample scripts / tests. */
export function getDefaultWorklenzLogoBuffer(): Buffer | null {
  return readDefaultWorklenzLogo();
}
