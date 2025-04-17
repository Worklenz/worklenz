import {ISerializeCallback} from "../interfaces/serialize-callback";
import {IPassportSession} from "../interfaces/passport-session";

// Parse the user id to deserialize function
export function serialize($user: IPassportSession, done: ISerializeCallback) {
  done(null, { id: $user?.id ?? null });
}
