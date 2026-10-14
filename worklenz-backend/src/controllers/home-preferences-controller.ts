import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { DEFAULT_HOME_PREFERENCES, validateHomePreferences } from "../shared/home-preferences";
import WorklenzControllerBase from "./worklenz-controller-base";

/**
 * A user's own Home page preferences: widget layout, task tab order/visibility and the last-used
 * selections (#2372). One JSON document per user; always the requester's own row, never anyone else's.
 */
export default class HomePreferencesController extends WorklenzControllerBase {

  /** Returns the stored document, or the defaults for a user who has never saved (or whose stored document no longer validates). */
  @HandleExceptions()
  public static async getPreferences(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id as string;

    const result = await db.query(
      `SELECT preferences, updated_at FROM user_home_preferences WHERE user_id = $1`,
      [userId]
    );
    const [row] = result.rows;

    const checked = row ? validateHomePreferences(row.preferences) : null;
    res.set("Cache-Control", "no-store");
    return res.status(200).send(new ServerResponse(true, {
      preferences: checked?.ok ? checked.value : DEFAULT_HOME_PREFERENCES,
      updated_at: checked?.ok ? row.updated_at : null,
    }));
  }

  /** Replaces the user's document. Last write wins. The request body is the document itself. */
  @HandleExceptions()
  public static async updatePreferences(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id as string;

    const checked = validateHomePreferences(req.body);
    if (!checked.ok) {
      return res.status(400).send(new ServerResponse(false, null, checked.error));
    }

    const result = await db.query(
      `INSERT INTO user_home_preferences (user_id, preferences, updated_at)
       VALUES ($1, $2::JSONB, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         preferences = EXCLUDED.preferences,
         updated_at  = CURRENT_TIMESTAMP
       RETURNING updated_at`,
      [userId, JSON.stringify(checked.value)]
    );

    return res.status(200).send(new ServerResponse(true, {
      preferences: checked.value,
      updated_at: result.rows[0].updated_at,
    }));
  }
}
