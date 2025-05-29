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
    console.log("=== DESERIALIZE DEBUG ===");
    console.log("User object:", user);
    
    if (!user || !user.id) {
      console.log("No user or user.id, returning null");
      return done(null, null);
    }
    
    const {id} = user;
    console.log("Deserializing user ID:", id);
    
    // First check if user exists in users table
    const userCheck = await db.query("SELECT id, active_team FROM users WHERE id = $1", [id]);
    console.log("User exists check:", userCheck.rowCount, userCheck.rows[0]);
    
    if (!userCheck.rowCount) {
      console.log("User not found in users table");
      return done(null, null);
    }
    
    const excludedSubscriptionTypes = ["TRIAL", "PADDLE"];
    const q = `SELECT deserialize_user($1) AS user;`;
    console.log("Calling deserialize_user with ID:", id);
    
    const result = await db.query(q, [id]);
    
    console.log("Database query result rows length:", result.rows.length);
    console.log("Raw database result:", result.rows);
    
    if (result.rows.length) {
      const [data] = result.rows;
      console.log("Database result data:", data);
      
      if (data?.user) {
        console.log("User data found:", data.user);
        
        const realExpiredDate = moment(data.user.valid_till_date).add(7, "days");
        data.user.is_expired = false;

        data.user.is_member = !!data.user.team_member_id;
        if (excludedSubscriptionTypes.includes(data.user.subscription_type)) data.user.is_expired = realExpiredDate.isBefore(moment(), "days");

        void setLastActive(data.user.id);
        void clearEmailInvitations(data.user.email, data.user.team_id);

        console.log("Returning successful user:", data.user);
        return done(null, data.user as IPassportSession);
      }
      console.log("No user data in result - deserialize_user returned null");
    }
    console.log("No rows returned from database");
    
    console.log("Returning null user");
    return done(null, null);
  } catch (error) {
    console.log("Deserialize error:", error);
    return done(error, null);
  }
}
