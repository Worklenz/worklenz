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
export async function deserialize(user: { id: string | null }, done: IDeserializeCallback) {
  try {
    if (!user || !user.id) {
      return done(null, null);
    }
    
    const {id} = user;
    const excludedSubscriptionTypes = ["TRIAL", "PADDLE"];
    const q = `SELECT deserialize_user($1) AS user;`;
    const result = await db.query(q, [id]);
    if (result.rows.length) {
      const [data] = result.rows;
      if (data?.user) {
        const realExpiredDate = moment(data.user.valid_till_date).add(7, "days");
        data.user.is_expired = false;

        // deserialize_user() already resolves subscription_type/active_plan_trial
        // correctly (BUSINESS_TRIAL while an active trial is running, LIFE_TIME_DEAL
        // once it ends) — do not override it here based on the raw, permanent
        // subscription_status field, or a redeemed AppSumo code would cut the trial
        // short in every downstream check that reads req.user.

        data.user.is_member = !!data.user.team_member_id;
        if (excludedSubscriptionTypes.includes(data.user.subscription_type)) data.user.is_expired = realExpiredDate.isBefore(moment(), "days");

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
