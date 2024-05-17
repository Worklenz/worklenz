import moment from "moment";
import db from "../config/db";
import {IDeserializeCallback} from "../interfaces/deserialize-callback";
import {IPassportSession} from "../interfaces/passport-session";

async function setLastActive(id: string) {
  try {
    await db.query("UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1;", [id]);
  } catch (error) {
    // ignored
  }
}

async function clearEmailInvitations(email: string, teamId: string) {
  try {
    await db.query("DELETE FROM email_invitations WHERE email = $1 AND team_id = $2;", [email, teamId]);
  } catch (error) {
    // ignored
  }
}

// Check whether the user still exists on the database
export async function deserialize(id: string, done: IDeserializeCallback) {
  try {
    const q = `SELECT deserialize_user($1) AS user;`;
    const result = await db.query(q, [id]);
    if (result.rows.length) {
      const [data] = result.rows;
      if (data?.user) {
        data.user.is_member = !!data.user.team_member_id;

        void setLastActive(data.user.id);
        void clearEmailInvitations(data.user.email, data.user.team_id);

        return done(null, data.user as IPassportSession);
      }
    }
    return done(null, null);
  } catch (error) {
    return done(error, null);
  }
}
