import { IDeserializeCallback } from "../interfaces/deserialize-callback";
import UserSessionService from "../services/auth/user-session.service";

// Check whether the user still exists on the database
export async function deserialize(user: { id: string | null }, done: IDeserializeCallback) {
  try {
    const session = await UserSessionService.loadByUserId(user?.id);
    return done(null, session);
  } catch (error) {
    return done(error, null);
  }
}
