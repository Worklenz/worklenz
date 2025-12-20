import moment from "moment";

import db from "../../config/db";
import { IPassportSession } from "../../interfaces/passport-session";

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

export default class UserSessionService {
  public static async loadByUserId(userId?: string | null): Promise<IPassportSession | null> {
    if (!userId) {
      return null;
    }

    if (userId === "00000000-0000-0000-0000-000000000000") {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        return {
          id: userId,
          email: adminEmail,
          name: "System Administrator",
          is_admin: true,
          owner: true,
          account_status: "approved",
          setup_completed: true,
          timezone_name: "UTC",
          is_expired: false,
          is_member: true,
          owner_id: userId
        } as IPassportSession;
      }
    }

    const excludedSubscriptionTypes = ["TRIAL", "PADDLE"];
    const q = `SELECT deserialize_user($1) AS user;`;
    const result = await db.query(q, [userId]);

    if (!result.rows.length) {
      return null;
    }

    const [data] = result.rows;
    if (!data?.user) {
      return null;
    }

    const user = data.user as IPassportSession;
    const realExpiredDate = moment(user.valid_till_date).add(7, "days");
    user.is_expired = false;
    user.is_member = !!user.team_member_id;

    if (user.subscription_type && excludedSubscriptionTypes.includes(user.subscription_type)) {
      user.is_expired = realExpiredDate.isBefore(moment(), "days");
    }

    void setLastActive(user.id || "");
    if (user.email && user.team_id) {
      void clearEmailInvitations(user.email, user.team_id);
    }

    return user;
  }
}
